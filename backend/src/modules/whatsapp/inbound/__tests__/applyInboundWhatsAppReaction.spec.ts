/* eslint-disable import/first */
const findOne = jest.fn();
const findByPk = jest.fn();
const mockEmit = jest.fn();

jest.mock("../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({
      emit: (...args: unknown[]) => mockEmit(...args)
    })
  })
}));

jest.mock("../../../../services/MessageServices/CreateMessageService", () => ({
  serializeMessageForClient: (m: unknown) => m
}));

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findOne(...a),
    findByPk: (...a: unknown[]) => findByPk(...a)
  }
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {}
}));

import {
  applyInboundWhatsAppReaction,
  mergeWhatsAppReactions,
  WHATSAPP_REACTIONS_META_KEY
} from "../applyInboundWhatsAppReaction";

function targetRow(overrides: Record<string, unknown> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  return {
    id: "TARGET1",
    ticketId: 77,
    companyId: 1,
    body: "Teste de mensagem",
    isDeleted: false,
    metaPayload: null,
    ticket: { id: 77, whatsappId: 10 },
    update,
    ...overrides
  };
}

describe("applyInboundWhatsAppReaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("grava emoji no alvo, emite update e não cria nova Message", async () => {
    const row = targetRow();
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);

    const result = await applyInboundWhatsAppReaction({
      companyId: 1,
      whatsappId: 10,
      reactorMessageId: "R1",
      fromMe: false,
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: null,
      reaction: { targetStanzaId: "TARGET1", emoji: "😂" }
    });

    expect(result).toMatchObject({
      outcome: "updated",
      targetMessageId: "TARGET1",
      ticketId: 77
    });
    expect(row.update).toHaveBeenCalledWith({
      metaPayload: expect.objectContaining({
        [WHATSAPP_REACTIONS_META_KEY]: [
          expect.objectContaining({
            emoji: "😂",
            fromMe: false,
            reactorMessageId: "R1"
          })
        ]
      })
    });
    expect(mockEmit).toHaveBeenCalledWith(
      "company-1-appMessage",
      expect.objectContaining({ action: "update" })
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 1, externalMessageId: "TARGET1" }
      })
    );
  });

  it("replay do mesmo emoji é noop", async () => {
    const row = targetRow({
      metaPayload: {
        [WHATSAPP_REACTIONS_META_KEY]: [
          {
            emoji: "😂",
            fromMe: false,
            reactorMessageId: "R1",
            reactorKey: "5511999998888@s.whatsapp.net",
            updatedAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      }
    });
    findOne.mockResolvedValue(row);

    const result = await applyInboundWhatsAppReaction({
      companyId: 1,
      whatsappId: 10,
      reactorMessageId: "R1",
      fromMe: false,
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: null,
      reaction: { targetStanzaId: "TARGET1", emoji: "😂" }
    });

    expect(result.outcome).toBe("noop");
    expect(row.update).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("troca de emoji substitui a reação do mesmo remetente", () => {
    const merged = mergeWhatsAppReactions(
      [
        {
          emoji: "😂",
          fromMe: false,
          reactorMessageId: "R1",
          reactorKey: "peer",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      {
        emoji: "❤️",
        fromMe: false,
        reactorMessageId: "R2",
        reactorKey: "peer",
        updatedAt: "2026-01-02T00:00:00.000Z"
      }
    );
    expect(merged.changed).toBe(true);
    expect(merged.list).toHaveLength(1);
    expect(merged.list[0].emoji).toBe("❤️");
  });

  it("alvo de outro tenant/whatsapp não é atualizado", async () => {
    findOne.mockResolvedValue(null);
    const result = await applyInboundWhatsAppReaction({
      companyId: 1,
      whatsappId: 10,
      reactorMessageId: "R1",
      fromMe: false,
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: null,
      reaction: { targetStanzaId: "FOREIGN", emoji: "😂" }
    });
    expect(result).toEqual({
      outcome: "skipped",
      reason: "reaction_target_not_found"
    });
  });

  it("whatsappId divergente no ticket é rejeitado pelo lookup", async () => {
    findOne.mockResolvedValue(
      targetRow({ ticket: { id: 77, whatsappId: 99 } })
    );
    const result = await applyInboundWhatsAppReaction({
      companyId: 1,
      whatsappId: 10,
      reactorMessageId: "R1",
      fromMe: false,
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: null,
      reaction: { targetStanzaId: "TARGET1", emoji: "😂" }
    });
    expect(result.outcome).toBe("skipped");
    expect(result).toMatchObject({ reason: "reaction_target_not_found" });
  });
});
