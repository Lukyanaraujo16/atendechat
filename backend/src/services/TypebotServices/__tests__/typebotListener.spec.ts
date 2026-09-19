/* eslint-disable import/first */
import fs from "fs";
import path from "path";

const sendText = jest.fn();
const sendContent = jest.fn();
const sendPresence = jest.fn();
const updateTicket = jest.fn();
const getTicketRemoteJid = jest.fn();
const axiosRequest = jest.fn();
const updateTicketService = jest.fn();

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: jest.fn()
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: (...a: unknown[]) => getTicketRemoteJid(...a)
}));

jest.mock("../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => updateTicketService(...a)
}));

jest.mock("../../../helpers/whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: () => true
}));

import typebotListener from "../typebotListener";
import { getWhatsAppOutboundForTicket } from "../../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import { createTypebotLegacyUrlMediaSender } from "../typebotLegacyMedia";

const getOutbound = getWhatsAppOutboundForTicket as jest.Mock;

function typebotCfg(partial: Record<string, unknown> = {}) {
  return {
    id: 9,
    urlN8N: "https://typebot.example",
    typebotExpires: 0,
    typebotKeywordFinish: "#sair",
    typebotKeywordRestart: "#reiniciar",
    typebotUnknownMessage: "nao entendi",
    typebotSlug: "bot-a",
    typebotDelayMessage: 0,
    typebotRestartMessage: "reiniciado",
    ...partial
  } as never;
}

function ticket(partial: Record<string, unknown> = {}) {
  return {
    id: 77,
    companyId: 1,
    whatsappId: 10,
    isGroup: false,
    typebotSessionId: "sess-1",
    typebotStatus: true,
    updatedAt: new Date(),
    contact: { number: "5511999998888", name: "Ana" },
    update: updateTicket,
    reload: jest.fn(),
    ...partial
  } as never;
}

describe("typebotListener 12.3-C", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendText.mockResolvedValue({ messageId: "S1" });
    sendContent.mockResolvedValue({ messageId: "M1" });
    sendPresence.mockResolvedValue(true);
    updateTicket.mockResolvedValue(undefined);
    updateTicketService.mockResolvedValue(undefined);
    getTicketRemoteJid.mockResolvedValue(null);
    axiosRequest.mockResolvedValue({ data: { messages: [] } });
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendText,
      sendContent,
      sendPresence
    });
  });

  it("texto usa WhatsAppOutbound.sendText e não WASocket", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: "ola" }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "oi",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "ola"
    });
    expect(sendContent).not.toHaveBeenCalled();
    expect(getOutbound).toHaveBeenCalled();
  });

  it("choice input é enviado como texto", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: { richText: [{ children: [{ text: "escolha" }] }] }
          }
        ],
        input: {
          type: "choice input",
          items: [{ content: "A" }, { content: "B" }]
        }
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "1",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "▶️ A\n▶️ B"
    });
  });

  it("sessão existente reutiliza typebotSessionId (continueChat)", async () => {
    await typebotListener(
      {
        ticket: ticket({ typebotSessionId: "sess-keep" }),
        typebot: typebotCfg(),
        inbound: {
          body: "continua",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(axiosRequest).toHaveBeenCalledTimes(1);
    expect(axiosRequest.mock.calls[0][0].url).toContain(
      "/api/v1/sessions/sess-keep/continueChat"
    );
  });

  it("nova sessão persiste typebotSessionId e flags", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        sessionId: "new-sess",
        messages: [
          {
            type: "text",
            content: { richText: [{ children: [{ text: "start" }] }] }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({ typebotSessionId: null, typebotStatus: false }),
        typebot: typebotCfg(),
        inbound: {
          body: "oi",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(axiosRequest.mock.calls[0][0].url).toContain(
      "/api/v1/typebots/bot-a/startChat"
    );
    expect(updateTicket).toHaveBeenCalledWith({
      typebotSessionId: "new-sess",
      typebotStatus: true,
      useIntegration: true,
      integrationId: 9
    });
  });

  it("#JSON stopBot encerra integração sem sendText", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"stopBot":true}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "x",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicket).toHaveBeenCalledWith({
      useIntegration: false,
      isBot: false
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("#JSON queueId transfere via UpdateTicketService", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":4}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "x",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 4,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
  });

  it("keyword finish fecha o ticket", async () => {
    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "#sair",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        status: "closed",
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(axiosRequest).not.toHaveBeenCalled();
  });

  it("Evolution não envia image/audio por URL", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          { type: "image", content: { url: "https://cdn/x.jpg" } },
          { type: "audio", content: { url: "https://cdn/a.mp4" } },
          {
            type: "text",
            content: { richText: [{ children: [{ text: "depois" }] }] }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "oi",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendContent).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "depois"
    });
  });

  it("Baileys mídia legada usa capability sendUrlMedia", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [{ type: "image", content: { url: "https://cdn/x.jpg" } }]
      }
    });
    const outbound = {
      provider: "baileys" as const,
      sendText,
      sendContent,
      sendPresence,
      deleteMessage: jest.fn(),
      markAsRead: jest.fn(),
      getOwnUserJid: () => null
    };
    getOutbound.mockResolvedValue(outbound);

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "oi",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        },
        media: createTypebotLegacyUrlMediaSender(outbound)
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendContent).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      content: { image: { url: "https://cdn/x.jpg" } }
    });
  });

  it("não usa @c.us no destino", async () => {
    axiosRequest.mockResolvedValue({
      data: { messages: [] }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: {
          body: "oi",
          pushName: "Ana",
          fromMe: false,
          addressing: {
            remoteJid: "5511999998888@s.whatsapp.net",
            participant: ""
          }
        }
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "nao entendi"
    });
    const jids = sendText.mock.calls.map((c: { jid: string }[]) => c[0].jid);
    expect(jids.join(" ")).not.toMatch(/@c\.us/);
  });
});

describe("typebotListener static coupling", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../typebotListener.ts"),
    "utf8"
  );

  it("core textual não acopla Baileys", () => {
    expect(src).not.toMatch(/from ["']@whiskeysockets\/baileys["']/);
    expect(src).not.toMatch(/\bWASocket\b/);
    expect(src).not.toMatch(/\bproto\./);
    expect(src).not.toMatch(/\bgetWbot\s*\(/);
    expect(src).not.toMatch(/GetTicketWbot/);
    expect(src).not.toMatch(/GetWhatsappWbot/);
    expect(src).not.toMatch(/wrapBaileysSession/);
    expect(src).not.toMatch(/@c\.us/);
  });
});
