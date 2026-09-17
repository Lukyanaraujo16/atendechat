/* eslint-disable import/first */
const mockFromWhatsappId = jest.fn();
const mockFromEvolution = jest.fn();
const mockGetWbot = jest.fn();

jest.mock("../../providers/baileys/groups/BaileysGroupsProvider", () => ({
  BaileysGroupsProvider: {
    fromWhatsappId: (...args: unknown[]) => mockFromWhatsappId(...args)
  }
}));

jest.mock("../../providers/evolution/groups/EvolutionGroupsProvider", () => ({
  EvolutionGroupsProvider: {
    fromWhatsapp: (...args: unknown[]) => mockFromEvolution(...args)
  }
}));

jest.mock("../../../../libs/wbot", () => ({
  getWbot: (...args: unknown[]) => mockGetWbot(...args)
}));

import { getWhatsAppGroupsProviderForWhatsapp } from "../resolveWhatsAppGroupsProvider";

describe("getWhatsAppGroupsProviderForWhatsapp", () => {
  beforeEach(() => {
    mockFromWhatsappId.mockReset();
    mockFromEvolution.mockReset();
    mockGetWbot.mockReset();
    mockFromWhatsappId.mockReturnValue({ provider: "baileys" });
    mockFromEvolution.mockReturnValue({ provider: "evolution" });
  });

  it("Baileys resolve BaileysGroupsProvider", async () => {
    const provider = await getWhatsAppGroupsProviderForWhatsapp({
      id: 10,
      connectionProvider: "baileys"
    } as never);

    expect(provider).toEqual({ provider: "baileys" });
    expect(mockFromWhatsappId).toHaveBeenCalledWith(10);
    expect(mockFromEvolution).not.toHaveBeenCalled();
  });

  it("connectionProvider omitido continua Baileys", async () => {
    await getWhatsAppGroupsProviderForWhatsapp({ id: 3 } as never);
    expect(mockFromWhatsappId).toHaveBeenCalledWith(3);
    expect(mockFromEvolution).not.toHaveBeenCalled();
  });

  it("Evolution resolve EvolutionGroupsProvider e não chama getWbot", async () => {
    const provider = await getWhatsAppGroupsProviderForWhatsapp({
      id: 22,
      connectionProvider: "evolution",
      status: "CONNECTED"
    } as never);

    expect(provider).toEqual({ provider: "evolution" });
    expect(mockFromEvolution).toHaveBeenCalledWith(
      expect.objectContaining({ id: 22, connectionProvider: "evolution" })
    );
    expect(mockFromWhatsappId).not.toHaveBeenCalled();
    expect(mockGetWbot).not.toHaveBeenCalled();
  });
});
