import { Worker, type Job } from "bullmq";
import { EMAIL_QUEUE_NAME, createRedisConnection, type EmailJobData } from "../queue/connection";
import { sendMail } from "../emails/mailer";
import { logger } from "../lib/logger";

async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, text } = job.data;
  logger.debug(`Processing email job ${job.id} -> ${to}`);
  await sendMail({ to, subject, html, text });
}

/**
 * Standalone email worker entry point.
 * Run with: bun run worker
 */
export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmail, {
    connection: createRedisConnection(),
    concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY ?? 5),
  });

  worker.on("completed", (job) => logger.info(`Email job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    logger.error(`Email job ${job?.id ?? "?"} failed (attempt ${job?.attemptsMade}): ${err.message}`),
  );
  worker.on("error", (err) => logger.error(`Email worker error: ${err.message}`));

  logger.info("Email worker started");
  return worker;
}

// Allow `bun src/workers/email.worker.ts` as a standalone process.
if (import.meta.main) {
  const worker = startEmailWorker();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down email worker...`);
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
