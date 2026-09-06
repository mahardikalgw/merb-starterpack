import { createApp } from "./app";
import { env } from "./config/env";
import { connectMongo, disconnectMongo } from "./config/mongo";
import { logger } from "./lib/logger";
import { seedDefaults } from "./seed";
import { startEmailWorker } from "./workers/email.worker";
import { closeQueues } from "./queue/connection";

async function main(): Promise<void> {
  await connectMongo();

  if (env.seed.enabled) {
    await seedDefaults();
  }

  // Start the email worker in-process when RUN_INLINE_WORKER=true.
  // In Docker/production, prefer the dedicated `bun run worker` service.
  let worker: ReturnType<typeof startEmailWorker> | undefined;
  if (process.env.RUN_INLINE_WORKER === "true") {
    worker = startEmailWorker();
  }

  const app = createApp();
  // Bun's node:http compatibility layer runs the Express app natively.
  const server = app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close();
    await worker?.close();
    await closeQueues();
    await disconnectMongo();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
