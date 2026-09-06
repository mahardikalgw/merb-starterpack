import { Router } from "express";
import * as roleController from "../controllers/role.controller";
import { authenticate, requirePermissions } from "../middleware/auth.middleware";
import { createRoleSchema, updateRoleSchema } from "../validators/auth.schema";
import { PERMISSIONS } from "../lib/permissions";

function validate(schema: { parse: (req: unknown) => unknown }) {
  return (req: unknown, _res: unknown, next: (err?: unknown) => void) => {
    try {
      schema.parse(req);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const roleRouter = Router();

roleRouter.use(authenticate);

roleRouter.get(
  "/",
  requirePermissions(PERMISSIONS.ROLES_READ),
  roleController.listRoles,
);
roleRouter.post(
  "/",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  roleController.createRole,
);
roleRouter.patch(
  "/:id",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  validate(updateRoleSchema),
  roleController.updateRole,
);
roleRouter.delete(
  "/:id",
  requirePermissions(PERMISSIONS.ROLES_MANAGE),
  roleController.deleteRole,
);
