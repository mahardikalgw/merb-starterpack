import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate, requirePermissions } from "../middleware/auth.middleware";
import { updateProfileSchema, adminUpdateUserSchema } from "../validators/auth.schema";
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

export const userRouter = Router();

// Current user's own profile
userRouter.patch(
  "/me",
  authenticate,
  validate(updateProfileSchema),
  userController.updateProfile,
);

// Admin routes
userRouter.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.USERS_READ),
  userController.listUsers,
);
userRouter.patch(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.USERS_WRITE),
  validate(adminUpdateUserSchema),
  userController.adminUpdateUser,
);
userRouter.delete(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.USERS_DELETE),
  userController.deleteUser,
);
