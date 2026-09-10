import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

const users = [{ id: "u1", tenantId: "t1", type: "ADMIN", email: "a@loja.test" }];

mock.module("../../config/prisma.js", {
  namedExports: {
    prisma: {
      user: {
        findMany: async () => users,
        findFirst: async ({ where }) =>
          users.find((u) => (!where.id || u.id === where.id) && (!where.email || u.email === where.email)) || null,
        count: async ({ where }) =>
          users.filter((u) => {
            if (where.type === "ADMIN") {
              return u.type === "ADMIN" && (!where.id?.not || u.id !== where.id.not);
            }
            return !where.tenantId || u.tenantId === where.tenantId;
          }).length,
        create: async ({ data }) => ({ id: "u-new", ...data }),
        updateMany: async () => ({ count: 1 }),
        deleteMany: async () => ({ count: 1 })
      }
    }
  }
});

const { userRepository } = await import("./user.repository.js");

describe("userRepository", () => {
  it("lista, conta admins e e-mail", async () => {
    assert.equal((await userRepository.listByTenant("t1"))[0].id, "u1");
    assert.equal((await userRepository.findPublicById("t1", "u1")).id, "u1");
    assert.equal(await userRepository.countByTenant("t1"), 1);
    assert.equal(await userRepository.countAdmins("t1"), 1);
    assert.equal(await userRepository.countAdmins("t1", "u1"), 0);
    assert.equal((await userRepository.findByEmail("t1", "a@loja.test")).id, "u1");
    assert.equal((await userRepository.create("t1", { name: "B" })).id, "u-new");
    assert.equal((await userRepository.update("t1", "u1", { name: "A2" })).count, 1);
    assert.equal((await userRepository.delete("t1", "u1")).count, 1);
  });
});
