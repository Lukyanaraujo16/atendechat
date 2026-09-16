/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

const createEvent = jest.fn();
const findContact = jest.fn();
const findTicket = jest.fn();
const emit = jest.fn();
const to = jest.fn(() => ({ emit }));

jest.mock("../../../../../../libs/socket", () => ({
  getIO: () => ({ to })
}));

jest.mock(
  "../../../../../../services/CompanyService/adjustCompanyStorageUsage",
  () => ({
    incrementCompanyStorageUsage: jest.fn()
  })
);

jest.mock("../processEvolutionTextInbound", () => ({
  processEvolutionTextInbound: jest.fn()
}));

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findContact(...a),
    create: jest.fn()
  }
}));

jest.mock("../../../../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: (...a: unknown[]) => findTicket(...a), create: jest.fn() }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() }
}));

jest.mock("../../../../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import fs from "fs";
import path from "path";
import Contact from "../../../../../../models/Contact";
import Message from "../../../../../../models/Message";
import Ticket from "../../../../../../models/Ticket";
import { processEvolutionWebhook } from "../processEvolutionWebhook";
import { resetHumanInboundPresenceThrottleForTests } from "../../../../inbound/dispatchHumanInboundTicketPresence";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../../../../../helpers/whatsappUnavailablePresence";

const CLIENT = "5511999998888@s.whatsapp.net";
const OWN = "5511888887777@s.whatsapp.net";

describe("processEvolutionWebhook PRESENCE_UPDATE", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHumanInboundPresenceThrottleForTests();
    findContact.mockResolvedValue({ id: 5 });
    findTicket.mockResolvedValue({ id: 77, status: "open" });
    createEvent.mockResolvedValue({ id: 1, update: jest.fn() });
  });

  function presenceBody(presence = "composing") {
    return {
      event: "presence.update",
      instance: "inst",
      sender: OWN,
      apikey: "secret-should-not-persist",
      data: {
        id: CLIENT,
        presences: { [CLIENT]: { lastKnownPresence: presence } }
      }
    };
  }

  it("despacha ANTES do fluxo persistente e NÃO cria EvolutionWebhookEvent", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: presenceBody(),
      apiKeyValid: true
    });
    expect(result.outcome).toBe("processed");
    expect(result.ticketId).toBe(77);
    expect(createEvent).not.toHaveBeenCalled();
    expect(to).toHaveBeenCalledWith("77");
    expect(emit).toHaveBeenCalledWith("company-1-ticketPresence", {
      ticketId: 77,
      presence: "composing"
    });
  });

  it("evento conhecido PRESENCE_UPDATE maiúsculo", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: { ...presenceBody(), event: "PRESENCE_UPDATE" },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("processed");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("payload ignorável não gera 5xx nem persistência", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: presenceBody("available"),
      apiKeyValid: true
    });
    expect(result.outcome).toBe("skipped");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("grupo não persiste e não emite", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "presence.update",
        sender: OWN,
        data: {
          id: "120363@g.us",
          presences: { [CLIENT]: { lastKnownPresence: "composing" } }
        }
      },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBe("group");
    expect(createEvent).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("@lid sem PN não persiste, não 5xx e não emite", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "presence.update",
        sender: OWN,
        data: {
          id: "123456789012345@lid",
          presences: {
            "123456789012345@lid": { lastKnownPresence: "composing" }
          }
        }
      },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBe("lid_without_pn");
    expect(createEvent).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("não cria Contact/Ticket/Message", async () => {
    await processEvolutionWebhook({
      whatsapp,
      body: presenceBody(),
      apiKeyValid: true
    });
    expect(Contact.create).not.toHaveBeenCalled();
    expect(Ticket.create).not.toHaveBeenCalled();
    expect(Message.create).not.toHaveBeenCalled();
  });

  it("flag global de side-effect NÃO aparece no handler inbound", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../processEvolutionPresenceInbound.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE/);
    expect(typeof isWhatsAppDisableAllReadAndPresenceSideEffects).toBe(
      "function"
    );
  });

  it("payload ignorável não usa outcome error", async () => {
    const result = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "presence.update",
        sender: OWN,
        data: { id: CLIENT }
      },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("skipped");
    expect(result.outcome).not.toBe("error");
    expect(createEvent).not.toHaveBeenCalled();
  });
});
