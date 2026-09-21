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
const sendRemoteMedia = jest.fn();

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

jest.mock("../../MessageServices/persistWhatsAppOutboundMessage", () => ({
  persistWhatsAppOutboundMessage: jest.fn().mockResolvedValue({ id: "P1" })
}));

import typebotListener, {
  extractTypebotRichTextPlain,
  normalizeTypebotInternalCommandJsonText,
  parseTypebotInternalCommand
} from "../typebotListener";
import { getWhatsAppOutboundForTicket } from "../../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import { persistWhatsAppOutboundMessage } from "../../MessageServices/persistWhatsAppOutboundMessage";

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

const inboundX = {
  body: "x",
  pushName: "Ana",
  fromMe: false,
  addressing: {
    remoteJid: "5511999998888@s.whatsapp.net",
    participant: ""
  }
};

const INTERNAL_QUEUE_COMMAND = '#{"queueId":1}';

function slateLinkCommandMessage(command = INTERNAL_QUEUE_COMMAND) {
  return {
    type: "text",
    content: {
      richText: [
        {
          type: "p",
          children: [
            { text: "" },
            {
              type: "a",
              url: command,
              children: [{ text: command }]
            },
            { text: "" }
          ]
        }
      ]
    }
  };
}

describe("normalizeTypebotInternalCommandJsonText FIX10", () => {
  it("não altera JSON limpo", () => {
    expect(normalizeTypebotInternalCommandJsonText('{"queueId":1}')).toBe(
      '{"queueId":1}'
    );
  });

  it("remove U+200B só nas bordas", () => {
    expect(
      normalizeTypebotInternalCommandJsonText('\u200B{"queueId":1}\u200B')
    ).toBe('{"queueId":1}');
  });

  it("remove U+FEFF só nas bordas", () => {
    expect(
      normalizeTypebotInternalCommandJsonText('\uFEFF{"queueId":1}\uFEFF')
    ).toBe('{"queueId":1}');
  });

  it("remove ZWSP misturado com whitespace nas bordas", () => {
    expect(
      normalizeTypebotInternalCommandJsonText(' \u200B {"queueId":1}\u200B\n')
    ).toBe('{"queueId":1}');
  });

  it("preserva U+200B dentro de string JSON", () => {
    const payload = '{"value":"a\u200Bb"}';
    expect(normalizeTypebotInternalCommandJsonText(payload)).toBe(payload);
    expect(JSON.parse(payload)).toEqual({ value: "a\u200Bb" });
  });
});

describe("parseTypebotInternalCommand FIX10", () => {
  it("A JSON limpo queueId 1", () => {
    expect(parseTypebotInternalCommand('#{"queueId":1}')).toEqual({
      kind: "queue",
      queueId: 1
    });
  });

  it("B trailing U+200B transfere", () => {
    expect(parseTypebotInternalCommand('#{"queueId":1}\u200B')).toEqual({
      kind: "queue",
      queueId: 1
    });
  });

  it("C leading U+200B após # transfere", () => {
    expect(parseTypebotInternalCommand('#\u200B{"queueId":1}')).toEqual({
      kind: "queue",
      queueId: 1
    });
  });

  it("D U+FEFF nas bordas do JSON transfere", () => {
    expect(parseTypebotInternalCommand('#\uFEFF{"queueId":1}\uFEFF')).toEqual({
      kind: "queue",
      queueId: 1
    });
  });

  it("G JSON inválido com format chars externos continua json_parse", () => {
    expect(parseTypebotInternalCommand('#{"queueId":\u200B')).toEqual({
      kind: "invalid",
      reason: "json_parse"
    });
    expect(parseTypebotInternalCommand('#\u200B{"queueId":')).toEqual({
      kind: "invalid",
      reason: "json_parse"
    });
  });

  it("H unsupported_command inalterado", () => {
    expect(parseTypebotInternalCommand('#{"foo":"bar"}')).toEqual({
      kind: "invalid",
      reason: "unsupported_command"
    });
  });

  it("I não muta U+200B interno; JSON continua válido", () => {
    expect(parseTypebotInternalCommand('#{"foo":"a\u200Bb"}')).toEqual({
      kind: "invalid",
      reason: "unsupported_command"
    });
  });

  it("J queue_user e stopBot com bordas de formato", () => {
    expect(
      parseTypebotInternalCommand('#\u200B{"queueId":1,"userId":2}\u200B')
    ).toEqual({
      kind: "queue_user",
      queueId: 1,
      userId: 2
    });
    expect(parseTypebotInternalCommand('#{"stopBot":true}\u200B')).toEqual({
      kind: "stopBot"
    });
  });
});

