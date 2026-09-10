import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";
import { env } from "../config/env.js";

const jobs = new Map();
const invoices = new Map();
let tenants = { t1: { enableNfceEmission: true } };
let issueImpl = async () => {};
let groupByRows = [];
let updateManyStale = { count: 0 };
let resumeError = null;
let claimRace = false;

mock.module("../config/prisma.js", {
  namedExports: {
    prisma: {
      tenant: {
        findUnique: async ({ where }) => tenants[where.id] || null
      },
      invoice: {
        findUnique: async ({ where }) => invoices.get(where.saleId) || null
      },
      nfceIssueJob: {
        findUnique: async ({ where }) => {
          if (where.saleId) return [...jobs.values()].find((j) => j.saleId === where.saleId) || null;
          return jobs.get(where.id) || null;
        },
        findFirst: async ({ where }) => {
          const now = new Date();
          return (
            [...jobs.values()].find((j) => {
              if (where.tenantId && j.tenantId !== where.tenantId) return false;
              if (where.status && j.status !== where.status) return false;
              if (j.runAt && new Date(j.runAt) > now) return false;
              return true;
            }) || null
          );
        },
        create: async ({ data }) => {
          const row = { id: `job-${jobs.size + 1}`, attempts: 0, ...data };
          jobs.set(row.id, row);
          return row;
        },
        update: async ({ where, data }) => {
          const row = jobs.get(where.id) || [...jobs.values()].find((j) => j.saleId === where.saleId);
          if (row) Object.assign(row, data);
          return row;
        },
        updateMany: async ({ where, data }) => {
          if (where.status === NfceIssueJobStatus.PROCESSING && where.updatedAt) {
            return updateManyStale;
          }
          if (where.id && where.status === NfceIssueJobStatus.PENDING) {
            if (claimRace) return { count: 0 };
            const row = jobs.get(where.id);
            if (!row || row.status !== NfceIssueJobStatus.PENDING) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
          }
          let count = 0;
          for (const row of jobs.values()) {
            if (where.tenantId && row.tenantId !== where.tenantId) continue;
            if (where.saleId && row.saleId !== where.saleId) continue;
            Object.assign(row, data);
            count += 1;
          }
          return { count };
        },
        groupBy: async () => {
          if (resumeError) throw resumeError;
          return groupByRows;
        }
      }
    }
  }
});

mock.module("../modules/invoices/invoice.service.js", {
  namedExports: {
    invoiceService: {
      issueFromSale: (...args) => issueImpl(...args)
    }
  }
});

mock.module("../utils/logger.js", {
  namedExports: {
    logger: { warn() {} }
  }
});

const { enqueueNfceIssue, processNfceQueue, resumeNfceQueuesOnStartup } = await import(
  "./enqueueNfceIssue.js"
);

