import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { router } from "./routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { billingController } from "./modules/billing/billing.controller.js";

export const app = express();

const corsMiddleware =
  env.corsOrigins.length > 0
    ? cors({
        origin: env.corsOrigins.length === 1 ? env.corsOrigins[0] : env.corsOrigins
      })
    : cors();

app.use(corsMiddleware);

/** Webhook Stripe exige body raw (assinatura). Registrar antes do JSON parser. */
app.post(
  "/api/v1/billing/webhook",
  express.raw({ type: "application/json" }),
  billingController.webhook
);

app.use(express.json({ limit: "2.5mb" }));
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api/v1", router);
app.use(errorHandler);
