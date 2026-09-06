import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../lib/logger";

let transporter: Transporter | null = null;

/**
 * Returns a nodemailer transport. Falls back to a JSON transport
 * (emails are logged, never sent) when SMTP_URL is not configured —
 * ideal for local development and CI.
 */
export function getMailer(): Transporter {
  if (!transporter) {
    transporter = env.mail.smtpUrl
      ? nodemailer.createTransport(env.mail.smtpUrl)
      : nodemailer.createTransport({ jsonTransport: true });
    logger.info(
      env.mail.smtpUrl
        ? "Mailer: SMTP transport configured"
        : "Mailer: SMTP_URL not set — emails will be logged, not sent",
    );
  }
  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getMailer().sendMail({
    from: env.mail.from,
    ...options,
  });
  logger.info(`Email queued/sent to ${options.to}: "${options.subject}"`);
}
