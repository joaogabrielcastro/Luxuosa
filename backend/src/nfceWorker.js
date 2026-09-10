import { getNfceWorkerPollMs, startNfceWorker } from "./jobs/nfceWorkerLoop.js";

startNfceWorker({ pollMs: getNfceWorkerPollMs() });
