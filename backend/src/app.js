import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./config/env.js";
import { router } from "./routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

const corsMiddleware =
  env.corsOrigins.length > 0
    ? cors({
        origin: env.corsOrigins.length === 1 ? env.corsOrigins[0] : env.corsOrigins
      })
    : cors();

app.use(corsMiddleware);
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/v1", router);
app.use(errorHandler);
