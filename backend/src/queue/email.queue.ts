import { getEmailQueue, type EmailJobData } from "./connection";

export type EmailTemplateJob =
  | { kind: "welcome"; to: string; data: { name: string; actionUrl?: string } }
  | { kind: "password-reset"; to: string; data: { name: string; resetUrl: string; expiresInMinutes: number } };

/**
 * Enqueue a templated email. The heavy lifting (rendering + SMTP) happens
 * in the worker process, keeping API requests fast.
 */
export async function enqueueEmail(job: EmailTemplateJob): Promise<void> {
  const { renderWelcomeEmail, renderPasswordResetEmail } = await import(
    "../emails/templates"
  );

  let payload: EmailJobData;
  switch (job.kind) {
    case "welcome": {
      const rendered = renderWelcomeEmail(job.data);
      payload = { to: job.to, ...rendered };
      break;
    }
    case "password-reset": {
      const rendered = renderPasswordResetEmail(job.data);
      payload = { to: job.to, ...rendered };
      break;
    }
  }

  await getEmailQueue().add("send", payload);
  return;
}
