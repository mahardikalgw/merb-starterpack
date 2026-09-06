/**
 * Canonical list of permissions used across the app.
 * Permissions follow the `resource:action` convention.
 */
export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  ROLES_READ: "roles:read",
  ROLES_MANAGE: "roles:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Role names with special meaning. */
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
} as const;
