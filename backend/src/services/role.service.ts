import { Role } from "../models/role.model";
import { User } from "../models/user.model";
import { ApiError } from "../lib/errors";
import { ALL_PERMISSIONS } from "../lib/permissions";

export async function listRoles() {
  return Role.find().sort({ name: 1 });
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions: string[];
}) {
  const name = input.name.toLowerCase().trim();
  const existing = await Role.findOne({ name });
  if (existing) throw ApiError.conflict(`Role "${name}" already exists`);

  const invalid = input.permissions.filter((p) => !ALL_PERMISSIONS.includes(p as never) && p !== "*");
  if (invalid.length) {
    throw ApiError.badRequest(`Unknown permission(s): ${invalid.join(", ")}`);
  }
  return Role.create({ ...input, name, isSystem: false });
}

export async function updateRole(
  roleId: string,
  patch: { description?: string; permissions?: string[] },
) {
  const role = await Role.findById(roleId);
  if (!role) throw ApiError.notFound("Role not found");

  if (patch.permissions !== undefined) {
    if (role.isSystem) {
      throw ApiError.forbidden("System roles cannot be modified");
    }
    const invalid = patch.permissions.filter(
      (p) => !ALL_PERMISSIONS.includes(p as never) && p !== "*",
    );
    if (invalid.length) {
      throw ApiError.badRequest(`Unknown permission(s): ${invalid.join(", ")}`);
    }
    role.permissions = patch.permissions as never;
  }
  if (patch.description !== undefined) role.description = patch.description;

  await role.save();
  return role;
}

export async function deleteRole(roleId: string): Promise<void> {
  const role = await Role.findById(roleId);
  if (!role) throw ApiError.notFound("Role not found");
  if (role.isSystem) throw ApiError.forbidden("System roles cannot be deleted");

  const inUse = await User.countDocuments({ role: role._id });
  if (inUse > 0) {
    throw ApiError.conflict(`Role is assigned to ${inUse} user(s)`);
  }
  await role.deleteOne();
}
