import { env } from "./config/env.js";
import { resumeNfceQueuesOnStartup } from "./jobs/enqueueNfceIssue.js";
import { logger } from "./utils/logger.js";

const POLL_MS = Math.max(3000, Number(process.env.NFCE_WORKER_POLL_MS || 5000));

async function tick() {
  try {
    await resumeNfceQueuesOnStartup();
  } catch (err) {
    logger.error("Worker NFC-e: ciclo falhou", { error: err?.message || String(err) });
  }
}

logger.info("Worker NFC-e iniciado", { pollMs: POLL_MS });
void tick();
setInterval(() => void tick(), POLL_MS);
