/**
 * Valida contrato da migration de unassignedTicketsQueueId sem DB real.
 */
describe("migration 20260718230000-add-company-unassigned-tickets-queue", () => {
  it("up cria coluna com FK Queues e ON DELETE SET NULL; down remove", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const queryInterface = {
      addColumn: async (...args: unknown[]) => {
        calls.push({ method: "addColumn", args });
      },
      removeColumn: async (...args: unknown[]) => {
        calls.push({ method: "removeColumn", args });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const migration = require("../../database/migrations/20260718230000-add-company-unassigned-tickets-queue");

    await migration.up(queryInterface);
    expect(calls[0].method).toBe("addColumn");
    expect(calls[0].args[0]).toBe("Companies");
    expect(calls[0].args[1]).toBe("unassignedTicketsQueueId");
    const opts = calls[0].args[2] as {
      allowNull: boolean;
      references: { model: string; key: string };
      onDelete: string;
      onUpdate: string;
    };
    expect(opts.allowNull).toBe(true);
    expect(opts.references).toEqual({ model: "Queues", key: "id" });
    expect(opts.onDelete).toBe("SET NULL");
    expect(opts.onUpdate).toBe("CASCADE");

    await migration.down(queryInterface);
    expect(calls[1].method).toBe("removeColumn");
    expect(calls[1].args[0]).toBe("Companies");
    expect(calls[1].args[1]).toBe("unassignedTicketsQueueId");
  });
});
