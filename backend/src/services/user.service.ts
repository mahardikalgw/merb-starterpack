import { User, type PopulatedUser } from "../models/user.model";
import { Role } from "../models/role.model";
import { ApiError } from "../lib/errors";

function toPublicUser(obj: PopulatedUser) {
  const role = typeof obj.role === "object" ? obj.role : undefined;
  return {
    id: obj._id,
    name: obj.name,
    email: obj.email,
    isActive: obj.isActive,
    role: role
      ? { id: role._id, name: role.name, permissions: role.permissions }
      : undefined,
    createdAt: obj.createdAt,
  };
}

export async function listUsers(page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    User.find({})
      .populate("role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments({}),
  ]);
  return {
    data: items.map((u) => toPublicUser(u.toObject() as unknown as PopulatedUser)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function adminUpdateUser(
  userId: string,
  patch: { name?: string; isActive?: boolean; role?: string },
) {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.isActive !== undefined) update.isActive = patch.isActive;
  if (patch.role !== undefined) {
    const role = await Role.findOne({ name: patch.role.toLowerCase() });
    if (!role) throw ApiError.badRequest(`Unknown role: ${patch.role}`);
    update.role = role._id;
  }
  if (Object.keys(update).length === 0) {
    throw ApiError.badRequest("No valid fields to update");
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).populate("role");
  if (!user) throw ApiError.notFound("User not found");

  if (patch.isActive === false) {
    const { revokeAllUserTokens } = await import("../models/token.model");
    await revokeAllUserTokens(user._id);
  }
  return user;
}

export async function deleteUser(userId: string): Promise<void> {
  const user = await User.findByIdAndDelete(userId);
  if (!user) throw ApiError.notFound("User not found");
}

/** Update the current user's own profile. */
export async function updateProfile(
  userId: string,
  patch: { name?: string },
): Promise<ReturnType<typeof toPublicUser>> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: patch },
    { new: true, runValidators: true },
  ).populate("role");
  if (!user) throw ApiError.notFound("User not found");
  return toPublicUser(user.toObject() as unknown as PopulatedUser);
}
