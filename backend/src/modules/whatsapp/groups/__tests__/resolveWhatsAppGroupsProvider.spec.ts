/* eslint-disable import/first */
const mockFromWhatsappId = jest.fn();
const mockGetWbot = jest.fn();

jest.mock("../../providers/baileys/groups/BaileysGroupsProvider", () => ({
  BaileysGroupsProvider: {
    fromWhatsappId: (...args: unknown[]) => mockFromWhatsappId(...args)
  }
}));

jest.mock("../../../../libs/wbot", () => ({
  getWbot: (...args: unknown[]) => mockGetWbot(...args)
}));

import AppError from "../../../../errors/AppError";
import { ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY } from "../groupsErrors";
import { getWhatsAppGroupsProviderForWhatsapp } from "../resolveWhatsAppGroupsProvider";

describe("getWhatsAppGroupsProviderForWhatsapp", () => {
  beforeEach(() => {
    mockFromWhatsappId.mockReset();
    mockGetWbot.mockReset();
    mockFromWhatsappId.mockReturnValue({ provider: "baileys" });
  });

  it("Baileys resolve BaileysGroupsProvider", async () => {
    const provider = await getWhatsAppGroupsProviderForWhatsapp({
      id: 10,
      connectionProvider: "baileys"
    } as never);

    expect(provider).toEqual({ provider: "baileys" });
    expect(mockFromWhatsappId).toHaveBeenCalledWith(10);
  });

  it("connectionProvider omitido continua Baileys", async () => {
    await getWhatsAppGroupsProviderForWhatsapp({ id: 3 } as never);
    expect(mockFromWhatsappId).toHaveBeenCalledWith(3);
  });

  it("Evolution devolve NOT_READY e não chama getWbot", async () => {
    expect.assertions(5);
    try {
      await getWhatsAppGroupsProviderForWhatsapp({
        id: 22,
        connectionProvider: "evolution",
        status: "CONNECTED"
      } as never);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe(
        ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY
      );
      expect((err as AppError).statusCode).toBe(503);
    }
    expect(mockGetWbot).not.toHaveBeenCalled();
    expect(mockFromWhatsappId).not.toHaveBeenCalled();
  });
});
