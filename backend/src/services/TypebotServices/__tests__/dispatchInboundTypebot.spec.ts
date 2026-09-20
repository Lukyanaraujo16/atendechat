import {
  dispatchInboundTypebot,
  resolveInboundTypebotDispatch
} from "../dispatchInboundTypebot";
import { NormalizedWhatsAppMessage } from "../../../modules/whatsapp/inbound/NormalizedWhatsAppMessage";
import { InboundAutomationContext } from "../../../modules/whatsapp/automation/processInboundAutomation";

function inbound(
  partial: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "evolution",
    companyId: 1,
    whatsappId: 10,
    messageId: "M1",
    fromMe: false,
    timestamp: null,
    messageType: "conversation",
    body: "oi",
    pushName: "Ana",
    isGroup: false,
    addressing: {
      remoteJid: "5511999998888@s.whatsapp.net",
      participant: ""
    },
    senderNumber: "5511999998888",
    quotedStanzaId: null,
    mentionedJids: [],
    media: {
      hasMedia: false,
      mimetype: null,
      filename: null,
      caption: null,
      isPtt: false
    },
    wrapping: { isEphemeral: false, isViewOnce: false },
    messageStubType: null,
    ack: null,
    editedMessageId: null,
    rawProviderMessage: null,
    ...partial
  };
}

function ctx(
  partial: Partial<InboundAutomationContext> = {}
): InboundAutomationContext {
  return {
    inbound: inbound(),
    ticket: {
      id: 77,
      companyId: 1,
      whatsappId: 10,
      contactId: 5,
      isGroup: false,
      queueId: null,
      userId: null,
      useIntegration: false,
      integrationId: null
    },
    contact: { id: 5, companyId: 1 },
    whatsapp: { id: 10, companyId: 1, integrationId: 9, promptId: null },
    persistedMessageId: "M1",
    ...partial
  };
}

describe("resolveInboundTypebotDispatch", () => {
  it("conexão sem fila dispara start e halt", () => {
    const r = resolveInboundTypebotDispatch(ctx().ticket, ctx().whatsapp);
    expect(r).toMatchObject({
      candidate: true,
      integrationId: 9,
      halt: true,
      reason: "connection_start"
    });
  });

  it("sessão em fila continua sem halt", () => {
    const r = resolveInboundTypebotDispatch(
      {
        id: 77,
        companyId: 1,
        whatsappId: 10,
        contactId: 5,
        isGroup: false,
        queueId: 3,
        userId: null,
        useIntegration: true,
        integrationId: 9
      },
      { id: 10, companyId: 1 }
    );
    expect(r).toMatchObject({
      candidate: true,
      halt: false,
      reason: "queued_session"
    });
  });

  it("grupo não é candidato", () => {
    const r = resolveInboundTypebotDispatch(
      { ...ctx().ticket, isGroup: true },
      ctx().whatsapp
    );
    expect(r.candidate).toBe(false);
  });

  it("sessão ativa na conexão continua sem halt", () => {
    const r = resolveInboundTypebotDispatch(
      {
        ...ctx().ticket,
        useIntegration: true,
        integrationId: 9,
        typebotStatus: true,
        typebotSessionId: "sess-1"
      },
      ctx().whatsapp
    );
    expect(r).toMatchObject({
      candidate: true,
      halt: false,
      reason: "connection_session"
    });
  });

  it("sessão zerada com Typebot ainda ativo reinicia connection_start", () => {
    const r = resolveInboundTypebotDispatch(
      {
        ...ctx().ticket,
        useIntegration: true,
        integrationId: 9,
        typebotStatus: true,
        typebotSessionId: null
      },
      ctx().whatsapp
    );
    expect(r).toMatchObject({
      candidate: true,
      halt: true,
      reason: "connection_start"
    });
  });
});

describe("dispatchInboundTypebot", () => {
  it("Evolution privado elegível chama Typebot com inbound e tenant", async () => {
    const runTypebot = jest.fn().mockResolvedValue(undefined);
    const showIntegration = jest.fn().mockResolvedValue({
      id: 9,
      type: "typebot",
      companyId: 1
    });
    const ticketRow = { id: 77, companyId: 1 };
    const loadTicket = jest.fn().mockResolvedValue(ticketRow);

    const result = await dispatchInboundTypebot(ctx(), {
      deps: { runTypebot, showIntegration, loadTicket }
    });

    expect(result).toEqual({
      handled: true,
      halt: true,
      reason: "connection_start"
    });
    expect(showIntegration).toHaveBeenCalledWith(9, 1);
    expect(loadTicket).toHaveBeenCalledWith(77, 1);
    expect(runTypebot).toHaveBeenCalledTimes(1);
    const req = runTypebot.mock.calls[0][0];
    expect(req.ticket).toBe(ticketRow);
    expect(req.typebot.id).toBe(9);
    expect(req.inbound.body).toBe("oi");
    expect(req.media).toBeUndefined();
  });

  it("integração flowbuilder não dispara Typebot", async () => {
    const runTypebot = jest.fn();
    const result = await dispatchInboundTypebot(ctx(), {
      deps: {
        runTypebot,
        showIntegration: jest.fn().mockResolvedValue({
          id: 9,
          type: "flowbuilder"
        })
      }
    });
    expect(result.handled).toBe(false);
    expect(result.reason).toBe("not_typebot");
    expect(runTypebot).not.toHaveBeenCalled();
  });
});
