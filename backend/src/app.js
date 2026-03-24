import cors from "cors";
import express from "express";
import morgan from "morgan";
import { router } from "./routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/v1", router);
app.use(errorHandler);
