import type { Request, Response } from "express";
import * as roleService from "../services/role.service";

export async function listRoles(_req: Request, res: Response): Promise<void> {
  const roles = await roleService.listRoles();
  res.json({ data: roles });
}

export async function createRole(req: Request, res: Response): Promise<void> {
  const role = await roleService.createRole(req.body);
  res.status(201).json({ role });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const role = await roleService.updateRole(String(req.params.id), req.body);
  res.json({ role });
}

export async function deleteRole(req: Request, res: Response): Promise<void> {
  await roleService.deleteRole(String(req.params.id));
  res.status(204).send();
}
