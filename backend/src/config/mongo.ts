import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../lib/logger";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  logger.info(`MongoDB connected: ${mongoose.connection.host}`);
}

mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
mongoose.connection.on("error", (err) => logger.error("MongoDB error:", err));
mongoose.connection.on("disconnected", () =>
  logger.info("MongoDB disconnected"),
);

process.on("SIGINT", () => {
  void mongoose.connection.close().then(() => process.exit(0));
});

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
