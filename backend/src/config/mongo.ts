import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../lib/logger";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  logger.info(`MongoDB connected: ${mongoose.connection.host}`);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
