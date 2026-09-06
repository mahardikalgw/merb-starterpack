import { Queue } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import { env } from "../config/env";

/**
 * Shared BullMQ/Redis connection factory.
 * BullMQ requires `maxRetriesPerRequest: null` on blocking connections.
 */
export function createRedisConnection(): Redis {
  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const EMAIL_QUEUE_NAME = "email";

let emailQueue: Queue<EmailJobData> | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 3_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return emailQueue;
}

export async function closeQueues(): Promise<void> {
  await emailQueue?.close();
  emailQueue = null;
}
