import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Types } from "mongoose";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export type TokenPayload = AccessTokenPayload | RefreshTokenPayload;

function sign(payload: object, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function signAccessToken(userId: string | Types.ObjectId, email: string): string {
  return sign(
    { sub: userId.toString(), email, type: "access" },
    env.jwt.accessSecret,
    env.jwt.accessExpiresIn,
  );
}

export function signRefreshToken(userId: string | Types.ObjectId): string {
  const exp = `${env.jwt.refreshExpiresInDays}d`;
  return sign(
    { sub: userId.toString(), type: "refresh" },
    env.jwt.refreshSecret,
    exp,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
  if (payload.type !== "refresh") {
    throw new jwt.JsonWebTokenError("Not a refresh token");
  }
  return payload;
}

/** Seconds until the refresh token expires — used to set DB TTLs. */
export const REFRESH_TTL_SECONDS = env.jwt.refreshExpiresInDays * 24 * 60 * 60;
