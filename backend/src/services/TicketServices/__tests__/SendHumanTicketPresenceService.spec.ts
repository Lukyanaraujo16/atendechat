/* eslint-disable import/first */
import fs from "fs";
import path from "path";
import AppError from "../../../errors/AppError";

const sendPresence = jest.fn();
const getOutbound = jest.fn();
const showTicket = jest.fn();
const getRemoteJid = jest.fn();
const assertAccess = jest.fn();
const createMessage = jest.fn();
const isPresenceDisabled = jest.fn(() => false);

jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => showTicket(...a)
}));

jest.mock("../../../helpers/ticketAccess", () => ({
  assertUserCanAccessTicketResource: (...a: unknown[]) => assertAccess(...a),
  toTicketAccessPayload: (t: unknown) => t
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: (...a: unknown[]) => getRemoteJid(...a)
}));

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: () => isPresenceDisabled()
}));

jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => createMessage(...a)
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (j: string) => j
}));

import Message from "../../../models/Message";
import SendHumanTicketPresenceService, {
  resetHumanPresenceThrottleForTests
} from "../SendHumanTicketPresenceService";

const messageCreate = Message.create as jest.Mock;

function actor() {
  return { id: 9, profile: "admin" };
}

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    companyId: 1,
    status: "open",
    channel: "whatsapp",
    whatsappId: 11,
    isGroup: false,
    contact: { number: "5511999998888", isGroup: false },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

async function send(
  presence: unknown,
  ticket = ticketRow(),
  extras: { companyId?: number } = {}
) {
  showTicket.mockResolvedValue(ticket);
  return SendHumanTicketPresenceService({
    ticketId: Number(ticket.id),
    companyId: extras.companyId ?? 1,
    actor: actor(),
    presence
  });
}

describe("SendHumanTicketPresenceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetHumanPresenceThrottleForTests();
    isPresenceDisabled.mockReturnValue(false);
    assertAccess.mockResolvedValue(undefined);
    getRemoteJid.mockResolvedValue("5511999998888@s.whatsapp.net");
    sendPresence.mockResolvedValue(true);
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendPresence: (...a: unknown[]) => sendPresence(...a)
    });
  });

  it("Evolution: composing resolve o provider e chama sendPresence", async () => {
    const result = await send("composing");
    expect(result).toEqual({ sent: true });
    expect(getOutbound).toHaveBeenCalledTimes(1);
    expect(getOutbound.mock.calls[0][0].whatsappId).toBe(11);
    expect(getOutbound.mock.calls[0][0].channel).toBe("whatsapp");
    expect(sendPresence).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      presence: "composing",
      subscribe: true
    });
    expect(messageCreate).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("Evolution: paused chama sendPresence paused", async () => {
    await send("paused");
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ presence: "paused", subscribe: false })
    );
  });

  it("Baileys: usa o mesmo service/boundary", async () => {
    getOutbound.mockResolvedValue({
      provider: "baileys",
      sendPresence: (...a: unknown[]) => sendPresence(...a)
    });
    const result = await send("composing");
    expect(result.sent).toBe(true);
    expect(getOutbound).toHaveBeenCalledTimes(1);
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ presence: "composing" })
    );
  });

  it("não exige provider Evolution/Baileys no pedido", async () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../SendHumanTicketPresenceService.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/req\.body\.provider/);
    expect(src).not.toMatch(/connectionProvider/);
    await send("composing");
    expect(getOutbound).toHaveBeenCalled();
  });

  it("Instagram: não dispara presence WhatsApp", async () => {
    const result = await send(
      "composing",
      ticketRow({ channel: "instagram", whatsappId: null })
    );
    expect(result).toEqual({ sent: false, skipped: "instagram" });
    expect(getOutbound).not.toHaveBeenCalled();
    expect(sendPresence).not.toHaveBeenCalled();
  });

  it("grupo: não dispara nesta fase", async () => {
    const result = await send(
      "composing",
      ticketRow({ isGroup: true, contact: { isGroup: true, number: "120363" } })
    );
    expect(result).toEqual({ sent: false, skipped: "group" });
    expect(getOutbound).not.toHaveBeenCalled();
  });

  it("tenant inválido: não atinge conexão de outra empresa", async () => {
    showTicket.mockRejectedValue(
      new AppError("Não é possível consultar registros de outra empresa")
    );
    await expect(
      SendHumanTicketPresenceService({
        ticketId: 3,
        companyId: 99,
        actor: actor(),
        presence: "composing"
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(getOutbound).not.toHaveBeenCalled();
    expect(sendPresence).not.toHaveBeenCalled();
  });

  it("presence inválido é rejeitado", async () => {
    await expect(send("unavailable")).rejects.toMatchObject({
      message: "ERR_INVALID_PRESENCE",
      statusCode: 400
    });
    await expect(send("recording")).rejects.toMatchObject({
      message: "ERR_INVALID_PRESENCE"
    });
    await expect(send("available")).rejects.toMatchObject({
      message: "ERR_INVALID_PRESENCE"
    });
    expect(showTicket).not.toHaveBeenCalled();
    expect(getOutbound).not.toHaveBeenCalled();
  });

  it("flag global desabilita side effect no WhatsApp", async () => {
    isPresenceDisabled.mockReturnValue(true);
    const result = await send("composing");
    expect(result).toEqual({ sent: false, skipped: "presence_disabled" });
    expect(getOutbound).not.toHaveBeenCalled();
    expect(sendPresence).not.toHaveBeenCalled();
  });

  it("não cria Message nem altera ticket", async () => {
    const ticket = ticketRow();
    await send("composing", ticket);
    await send("paused", ticket);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
    expect(ticket.update).not.toHaveBeenCalled();
  });

  it("erro do provider é best-effort e não persiste Message", async () => {
    sendPresence.mockRejectedValue(new Error("evolution timeout"));
    const ticket = ticketRow();
    const result = await send("composing", ticket);
    expect(result).toEqual({ sent: false, skipped: "provider_error" });
    expect(ticket.update).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
    expect(createMessage).not.toHaveBeenCalled();
  });

  it("ticket fechado não envia composing", async () => {
    const result = await send("composing", ticketRow({ status: "closed" }));
    expect(result).toEqual({ sent: false, skipped: "not_open" });
    expect(getOutbound).not.toHaveBeenCalled();
  });

  it("sem whatsappId não resolve default nem muta ticket", async () => {
    const ticket = ticketRow({ whatsappId: null });
    const result = await send("composing", ticket);
    expect(result).toEqual({ sent: false, skipped: "no_connection" });
    expect(getOutbound).not.toHaveBeenCalled();
    expect(ticket.update).not.toHaveBeenCalled();
  });

  it("sem jid resolvível não chama outbound", async () => {
    getRemoteJid.mockResolvedValue(null);
    const result = await send(
      "composing",
      ticketRow({ contact: { number: "", isGroup: false } })
    );
    expect(result).toEqual({ sent: false, skipped: "no_jid" });
    expect(getOutbound).not.toHaveBeenCalled();
  });

  it("rota HTTP autenticada existe no router de tickets", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../../../routes/ticketRoutes.ts"),
      "utf8"
    );
    expect(src).toMatch(
      /ticketRoutes\.post\(\s*"\/tickets\/:ticketId\/presence"/
    );
    expect(src).toMatch(/TicketController\.sendHumanPresence/);
    expect(src).not.toMatch(/PRESENCE_UPDATE/);
  });
});
