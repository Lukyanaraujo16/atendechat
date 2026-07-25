/**
 * Contrato da migration PlatformUserPermissions (sem DB real).
 */
describe("migration 20260725120000-create-platform-user-permissions", () => {
  it("up cria tabela, índices e seed; down dropa tabela", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const queryInterface: any = {
      createTable: async (...args: unknown[]) => {
        calls.push({ method: "createTable", args });
      },
      addIndex: async (...args: unknown[]) => {
        calls.push({ method: "addIndex", args });
      },
      dropTable: async (...args: unknown[]) => {
        calls.push({ method: "dropTable", args });
      },
      sequelize: {
        getDialect: () => "postgres",
        query: async (...args: unknown[]) => {
          calls.push({ method: "query", args });
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const migration = require("../../database/migrations/20260725120000-create-platform-user-permissions");

    await migration.up(queryInterface);

    expect(calls[0].method).toBe("createTable");
    expect(calls[0].args[0]).toBe("PlatformUserPermissions");
    const cols = calls[0].args[1] as Record<string, any>;
    expect(cols.userId.references).toEqual({ model: "Users", key: "id" });
    expect(cols.userId.onDelete).toBe("CASCADE");
    expect(cols.permissionKey.allowNull).toBe(false);
    expect(cols.enabled.defaultValue).toBe(true);
    expect(cols).not.toHaveProperty("companyId");

    const uniqueIdx = calls.find(
      c =>
        c.method === "addIndex" &&
        (c.args[2] as any)?.name ===
          "PlatformUserPermissions_userId_permissionKey_unique"
    );
    expect(uniqueIdx).toBeTruthy();
    expect((uniqueIdx!.args[2] as any).unique).toBe(true);

    const seed = calls.find(c => c.method === "query");
    expect(seed).toBeTruthy();
    const sql = String(seed!.args[0]);
    expect(sql).toContain("PlatformUserPermissions");
    expect(sql).toContain("superadmin");
    expect(sql).toContain("NOT EXISTS");

    await migration.down(queryInterface);
    const drop = calls.find(c => c.method === "dropTable");
    expect(drop?.args[0]).toBe("PlatformUserPermissions");
  });
});
