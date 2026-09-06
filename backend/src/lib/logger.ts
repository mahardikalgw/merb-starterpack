/** Simple structured logger (swap for pino/winston if needed). */
const level = process.env.LOG_LEVEL ?? "info";

function log(kind: string, args: unknown[]): void {
  const ts = new Date().toISOString();
  console[kind === "ERROR" ? "error" : kind === "WARN" ? "warn" : "log"](
    `[${ts}] [${kind}]`,
    ...args,
  );
}

export const logger = {
  info: (...args: unknown[]) => log("INFO", args),
  warn: (...args: unknown[]) => log("WARN", args),
  error: (...args: unknown[]) => log("ERROR", args),
  debug: (...args: unknown[]) => {
    if (level === "debug") log("DEBUG", args);
  },
};
