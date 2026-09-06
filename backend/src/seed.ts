import { Role } from "./models/role.model";
import { User } from "./models/user.model";
import { ALL_PERMISSIONS, ROLES } from "./lib/permissions";
import { env } from "./config/env";
import { logger } from "./lib/logger";

/**
 * Idempotent seed: ensures system roles exist and creates the initial
 * admin account (from env) if missing.
 */
export async function seedDefaults(): Promise<void> {
  // --- Roles ---
  await Role.updateOne(
    { name: ROLES.ADMIN },
    {
      $setOnInsert: {
        name: ROLES.ADMIN,
        description: "Full access to the system",
        permissions: ["*", ...ALL_PERMISSIONS],
        isSystem: true,
      },
    },
    { upsert: true },
  );

  await Role.updateOne(
    { name: ROLES.USER },
    {
      $setOnInsert: {
        name: ROLES.USER,
        description: "Default role for registered users",
        permissions: [],
        isSystem: true,
      },
    },
    { upsert: true },
  );

  logger.info("System roles ensured (admin, user)");

  // --- Initial admin user ---
  const adminRole = await Role.findOne({ name: ROLES.ADMIN });
  if (!adminRole) throw new Error("admin role missing after seed");

  const existingAdmin = await User.findOne({ email: env.seed.adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: "Admin",
      email: env.seed.adminEmail,
      passwordHash: await Bun.password.hash(env.seed.adminPassword),
      role: adminRole._id,
    });
    logger.info(`Admin user created: ${env.seed.adminEmail}`);
  } else {
    logger.info(`Admin user already exists: ${env.seed.adminEmail}`);
  }
}

// Standalone: `bun run seed`
if (import.meta.main) {
  const { connectMongo, disconnectMongo } = await import("./config/mongo");
  try {
    await connectMongo();
    await seedDefaults();
    await disconnectMongo();
    process.exit(0);
  } catch (err) {
    logger.error("Seed failed:", err);
    process.exit(1);
  }
}
