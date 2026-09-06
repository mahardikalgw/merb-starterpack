import { describe, expect, test } from "bun:test";
import { ALL_PERMISSIONS, PERMISSIONS, ROLES } from "../src/lib/permissions";
import { signAccessToken, verifyAccessToken } from "../src/lib/jwt";

describe("permissions", () => {
  test("follows resource:action convention", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(p).toMatch(/^[a-z]+:[a-z]+$|\*/);
    }
  });

  test("contains required permissions", () => {
    expect(PERMISSIONS.USERS_READ).toBe("users:read");
    expect(PERMISSIONS.ROLES_MANAGE).toBe("roles:manage");
    expect(ROLES.ADMIN).toBe("admin");
  });
});

describe("jwt", () => {
  test("signs and verifies an access token", () => {
    const token = signAccessToken("507f1f77bcf86cd799439011", "a@b.com");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("507f1f77bcf86cd799439011");
    expect(payload.email).toBe("a@b.com");
    expect(payload.type).toBe("access");
  });

  test("rejects tampered tokens", () => {
    const token = signAccessToken("507f1f77bcf86cd799439011", "a@b.com");
    expect(() => verifyAccessToken(token + "x")).toThrow();
  });
});

describe("password hashing (Bun.password)", () => {
  test("hashes and verifies", async () => {
    const hash = await Bun.password.hash("Password123");
    expect(await Bun.password.verify("Password123", hash)).toBe(true);
    expect(await Bun.password.verify("wrong", hash)).toBe(false);
  });
});
