/* eslint-disable import/first */
const mockFindOne = jest.fn();
const mockShow = jest.fn();
const mockAssociate = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findOne: (...a: unknown[]) => mockFindOne(...a) }
}));

jest.mock("../ShowWhatsAppService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => mockShow(...a)
}));

jest.mock("../AssociateWhatsappQueue", () => ({
  __esModule: true,
  default: (...a: unknown[]) => mockAssociate(...a)
}));

jest.mock("../assertNoAiAgentFieldsInWhatsappPayload", () => ({
  assertNoAiAgentFieldsInWhatsappPayload: jest.fn()
}));

import { ERR_WHATSAPP_CONNECTION_PROVIDER_IMMUTABLE } from "../../../modules/whatsapp/providers/evolution/evolutionErrors";
import UpdateWhatsAppService from "../UpdateWhatsAppService";

describe("UpdateWhatsAppService — connectionProvider imutável", () => {
  beforeEach(() => {
    mockFindOne.mockReset();
    mockShow.mockReset();
    mockAssociate.mockReset();
    mockUpdate.mockReset();
    mockAssociate.mockResolvedValue(undefined);
    mockFindOne.mockResolvedValue(null);
  });

  it("rejeita troca baileys → evolution", async () => {
    mockShow.mockResolvedValue({
      id: 8,
      companyId: 19,
      connectionProvider: "baileys",
      name: "Bai",
      update: mockUpdate
    });

    await expect(
      UpdateWhatsAppService({
        whatsappId: "8",
        companyId: 19,
        whatsappData: {
          name: "Bai",
          connectionProvider: "evolution"
        }
      })
    ).rejects.toMatchObject({
      message: ERR_WHATSAPP_CONNECTION_PROVIDER_IMMUTABLE,
      statusCode: 400
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("mesmo provider não grava connectionProvider no update", async () => {
    mockShow.mockResolvedValue({
      id: 8,
      companyId: 19,
      connectionProvider: "evolution",
      name: "Evo",
      update: mockUpdate
    });
    mockUpdate.mockResolvedValue(undefined);

    await UpdateWhatsAppService({
      whatsappId: "8",
      companyId: 19,
      whatsappData: {
        name: "Evo",
        connectionProvider: "evolution",
        queueIds: []
      }
    });

    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("connectionProvider");
  });

  it("ShowWhatsAppService usa companyId autenticado", async () => {
    mockShow.mockResolvedValue({
      id: 3,
      companyId: 19,
      connectionProvider: "baileys",
      name: "Xa",
      update: mockUpdate
    });
    mockUpdate.mockResolvedValue(undefined);

    await UpdateWhatsAppService({
      whatsappId: "3",
      companyId: 19,
      whatsappData: { name: "Xa", queueIds: [] }
    });

    expect(mockShow).toHaveBeenCalledWith("3", 19);
  });
});
