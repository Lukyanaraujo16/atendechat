/* eslint-disable import/first */
const dispatch = jest.fn();
const findContact = jest.fn();
const findTicket = jest.fn();
const contactCreate = jest.fn();
const ticketCreate = jest.fn();
const messageCreate = jest.fn();

jest.mock("../../../../inbound/dispatchHumanInboundTicketPresence", () => ({
  dispatchHumanInboundTicketPresence: (...a: unknown[]) => dispatch(...a)
}));

jest.mock("../../../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findContact(...a),
    create: (...a: unknown[]) => contactCreate(...a)
  }
}));

jest.mock("../../../../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findTicket(...a),
    create: (...a: unknown[]) => ticketCreate(...a)
  }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    create: (...a: unknown[]) => messageCreate(...a)
  }
}));

jest.mock("../../../../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (jid: string) =>
    `${String(jid).split(":")[0].replace("@s.whatsapp.net", "")}@s.whatsapp.net`
}));

import fs from "fs";
import path from "path";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../../../../../helpers/whatsappUnavailablePresence";
import {
  processBaileysPresenceInbound,
  registerBaileysInboundPresenceListener,
  resolveBaileysOwnPresenceJid
} from "../processBaileysPresenceInbound";

const CLIENT = "5511999998888@s.whatsapp.net";
const OWN = "5511888887777@s.whatsapp.net";

describe("processBaileysPresenceInbound", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatch.mockResolvedValue({ emitted: true, ticketId: 77 });
  });

  const eligibleEvent = {
    id: CLIENT,
    presences: { [CLIENT]: { lastKnownPresence: "composing" } }
  };

  it("chama dispatch com companyId/whatsappId/remoteJid/presence quando elegível", async () => {
    const result = await processBaileysPresenceInbound({
      companyId: 9,
      whatsappId: 22,
      ownJid: OWN,
      event: eligibleEvent
    });
    expect(result).toEqual({
      outcome: "processed",
      reason: "composing",
      ticketId: 77
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      companyId: 9,
      whatsappId: 22,
      remoteJid: CLIENT,
      presence: "composing"
    });
    expect(Object.keys(dispatch.mock.calls[0][0]).sort()).toEqual([
      "companyId",
      "presence",
      "remoteJid",
      "whatsappId"
    ]);
  });

  it("skip não cria Contact/Ticket/Message e não despacha", async () => {
    const result = await processBaileysPresenceInbound({
      companyId: 1,
      whatsappId: 10,
      ownJid: OWN,
      event: { id: "120363@g.us", presences: {} }
    });
    expect(result.outcome).toBe("skipped");
    expect(dispatch).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(messageCreate).not.toHaveBeenCalled();
  });

  it("malformed não lança", async () => {
    await expect(
      processBaileysPresenceInbound({
        companyId: 1,
        whatsappId: 10,
        ownJid: OWN,
        event: null
      })
    ).resolves.toEqual({ outcome: "skipped", reason: "malformed" });
  });

  it("flag global de side-effect NÃO aparece no handler inbound", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../processBaileysPresenceInbound.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE/);
    expect(typeof isWhatsAppDisableAllReadAndPresenceSideEffects).toBe(
      "function"
    );
  });
});

describe("registerBaileysInboundPresenceListener", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatch.mockResolvedValue({ emitted: true, ticketId: 77 });
  });

  it("inscreve presence.update uma vez e não toca messages.upsert", async () => {
    const listeners: Record<string, Array<(data: unknown) => void>> = {};
    const wbot = {
      id: 22,
      user: { id: "5511888887777:3@s.whatsapp.net" },
      ev: {
        on: (event: string, cb: (data: unknown) => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        }
      }
    };
    registerBaileysInboundPresenceListener(wbot, { companyId: 9 });
    expect(Object.keys(listeners)).toEqual(["presence.update"]);
    expect(listeners["presence.update"]).toHaveLength(1);
    expect(listeners["messages.upsert"]).toBeUndefined();
    expect(listeners["messages.update"]).toBeUndefined();

    listeners["presence.update"][0]({
      id: CLIENT,
      presences: { [CLIENT]: { lastKnownPresence: "recording" } }
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(dispatch).toHaveBeenCalledWith({
      companyId: 9,
      whatsappId: 22,
      remoteJid: CLIENT,
      presence: "recording"
    });
  });

  it("reconnect: socket novo registra uma vez; StartWhatsAppSession não reinscreve o mesmo ev", () => {
    const listenersA: Record<string, number> = {};
    const sockA = {
      id: 1,
      user: { id: OWN },
      ev: {
        on: (event: string) => {
          listenersA[event] = (listenersA[event] || 0) + 1;
        }
      }
    };
    registerBaileysInboundPresenceListener(sockA, { companyId: 1 });
    expect(listenersA["presence.update"]).toBe(1);

    const listenersB: Record<string, number> = {};
    const sockB = {
      id: 1,
      user: { id: OWN },
      ev: {
        on: (event: string) => {
          listenersB[event] = (listenersB[event] || 0) + 1;
        }
      }
    };
    registerBaileysInboundPresenceListener(sockB, { companyId: 1 });
    expect(listenersB["presence.update"]).toBe(1);
  });

  it("wbotMessageListener registra o listener uma vez e não toca C2 outbound", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../../../services/WbotServices/wbotMessageListener.ts"
      ),
      "utf8"
    );
    expect(src).toMatch(/registerBaileysInboundPresenceListener\(wbot/);
    expect(src).not.toMatch(/sendPresenceUpdate/);
    expect(src).not.toMatch(/WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE/);
  });

  it("resolveBaileysOwnPresenceJid normaliza device suffix", () => {
    expect(
      resolveBaileysOwnPresenceJid("5511888887777:12@s.whatsapp.net")
    ).toBe(OWN);
    expect(resolveBaileysOwnPresenceJid(null)).toBeNull();
  });
});
