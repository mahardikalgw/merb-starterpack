import type { Request, Response } from "express";
import * as userService from "../services/user.service";
import * as authService from "../services/auth.service";

export async function listUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const result = await userService.listUsers(page, limit);
  res.json(result);
}

export async function adminUpdateUser(req: Request, res: Response): Promise<void> {
  const user = await userService.adminUpdateUser(String(req.params.id), req.body);
  res.json({ user });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  await userService.deleteUser(String(req.params.id));
  res.status(204).send();
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const user = await userService.updateProfile(req.user!._id.toString(), req.body);
  res.json({ user });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getProfile(req.user!._id.toString());
  res.json({ user });
}
