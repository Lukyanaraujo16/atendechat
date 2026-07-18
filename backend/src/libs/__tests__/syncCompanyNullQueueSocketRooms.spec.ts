import { allowsNullQueueVisibility } from "../../helpers/unassignedTicketsVisibility";

/**
 * Simula a lógica de sync de rooms queue-null após troca A→B.
 */
describe("syncCompanyNullQueueSocketRooms logic", () => {
  it("usuário do setor A perde allow após troca para B", () => {
    expect(allowsNullQueueVisibility([10], false, 10)).toBe(true);
    expect(allowsNullQueueVisibility([10], false, 20)).toBe(false);
  });

  it("usuário do setor B ganha allow após troca para B", () => {
    expect(allowsNullQueueVisibility([20], false, 10)).toBe(false);
    expect(allowsNullQueueVisibility([20], false, 20)).toBe(true);
  });

  it("limpar contingência remove allow (exceto allTicket)", () => {
    expect(allowsNullQueueVisibility([10], false, null)).toBe(false);
    expect(allowsNullQueueVisibility([10], true, null)).toBe(true);
  });

  it("rooms: leave sempre; join só se allow e já subscrito", () => {
    const simulate = (
      subscribedPending: boolean,
      allow: boolean
    ): { pending: boolean } => {
      let inNullPending = subscribedPending;
      // leave
      inNullPending = false;
      if (allow && subscribedPending) {
        inNullPending = true;
      }
      return { pending: inNullPending };
    };

    expect(simulate(true, false).pending).toBe(false);
    expect(simulate(true, true).pending).toBe(true);
    expect(simulate(false, true).pending).toBe(false);
  });
});
