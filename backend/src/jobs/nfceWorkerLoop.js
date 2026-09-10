import { resumeNfceQueuesOnStartup } from "./enqueueNfceIssue.js";
import { logger } from "../utils/logger.js";

export function getNfceWorkerPollMs() {
  return Math.max(3000, Number(process.env.NFCE_WORKER_POLL_MS || 5000));
}

export async function nfceWorkerTick(resume = resumeNfceQueuesOnStartup) {
  try {
    await resume();
  } catch (err) {
    logger.error("Worker NFC-e: ciclo falhou", { error: err?.message || String(err) });
  }
}

/**
 * @param {{ tick?: () => Promise<void>, interval?: typeof setInterval, pollMs?: number, log?: typeof logger }} [opts]
 * @returns {ReturnType<typeof setInterval>}
 */
export function startNfceWorker({
  tick = nfceWorkerTick,
  interval = setInterval,
  pollMs = getNfceWorkerPollMs(),
  log = logger
} = {}) {
  log.info("Worker NFC-e iniciado", { pollMs });
  void tick();
  return interval(() => void tick(), pollMs);
}