describe("enqueueNfceIssue", () => {
  env.nfceProcessInApi = false;

  it("desabilita NFC-e, ignora emitida e cria job", async () => {
    jobs.clear();
    invoices.clear();
    tenants.t1 = { enableNfceEmission: false };
    jobs.set("j0", { id: "j0", tenantId: "t1", saleId: "s0", status: NfceIssueJobStatus.PENDING, attempts: 0 });
    await enqueueNfceIssue("t1", "s0");
    assert.equal(jobs.get("j0").status, NfceIssueJobStatus.FAILED);

    tenants.t1 = { enableNfceEmission: true };
    invoices.set("s1", { status: InvoiceStatus.ISSUED });
    await enqueueNfceIssue("t1", "s1");
    assert.equal(jobs.size, 1);

    invoices.delete("s1");
    jobs.set("j1", {
      id: "j1",
      tenantId: "t1",
      saleId: "s1",
      status: NfceIssueJobStatus.COMPLETED,
      attempts: 0
    });
    await enqueueNfceIssue("t1", "s1");

    jobs.delete("j1");
    await enqueueNfceIssue("t1", "s2");
    assert.ok([...jobs.values()].some((j) => j.saleId === "s2"));

    const pending = [...jobs.values()].find((j) => j.saleId === "s2");
    pending.status = NfceIssueJobStatus.PENDING;
    await enqueueNfceIssue("t1", "s2");
    assert.ok("saleId" in pending);
  });

  it("drena fila: sucesso, corrida, in-progress e retry", async () => {
    jobs.clear();
    invoices.clear();
    tenants.t1 = { enableNfceEmission: true };

    jobs.set("ok", {
      id: "ok",
      tenantId: "t1",
      saleId: "s-ok",
      status: NfceIssueJobStatus.PENDING,
      attempts: 0
    });
    issueImpl = async () => {
      invoices.set("s-ok", { status: InvoiceStatus.ISSUED });
    };
    await processNfceQueue("t1");
    assert.equal(jobs.get("ok").status, NfceIssueJobStatus.COMPLETED);

    jobs.clear();
    claimRace = true;
    jobs.set("race", {
      id: "race",
      tenantId: "t1",
      saleId: "s-race",
      status: NfceIssueJobStatus.PENDING,
      attempts: 0
    });
    await processNfceQueue("t1");
    claimRace = false;

    jobs.clear();
    jobs.set("busy", {
      id: "busy",
      tenantId: "t1",
      saleId: "s-busy",
      status: NfceIssueJobStatus.PENDING,
      attempts: 0
    });
    issueImpl = async () => {
      const err = new Error("busy");
      err.code = "NFCE_EMISSION_IN_PROGRESS";
      throw err;
    };
    await processNfceQueue("t1");
    assert.equal(jobs.get("busy").status, NfceIssueJobStatus.PENDING);

    jobs.clear();
    jobs.set("pend", {
      id: "pend",
      tenantId: "t1",
      saleId: "s-pend",
      status: NfceIssueJobStatus.PENDING,
      attempts: 0
    });
    invoices.set("s-pend", { status: InvoiceStatus.PENDING, externalId: "inv_1" });
    issueImpl = async () => {};
    await processNfceQueue("t1");
    assert.equal(jobs.get("pend").status, NfceIssueJobStatus.PENDING);

    jobs.clear();
    invoices.clear();
    jobs.set("retry", {
      id: "retry",
      tenantId: "t1",
      saleId: "s-retry",
      status: NfceIssueJobStatus.PENDING,
      attempts: 0
    });
    issueImpl = async () => {
      const err = new Error("timeout");
      err.statusCode = 504;
      throw err;
    };
    await processNfceQueue("t1");
    assert.equal(jobs.get("retry").status, NfceIssueJobStatus.PENDING);
    assert.equal(jobs.get("retry").attempts, 1);

    jobs.clear();
    jobs.set("fail", {
      id: "fail",
      tenantId: "t1",
      saleId: "s-fail",
      status: NfceIssueJobStatus.PENDING,
      attempts: 4
    });
    issueImpl = async () => {
      throw new Error("negocio 400");
    };
    await processNfceQueue("t1");
    assert.equal(jobs.get("fail").status, NfceIssueJobStatus.FAILED);
  });

  it("resume startup: P2021, stale e filas", async () => {
    resumeError = { code: "P2021", message: "does not exist in the current database" };
    await resumeNfceQueuesOnStartup();
    resumeError = new Error("boom");
    await assert.rejects(() => resumeNfceQueuesOnStartup(), /boom/);
    resumeError = null;
    updateManyStale = { count: 2 };
    groupByRows = [{ tenantId: "t1" }];
    const prev = env.nfceProcessInApi;
    env.nfceProcessInApi = true;
    jobs.clear();
    await resumeNfceQueuesOnStartup();
    env.nfceProcessInApi = prev;
    updateManyStale = { count: 0 };
    groupByRows = [];
  });
});
