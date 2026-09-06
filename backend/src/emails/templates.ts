export interface WelcomeEmailData {
  name: string;
  /** Frontend URL the user clicks to verify / get started. */
  actionUrl?: string;
}

export interface PasswordResetEmailData {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
      ${body}
      <p style="margin-top:32px;font-size:12px;color:#9ca3af;">
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </body>
</html>`;
}

export function renderWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const html = layout(
    `Welcome, ${data.name}!`,
    `<p style="margin:0 0 12px;">Your account has been created successfully.</p>
     ${data.actionUrl ? `<a href="${data.actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Get started</a>` : ""}`,
  );
  return {
    subject: "Welcome to the platform 🎉",
    html,
    text: `Welcome, ${data.name}! Your account has been created successfully.`,
  };
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): { subject: string; html: string; text: string } {
  const html = layout(
    "Reset your password",
    `<p style="margin:0 0 12px;">Hi ${data.name}, we received a request to reset your password.</p>
     <a href="${data.resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Reset password</a>
     <p style="margin-top:16px;">This link expires in ${data.expiresInMinutes} minutes.</p>`,
  );
  return {
    subject: "Reset your password",
    html,
    text: `Hi ${data.name}, reset your password: ${data.resetUrl} (expires in ${data.expiresInMinutes} minutes)`,
  };
}
