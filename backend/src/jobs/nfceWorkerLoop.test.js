import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNfceWorkerPollMs, nfceWorkerTick, startNfceWorker } from "./nfceWorkerLoop.js";

describe("nfceWorkerLoop", () => {
  it("tick chama resume e engole erro", async () => {
    let calls = 0;
    await nfceWorkerTick(async () => {
      calls += 1;
    });
    assert.equal(calls, 1);

    await nfceWorkerTick(async () => {
      throw new Error("boom");
    });
  });

  it("start dispara tick e agenda intervalo", async () => {
    let ticks = 0;
    let scheduledMs = 0;
    const handle = startNfceWorker({
      tick: async () => {
        ticks += 1;
      },
      pollMs: 1234,
      interval: (fn, ms) => {
        scheduledMs = ms;
        return 99;
      },
      log: { info() {} }
    });
    await new Promise((r) => setImmediate(r));
    assert.equal(ticks, 1);
    assert.equal(scheduledMs, 1234);
    assert.equal(handle, 99);
  });

  it("poll minimo 3000ms", () => {
    const prev = process.env.NFCE_WORKER_POLL_MS;
    process.env.NFCE_WORKER_POLL_MS = "100";
    assert.equal(getNfceWorkerPollMs(), 3000);
    process.env.NFCE_WORKER_POLL_MS = prev;
  });
});
