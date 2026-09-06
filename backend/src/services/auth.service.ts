import { User, type IUser, type PopulatedUser } from "../models/user.model";
import { Role } from "../models/role.model";
import {
  Token,
  hashToken,
  isTokenUsable,
  issueToken,
  revokeAllUserTokens,
  revokeToken,
  REFRESH_TTL_SECONDS,
} from "../models/token.model";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { ApiError } from "../lib/errors";
import { PERMISSIONS, ROLES } from "../lib/permissions";
import { enqueueEmail } from "../queue/email.queue";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const PASSWORD_RESET_TTL_SECONDS = 15 * 60;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function issueAuthTokens(user: IUser): Promise<AuthTokens> {
  const accessToken = signAccessToken(user._id, user.email);
  const refreshToken = signRefreshToken(user._id);
  await issueToken(
    user._id,
    "refresh",
    refreshToken,
    REFRESH_TTL_SECONDS,
  );
  return { accessToken, refreshToken };
}

function publicUser(user: PopulatedUser) {
  const role = typeof user.role === "object" ? user.role : undefined;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    role: role
      ? { id: role._id, name: role.name, permissions: role.permissions }
      : undefined,
    createdAt: user.createdAt,
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: ReturnType<typeof publicUser>; tokens: AuthTokens }> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw ApiError.conflict("Email is already registered");

  const defaultRole = await Role.findOne({ name: ROLES.USER });
  if (!defaultRole) throw new Error("Default role missing — run the seed first");

  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: await Bun.password.hash(input.password),
    role: defaultRole._id,
  });

  // Fire-and-forget welcome email through the queue.
  await enqueueEmail({
    kind: "welcome",
    to: user.email,
    data: { name: user.name, actionUrl: process.env.APP_URL },
  }).catch((err) =>
    logger.error("Failed to enqueue welcome email:", err),
  );

  const tokens = await issueAuthTokens(user);
  const populated = (await user.populate("role")).toObject() as PopulatedUser;
  return { user: publicUser(populated), tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: ReturnType<typeof publicUser>; tokens: AuthTokens }> {
  const user = await User.findOne({ email: input.email.toLowerCase() })
    .select("+passwordHash")
    .populate("role");
  if (!user || !user.isActive) throw ApiError.unauthorized("Invalid credentials");

  const valid = await Bun.password.verify(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid credentials");

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueAuthTokens(user);
  const populated = user.toObject() as PopulatedUser;
  return { user: publicUser(populated), tokens };
}

export async function refresh(rawRefreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const stored = await Token.findOne({
    tokenHash: hashToken(rawRefreshToken),
    type: "refresh",
  });
  if (!stored) {
    // Token not found — possibly replayed after rotation. Revoke everything.
    await revokeAllUserTokens(payload.sub, "refresh");
    throw ApiError.unauthorized("Refresh token is no longer valid");
  }
  if (!isTokenUsable(stored)) {
    await revokeAllUserTokens(stored.user, "refresh");
    throw ApiError.unauthorized("Refresh token is no longer valid");
  }

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) throw ApiError.unauthorized("Account not found or deactivated");

  // Rotate: revoke old refresh token, issue a new pair.
  await revokeToken(stored.tokenHash);
  return issueAuthTokens(user);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await revokeToken(hashToken(rawRefreshToken));
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always respond OK to avoid account enumeration.
  if (!user) return;

  await revokeAllUserTokens(user._id, "password_reset");
  const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await issueToken(user._id, "password_reset", raw, PASSWORD_RESET_TTL_SECONDS);

  const base = process.env.APP_URL ?? "http://localhost:5173";
  await enqueueEmail({
    kind: "password-reset",
    to: user.email,
    data: {
      name: user.name,
      resetUrl: `${base}/reset-password?token=${raw}`,
      expiresInMinutes: PASSWORD_RESET_TTL_SECONDS / 60,
    },
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const stored = await Token.findOne({
    tokenHash: hashToken(token),
    type: "password_reset",
  });
  if (!stored || !isTokenUsable(stored)) {
    throw ApiError.badRequest("Password reset token is invalid or expired");
  }

  const user = await User.findById(stored.user).select("+passwordHash");
  if (!user) throw ApiError.badRequest("Password reset token is invalid or expired");

  user.passwordHash = await Bun.password.hash(newPassword);
  await user.save();
  await revokeAllUserTokens(user._id); // force re-login everywhere
}

export async function getProfile(userId: string): Promise<ReturnType<typeof publicUser>> {
  const user = await User.findById(userId).populate("role");
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user.toObject() as PopulatedUser);
}
