import mongoose, { Schema, type Model, type Types } from "mongoose";
import { createHash } from "node:crypto";
import { REFRESH_TTL_SECONDS } from "../lib/jwt";

export type TokenType = "refresh" | "password_reset";

export interface IToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  type: TokenType;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    type: { type: String, enum: ["refresh", "password_reset"], required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

// TTL cleanup: documents are removed shortly after expiry.
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const Token: Model<IToken> =
  mongoose.models.Token ?? mongoose.model<IToken>("Token", tokenSchema);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenUsable(token: IToken): boolean {
  return !token.revokedAt && token.expiresAt > new Date();
}

export async function issueToken(
  userId: Types.ObjectId,
  type: TokenType,
  rawToken: string,
  ttlSeconds: number,
): Promise<IToken> {
  return Token.create({
    user: userId,
    type,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });
}

export async function revokeToken(tokenHash: string): Promise<void> {
  await Token.updateOne(
    { tokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllUserTokens(
  userId: string | Types.ObjectId,
  type?: TokenType,
): Promise<void> {
  const filter: Record<string, unknown> = { user: userId, revokedAt: { $exists: false } };
  if (type) filter.type = type;
  await Token.updateMany(filter, { $set: { revokedAt: new Date() } });
}

export { REFRESH_TTL_SECONDS };