describe("extractTypebotRichTextPlain", () => {
  it("extrai texto semântico de link Slate sem Markdown residual", () => {
    expect(extractTypebotRichTextPlain(slateLinkCommandMessage())).toBe(
      INTERNAL_QUEUE_COMMAND
    );
    expect(
      parseTypebotInternalCommand(
        extractTypebotRichTextPlain(slateLinkCommandMessage())
      )
    ).toEqual({ kind: "queue", queueId: 1 });
  });

  it("não injeta parênteses em texto normal", () => {
    expect(
      extractTypebotRichTextPlain({
        content: {
          richText: [
            {
              type: "p",
              children: [{ text: "Preco (R$ 10) ok" }]
            }
          ]
        }
      })
    ).toBe("Preco (R$ 10) ok");
  });

  it("ignora href e concatena só leaf text", () => {
    expect(
      extractTypebotRichTextPlain({
        content: {
          richText: [
            {
              type: "p",
              children: [
                { text: "veja " },
                {
                  type: "a",
                  url: "https://example.com/path",
                  children: [{ text: "(detalhes)" }]
                }
              ]
            }
          ]
        }
      })
    ).toBe("veja (detalhes)");
  });
});

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
    sendRemoteMedia.mockResolvedValue(true);
    (persistWhatsAppOutboundMessage as jest.Mock).mockResolvedValue({
      id: "P1"
    });
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
    expect(persistWhatsAppOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: expect.objectContaining({ id: 77, companyId: 1 }),
        body: "ola",
        sent: expect.objectContaining({ messageId: "S1" })
      })
    );
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
        ticket: ticket({
          typebotSessionId: "sess-keep",
          typebotStatus: true,
          chatbot: true,
          useIntegration: true
        }),
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
    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalled();
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
      typebotStatus: true
    });
    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        chatbot: true,
        useIntegration: true,
        integrationId: 9
      },
      ticketId: 77,
      companyId: 1
    });
    expect(updateTicket).not.toHaveBeenCalledWith(
      expect.objectContaining({ chatbot: false })
    );
  });

  it("startChat HTTP falho não marca chatbot=true", async () => {
    axiosRequest.mockRejectedValue(new Error("typebot down"));

    await expect(
      typebotListener(
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
      )
    ).rejects.toThrow("typebot down");

    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).toHaveBeenCalledWith({ typebotSessionId: null });
    expect(updateTicket).not.toHaveBeenCalledWith(
      expect.objectContaining({ chatbot: true })
    );
  });

  it("startChat sem sessionId não marca chatbot=true", async () => {
    axiosRequest.mockResolvedValue({
      data: { messages: [{ type: "text" }] }
    });

    await expect(
      typebotListener(
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
      )
    ).rejects.toThrow(/empty sessionId/);

    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith(
      expect.objectContaining({ chatbot: true })
    );
  });

  it("startChat Baileys usa o mesmo lifecycle chatbot=true", async () => {
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
    getOutbound.mockResolvedValue({
      provider: "baileys",
      sendText,
      sendContent,
      sendPresence
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

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        chatbot: true,
        useIntegration: true,
        integrationId: 9
      },
      ticketId: 77,
      companyId: 1
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
      typebotSessionId: null,
      typebotStatus: false
    });
    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
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
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(axiosRequest).not.toHaveBeenCalled();
  });

  it("#JSON queueId+userId transfere e sai de AUTO", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":4,"userId":12}' }] }]
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
        userId: 12,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
  });

  it("#JSON queueId 1 transfere para Vendas", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":1}' }] }]
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
          body: "Comercial",
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
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("#JSON queueId 1 em richText Cloud type=p transfere", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [
                {
                  type: "p",
                  children: [{ text: '#{"queueId":1}' }]
                }
              ]
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
          body: "Comercial",
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
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("#JSON queueId 1 com whitespace/newline externo transfere", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '  #{"queueId":1}\n' }] }]
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
          body: "Comercial",
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
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("#JSON queueId 1 com parágrafo vazio extra ainda transfere", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [
                { type: "p", children: [{ text: '#{"queueId":1}' }] },
                { type: "p", children: [{ text: "" }] }
              ]
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
          body: "Comercial",
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
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("#JSON inválido não envia, não transfere e não zera sessão", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":' }] }]
            }
          }
        ]
      }
    });

    await expect(
      typebotListener(
        {
          ticket: ticket({
            typebotSessionId: "sess-keep",
            typebotStatus: true,
            chatbot: true,
            useIntegration: true,
            integrationId: 9
          }),
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
      )
    ).resolves.toBeUndefined();

    expect(sendText).not.toHaveBeenCalled();
    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("#JSON desconhecido não aparece no WhatsApp e mantém sessão", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"foo":"bar"}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          typebotSessionId: "sess-keep",
          typebotStatus: true,
          chatbot: true,
          useIntegration: true,
          integrationId: 9
        }),
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

    expect(sendText).not.toHaveBeenCalled();
    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("keyword restart zera sessão e mantém chatbot=true", async () => {
    await typebotListener(
      {
        ticket: ticket({ chatbot: true, useIntegration: true }),
        typebot: typebotCfg(),
        inbound: {
          body: "#reiniciar",
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
      typebotSessionId: null
    });
    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        chatbot: true
      },
      ticketId: 77,
      companyId: 1
    });
    expect(updateTicketService).not.toHaveBeenCalledWith(
      expect.objectContaining({
        ticketData: expect.objectContaining({ chatbot: false })
      })
    );
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "reiniciado"
    });
    expect(axiosRequest).not.toHaveBeenCalled();
  });

  it("Evolution envia imagem/áudio via sendRemoteMedia Buffer, não {url}", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "image",
            content: { url: "https://cdn.typebot.io/x.jpg", caption: "foto" }
          },
          { type: "audio", content: { url: "https://cdn.typebot.io/a.mp4" } },
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
      { axiosRequest, sleep: async () => undefined, sendRemoteMedia }
    );

    expect(sendRemoteMedia).toHaveBeenCalledTimes(2);
    expect(sendRemoteMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        url: "https://cdn.typebot.io/x.jpg",
        caption: "foto",
        jid: "5511999998888@s.whatsapp.net",
        ticket: expect.objectContaining({ id: 77, companyId: 1 })
      })
    );
    expect(sendRemoteMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "audio",
        url: "https://cdn.typebot.io/a.mp4",
        jid: "5511999998888@s.whatsapp.net",
        ticket: expect.objectContaining({ id: 77, companyId: 1 })
      })
    );
    expect(sendContent).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "depois"
    });
  });

  it("Baileys também usa Buffer via sendRemoteMedia, não { image: { url } }", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "image",
            content: { url: "https://cdn.typebot.io/x.jpg" }
          }
        ]
      }
    });
    getOutbound.mockResolvedValue({
      provider: "baileys",
      sendText,
      sendContent,
      sendPresence
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
      { axiosRequest, sleep: async () => undefined, sendRemoteMedia }
    );

    expect(sendRemoteMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        url: "https://cdn.typebot.io/x.jpg"
      })
    );
    expect(sendContent).not.toHaveBeenCalled();
  });

  it("falha de mídia continua blocos textuais", async () => {
    sendRemoteMedia.mockResolvedValue(false);
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          { type: "image", content: { url: "https://cdn.typebot.io/404.jpg" } },
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
      { axiosRequest, sleep: async () => undefined, sendRemoteMedia }
    );

    expect(sendRemoteMedia).toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "depois"
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

  it("FIX10-A #JSON queueId 1 limpo transfere e sai de AUTO", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":1}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          chatbot: true,
          useIntegration: true,
          integrationId: 2
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("FIX10-B/E/F sequência E2E com U+200B no comando transfere", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: "texto final" }] }]
            }
          },
          {
            type: "image",
            content: { url: "https://cdn.typebot.io/x.jpg" }
          },
          {
            type: "audio",
            content: { url: "https://cdn.typebot.io/a.mp4" }
          },
          {
            type: "text",
            content: {
              richText: [
                {
                  type: "p",
                  children: [{ text: '#{"queueId":1}\u200B' }]
                }
              ]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          chatbot: true,
          useIntegration: true,
          integrationId: 2,
          typebotSessionId: "sess-1",
          typebotStatus: true
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: { ...inboundX, body: "Comercial" }
      },
      { axiosRequest, sleep: async () => undefined, sendRemoteMedia }
    );

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "texto final"
    });
    expect(sendRemoteMedia).toHaveBeenCalledTimes(2);
    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(
      sendText.mock.calls.some((c: { text: string }[]) =>
        String(c[0].text).includes("queueId")
      )
    ).toBe(false);
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("FIX10-C/D leading ZWSP e FEFF no comando transfere", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#\u200B{"queueId":1}\uFEFF' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          chatbot: true,
          useIntegration: true,
          integrationId: 2
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("FIX10-G JSON inválido com format externo não transfere nem zera sessão", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"queueId":\u200B' }] }]
            }
          }
        ]
      }
    });

    await expect(
      typebotListener(
        {
          ticket: ticket({
            typebotSessionId: "sess-keep",
            typebotStatus: true,
            chatbot: true,
            useIntegration: true,
            integrationId: 2
          }),
          typebot: typebotCfg({ id: 2 }),
          inbound: inboundX
        },
        { axiosRequest, sleep: async () => undefined }
      )
    ).resolves.toBeUndefined();

    expect(sendText).not.toHaveBeenCalled();
    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("FIX10-H unsupported não transfere nem envia", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#{"foo":"bar"}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          typebotSessionId: "sess-keep",
          chatbot: true,
          useIntegration: true,
          integrationId: 2
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).not.toHaveBeenCalled();
    expect(updateTicketService).not.toHaveBeenCalled();
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("FIX10-J queue_user e stopBot com ZWSP de borda", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [
                { children: [{ text: '#{"queueId":1,"userId":2}\u200B' }] }
              ]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          chatbot: true,
          useIntegration: true,
          integrationId: 2
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 1,
        userId: 2,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("FIX10-J stopBot com ZWSP de borda encerra sem sendText", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: '#\u200B{"stopBot":true}' }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg({ id: 2 }),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(updateTicket).toHaveBeenCalledWith({
      typebotSessionId: null,
      typebotStatus: false
    });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("comando em link Slate (href=label) transfere na sequência E2E", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: "texto final" }] }]
            }
          },
          {
            type: "image",
            content: { url: "https://cdn.typebot.io/x.jpg" }
          },
          {
            type: "audio",
            content: { url: "https://cdn.typebot.io/a.mp4" }
          },
          slateLinkCommandMessage()
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket({
          chatbot: true,
          useIntegration: true,
          integrationId: 2,
          typebotSessionId: "sess-1",
          typebotStatus: true
        }),
        typebot: typebotCfg({ id: 2 }),
        inbound: { ...inboundX, body: "Comercial" }
      },
      { axiosRequest, sleep: async () => undefined, sendRemoteMedia }
    );

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "texto final"
    });
    expect(sendRemoteMedia).toHaveBeenCalledTimes(2);
    expect(updateTicketService).toHaveBeenCalledWith({
      ticketData: {
        queueId: 1,
        chatbot: false,
        useIntegration: false,
        integrationId: null
      },
      ticketId: 77,
      companyId: 1
    });
    expect(
      sendText.mock.calls.some((c: { text: string }[]) =>
        String(c[0].text).includes("queueId")
      )
    ).toBe(false);
    expect(persistWhatsAppOutboundMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("queueId")
      })
    );
    expect(updateTicket).not.toHaveBeenCalledWith({ typebotSessionId: null });
  });

  it("texto visível com parênteses não é mutilado", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [{ children: [{ text: "Horario (9h as 18h)" }] }]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).toHaveBeenCalledWith({
      jid: "5511999998888@s.whatsapp.net",
      text: "Horario (9h as 18h)"
    });
    expect(updateTicketService).not.toHaveBeenCalled();
  });

  it("link visível continua formatado; parênteses do Markdown não viram comando", async () => {
    axiosRequest.mockResolvedValue({
      data: {
        messages: [
          {
            type: "text",
            content: {
              richText: [
                {
                  type: "p",
                  children: [
                    { text: "" },
                    {
                      type: "a",
                      url: "https://example.com",
                      children: [{ text: "veja (site)" }]
                    },
                    { text: "" }
                  ]
                }
              ]
            }
          }
        ]
      }
    });

    await typebotListener(
      {
        ticket: ticket(),
        typebot: typebotCfg(),
        inbound: inboundX
      },
      { axiosRequest, sleep: async () => undefined }
    );

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0].text).toContain("veja (site)");
    expect(sendText.mock.calls[0][0].text).toContain("https://example.com");
    expect(updateTicketService).not.toHaveBeenCalled();
  });
});

describe("typebotListener static coupling", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../typebotListener.ts"),
    "utf8"
  );

  it("core textual/mídia não acopla Baileys nem payload URL", () => {
    expect(src).not.toMatch(/from ["']@whiskeysockets\/baileys["']/);
    expect(src).not.toMatch(/\bWASocket\b/);
    expect(src).not.toMatch(/\bproto\./);
    expect(src).not.toMatch(/\bgetWbot\s*\(/);
    expect(src).not.toMatch(/GetTicketWbot/);
    expect(src).not.toMatch(/GetWhatsappWbot/);
    expect(src).not.toMatch(/wrapBaileysSession/);
    expect(src).not.toMatch(/@c\.us/);
    expect(src).not.toMatch(/image:\s*\{\s*url/);
    expect(src).not.toMatch(/audio:\s*\{\s*url/);
  });
});
