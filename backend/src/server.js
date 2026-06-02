import { app } from "./app.js";
import { env } from "./config/env.js";
import { resumeNfceQueuesOnStartup } from "./jobs/enqueueNfceIssue.js";
import { logger } from "./utils/logger.js";

app.listen(env.port, () => {
  logger.info("API online", { port: env.port, nfceProcessInApi: env.nfceProcessInApi });
  if (env.nfceProcessInApi) {
    void resumeNfceQueuesOnStartup().catch((err) =>
      logger.error("Falha ao retomar fila NFC-e", { error: err?.message || String(err) })
    );
  }
});
