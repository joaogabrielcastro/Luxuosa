import { InvoiceStatus, NfceIssueJobStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { invoiceService } from "../modules/invoices/invoice.service.js";

const chains = new Map();

const STALE_PROCESSING_MS = 15 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableErr(err) {
  const code = err?.statusCode;
  if (code >= 500 && code < 600) return true;
  if (code === 504) return true;
  if (err?.code === "ETIMEDOUT") return true;
  const msg = String(err?.message || "");
  if (/timeout/i.test(msg)) return true;
  return false;
}

function isRetriableLastError(lastError) {
  const s = String(lastError || "").toLowerCase();
  if (!s) return true;
  if (/timeout|502|503|504|temporar|indispon|throttle|rate/i.test(s)) return true;
  return false;
}

async function recoverStaleForTenant(tenantId) {
  await prisma.nfceIssueJob.updateMany({
    where: {
      tenantId,
      status: NfceIssueJobStatus.PROCESSING,
      updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) }
    },
    data: { status: NfceIssueJobStatus.PENDING }
  });
}

async function claimNextJob(tenantId) {
  const now = new Date();
  const candidate = await prisma.nfceIssueJob.findFirst({
    where: {
      tenantId,
      status: NfceIssueJobStatus.PENDING,
      OR: [{ runAt: null }, { runAt: { lte: now } }]
    },
    orderBy: { createdAt: "asc" }
  });
  if (!candidate) return null;

  const u = await prisma.nfceIssueJob.updateMany({
    where: { id: candidate.id, status: NfceIssueJobStatus.PENDING },
    data: { status: NfceIssueJobStatus.PROCESSING }
  });
  if (u.count === 0) return null;
  return prisma.nfceIssueJob.findUnique({ where: { id: candidate.id } });
}

async function finalizeJobAttempt(job, caughtErr) {
  const inv = await prisma.invoice.findUnique({
    where: { saleId: job.saleId },
    select: { status: true, externalId: true, lastError: true }
  });

  if (inv?.status === InvoiceStatus.ISSUED) {
    await prisma.nfceIssueJob.update({
      where: { id: job.id },
      data: {
        status: NfceIssueJobStatus.COMPLETED,
        lastError: null,
        runAt: null
      }
    });
    return;
  }

  if (caughtErr?.code === "NFCE_EMISSION_IN_PROGRESS") {
    await prisma.nfceIssueJob.update({
      where: { id: job.id },
      data: {
        status: NfceIssueJobStatus.PENDING,
        runAt: new Date(Date.now() + 5000)
      }
    });
    return;
  }

  if (inv?.status === InvoiceStatus.PENDING && inv.externalId) {
    await prisma.nfceIssueJob.update({
      where: { id: job.id },
      data: {
        status: NfceIssueJobStatus.PENDING,
        runAt: new Date(Date.now() + 15000)
      }
    });
    return;
  }

  const attempts = job.attempts + 1;
  const errMsg =
    inv?.lastError?.slice(0, 65000) ||
    (caughtErr ? String(caughtErr.message || caughtErr) : "Falha na emissao da NFC-e.");
  const retriable =
    attempts < MAX_JOB_ATTEMPTS &&
    (caughtErr ? isRetriableErr(caughtErr) : isRetriableLastError(inv?.lastError));

  if (!retriable || attempts >= MAX_JOB_ATTEMPTS) {
    await prisma.nfceIssueJob.update({
      where: { id: job.id },
      data: {
        status: NfceIssueJobStatus.FAILED,
        attempts,
        lastError: errMsg,
        runAt: null
      }
    });
    console.error(`[NFC-e] job ${job.id} venda ${job.saleId} falhou apos ${attempts} tentativas:`, errMsg);
    return;
  }

  const delay = BASE_DELAY_MS * attempts;
  await prisma.nfceIssueJob.update({
    where: { id: job.id },
    data: {
      status: NfceIssueJobStatus.PENDING,
      attempts,
      runAt: new Date(Date.now() + delay),
      lastError: errMsg
    }
  });
}

async function runOneJob(job) {
  let caughtErr = null;
  try {
    await invoiceService.issueFromSale(job.tenantId, job.saleId, { silent: true });
  } catch (err) {
    caughtErr = err;
    console.error(`[NFC-e] job ${job.id} venda ${job.saleId}:`, err?.message || err);
  }
  await finalizeJobAttempt(job, caughtErr);
}

async function drainTenantQueue(tenantId) {
  await recoverStaleForTenant(tenantId);
  // Processa em serie ate esvaziar a fila persistida do tenant.
  for (;;) {
    const job = await claimNextJob(tenantId);
    if (!job) break;
    await runOneJob(job);
    await sleep(50);
  }
}

/**
 * Re-enfileira emissao automatica pos-venda. Estado persistido no Postgres (sobrevive restart).
 * Um worker logico por tenant (Promise chain) evita corrida e rate limit na Nuvem Fiscal.
 */
export async function enqueueNfceIssue(tenantId, saleId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { enableNfceEmission: true }
  });
  if (!tenant?.enableNfceEmission) {
    await prisma.nfceIssueJob.updateMany({
      where: { tenantId, saleId },
      data: {
        status: NfceIssueJobStatus.FAILED,
        lastError: "NFC-e nao habilitada para esta loja (emitente Nuvem Fiscal).",
        runAt: null
      }
    });
    return;
  }

  const inv = await prisma.invoice.findUnique({
    where: { saleId },
    select: { status: true }
  });
  if (inv?.status === InvoiceStatus.ISSUED) return;

  const existing = await prisma.nfceIssueJob.findUnique({ where: { saleId } });
  if (existing?.status === NfceIssueJobStatus.COMPLETED) return;

  if (!existing) {
    await prisma.nfceIssueJob.create({
      data: { tenantId, saleId, status: NfceIssueJobStatus.PENDING }
    });
  } else if (existing.status === NfceIssueJobStatus.PENDING) {
    await prisma.nfceIssueJob.update({
      where: { saleId },
      data: { runAt: null }
    });
  }
  // FAILED / PROCESSING: nao altera aqui; drain ainda roda para demais jobs do tenant.

  const prev = chains.get(tenantId) || Promise.resolve();
  const next = prev
    .then(() => drainTenantQueue(tenantId))
    .catch((err) => {
      console.error(`[NFC-e] fila tenant ${tenantId}:`, err?.message || err);
    });
  chains.set(tenantId, next);
}

/**
 * Recupera jobs presos em PROCESSING (ex.: deploy durante emissao) e retoma filas com PENDING.
 */
export async function resumeNfceQueuesOnStartup() {
  const stale = await prisma.nfceIssueJob.updateMany({
    where: {
      status: NfceIssueJobStatus.PROCESSING,
      updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) }
    },
    data: { status: NfceIssueJobStatus.PENDING }
  });
  if (stale.count > 0) {
    console.info(`[NFC-e] recuperados ${stale.count} job(s) presos em PROCESSING.`);
  }

  const tenants = await prisma.nfceIssueJob.groupBy({
    by: ["tenantId"],
    where: {
      status: NfceIssueJobStatus.PENDING,
      OR: [{ runAt: null }, { runAt: { lte: new Date() } }]
    }
  });

  for (const row of tenants) {
    const prev = chains.get(row.tenantId) || Promise.resolve();
    const next = prev
      .then(() => drainTenantQueue(row.tenantId))
      .catch((err) => console.error(`[NFC-e] fila tenant ${row.tenantId}:`, err?.message || err));
    chains.set(row.tenantId, next);
  }
}
