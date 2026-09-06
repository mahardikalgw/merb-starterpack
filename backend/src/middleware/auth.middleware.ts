import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "../lib/errors";
import { User, type PopulatedUser } from "../models/user.model";
import type { Permission } from "../lib/permissions";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PopulatedUser;
    }
  }
}

/**
 * Authentication middleware — verifies the Bearer access token and
 * attaches the populated user (with role + permissions) to `req.user`.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing or malformed Authorization header");
    }
    const token = header.slice("Bearer ".length).trim();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized("Invalid or expired access token");
    }

    const user = await User.findById(payload.sub).populate<{
      role: PopulatedUser["role"];
    }>("role");

    if (!user || !user.isActive) {
      throw ApiError.unauthorized("Account not found or deactivated");
    }

    req.user = user.toObject() as PopulatedUser;
    next();
  } catch (err) {
    next(err);
  }
}

function permissionSet(user: PopulatedUser): Set<string> {
  const perms = user.role && !("permissions" in user.role)
    ? []
    : (user.role as PopulatedUser["role"]).permissions ?? [];
  return new Set(perms);
}

/**
 * Authorization middleware factory — grants access only when the
 * authenticated user's role has ALL of the given permissions.
 * Users with the `*` wildcard permission bypass the check (superadmin).
 */
export function requirePermissions(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    const perms = permissionSet(req.user);
    const ok = perms.has("*") || required.every((p) => perms.has(p));
    if (!ok) {
      next(
        ApiError.forbidden(
          `Missing required permission(s): ${required.join(", ")}`,
        ),
      );
      return;
    }
    next();
  };
}
