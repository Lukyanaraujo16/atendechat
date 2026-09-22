/* eslint-disable import/first */
import fs from "fs";
import path from "path";
import { NormalizedWhatsAppMessage } from "../../../../inbound/NormalizedWhatsAppMessage";

jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock(
  "../../../../../../services/CompanyService/adjustCompanyStorageUsage",
  () => ({
    incrementCompanyStorageUsage: jest.fn()
  })
);

const createContact = jest.fn();
const findOrCreateTicket = jest.fn();
const createEvoMessage = jest.fn();
const resolveQuoted = jest.fn();
const applyReaction = jest.fn();
const resolveSettings = jest.fn();

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    findByPk: jest.fn().mockResolvedValue(null)
  }
}));

jest.mock(
  "../../../../../../services/ContactServices/CreateOrUpdateContactService",
  () => ({
    __esModule: true,
    default: (...a: unknown[]) => createContact(...a)
  })
);

jest.mock(
  "../../../../../../services/TicketServices/FindOrCreateTicketService",
  () => ({
    __esModule: true,
    default: (...a: unknown[]) => findOrCreateTicket(...a)
  })
);

jest.mock("../createEvolutionInboundMessage", () => ({
  createEvolutionInboundMessage: (...a: unknown[]) => createEvoMessage(...a)
}));

jest.mock("../../../../inbound/resolveQuotedMessageByStanzaId", () => ({
  resolveQuotedMessageByStanzaId: (...a: unknown[]) => resolveQuoted(...a)
}));

jest.mock("../../../../inbound/applyInboundWhatsAppReaction", () => ({
  applyInboundWhatsAppReaction: (...a: unknown[]) => applyReaction(...a)
}));

jest.mock("../../../../../../helpers/resolveWhatsappSettings", () => ({
  resolveWhatsappSettings: (...a: unknown[]) => resolveSettings(...a)
}));

jest.mock(
  "../../../../../../services/AiAgentService/runAiAgentDryRunHook",
  () => ({
    scheduleAiAgentDryRunFromInbound: jest.fn()
  })
);

import { processEvolutionTextInbound } from "../processEvolutionTextInbound";

const GROUP_JID = "120363111222333@g.us";
const GROUP_DIGITS = "120363111222333";
const PUSH_A = "Pessoa A";
const PUSH_B = "Pessoa B";

function groupInbound(
  overrides: Partial<NormalizedWhatsAppMessage> = {}
): NormalizedWhatsAppMessage {
  return {
    provider: "evolution",
    companyId: 1,
    whatsappId: 10,
    messageId: "GRP1",
    fromMe: false,
    timestamp: new Date(),
    messageType: "conversation",
    body: "oi grupo",
    pushName: PUSH_A,
    isGroup: true,
    addressing: {
      remoteJid: GROUP_JID,
      participant: "5511999998888@s.whatsapp.net",
      participantPn: "5511999998888@s.whatsapp.net"
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
    ...overrides
  };
}

function privateInbound(): NormalizedWhatsAppMessage {
  return {
    ...groupInbound({
      isGroup: false,
      messageId: "PVT1",
      addressing: {
        remoteJid: "5511999998888@s.whatsapp.net",
        participant: ""
      },
      senderNumber: "5511999998888",
      pushName: "Ana"
    })
  };
}

describe("processEvolutionTextInbound group identity 12.2-B", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "receive" }
    });
    createContact.mockImplementation(
      async (data: { isGroup?: boolean; name: string; number: string }) => ({
        id: data.isGroup ? 1 : 2,
        name: data.name,
        number: data.number,
        isGroup: Boolean(data.isGroup)
      })
    );
    findOrCreateTicket.mockResolvedValue({ id: 77, queueId: null });
    resolveQuoted.mockResolvedValue(null);
    createEvoMessage.mockResolvedValue({ id: "GRP1" });
    applyReaction.mockResolvedValue({
      outcome: "applied",
      targetMessageId: "TARGET",
      ticketId: 77
    });
  });

  it("primeira mensagem: groupContact.name não é pushName", async () => {
    await processEvolutionTextInbound({
      inbound: groupInbound(),
      whatsapp,
      evolutionPayloadSanitized: { event: "MESSAGES_UPSERT" }
    });
    const groupArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => c[0].isGroup
    )[0];
    expect(groupArg.name).toBe(`Grupo ${GROUP_DIGITS}`);
    expect(groupArg.name).not.toBe(PUSH_A);
    expect(groupArg.number).toBe(GROUP_DIGITS);
    expect(groupArg.companyId).toBe(1);
    expect(groupArg.whatsappId).toBe(10);
  });

  it("participant Contact continua com pushName", async () => {
    await processEvolutionTextInbound({
      inbound: groupInbound(),
      whatsapp,
      evolutionPayloadSanitized: { event: "MESSAGES_UPSERT" }
    });
    const partArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => !c[0].isGroup
    )[0];
    expect(partArg.name).toBe(PUSH_A);
    expect(partArg.number).toBe("5511999998888");
    expect(partArg.isGroup).toBe(false);
  });

  it("duas mensagens de participantes diferentes não alternam o nome do grupo", async () => {
    await processEvolutionTextInbound({
      inbound: groupInbound({ messageId: "G1", pushName: PUSH_A }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    await processEvolutionTextInbound({
      inbound: groupInbound({
        messageId: "G2",
        pushName: PUSH_B,
        senderNumber: "5511888777666",
        addressing: {
          remoteJid: GROUP_JID,
          participant: "5511888777666@s.whatsapp.net"
        }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    const groupNames = createContact.mock.calls
      .filter((c: [{ isGroup?: boolean }]) => c[0].isGroup)
      .map((c: [{ name: string }]) => c[0].name);
    expect(groupNames).toEqual([
      `Grupo ${GROUP_DIGITS}`,
      `Grupo ${GROUP_DIGITS}`
    ]);
    const participantNames = createContact.mock.calls
      .filter((c: [{ isGroup?: boolean }]) => !c[0].isGroup)
      .map((c: [{ name: string }]) => c[0].name);
    expect(participantNames).toEqual([PUSH_A, PUSH_B]);
  });

  it("private chat continua usando pushName no Contact", async () => {
    await processEvolutionTextInbound({
      inbound: privateInbound(),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(createContact).toHaveBeenCalledTimes(1);
    expect(createContact.mock.calls[0][0].isGroup).toBe(false);
    expect(createContact.mock.calls[0][0].name).toBe("Ana");
  });

  it("groupMessagesMode=ignore não cria Contact/Ticket/Message", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "ignore" }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound(),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result).toEqual({
      status: "skipped",
      reason: "group_messages_disabled"
    });
    expect(createContact).not.toHaveBeenCalled();
    expect(findOrCreateTicket).not.toHaveBeenCalled();
    expect(createEvoMessage).not.toHaveBeenCalled();
    expect(applyReaction).not.toHaveBeenCalled();
  });

  it("groupMessagesMode=ignore não processa reaction de grupo", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "ignore" }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound({
        kind: "reaction",
        reaction: { targetStanzaId: "T1", emoji: "👍" }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result.status).toBe("skipped");
    expect(applyReaction).not.toHaveBeenCalled();
  });

  it("groupMessagesMode=receive processa o grupo", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "receive" }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound(),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result.status).toBe("created");
    expect(createEvoMessage).toHaveBeenCalled();
  });

  it("private continua processando com groupMessagesMode=ignore", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "ignore" }
    });
    const result = await processEvolutionTextInbound({
      inbound: privateInbound(),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result.status).toBe("created");
    expect(createContact).toHaveBeenCalled();
    expect(createEvoMessage).toHaveBeenCalled();
    expect(resolveSettings).not.toHaveBeenCalled();
  });

  it("ignore ocorre antes de exigir participant (malformed group)", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "ignore" }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound({
        senderNumber: null,
        addressing: { remoteJid: GROUP_JID, participant: "" }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result).toEqual({
      status: "skipped",
      reason: "group_messages_disabled"
    });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("groupMessagesMode ausente/default processa o grupo", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: undefined }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound(),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result.status).toBe("created");
    expect(createEvoMessage).toHaveBeenCalled();
  });

  it("LID/PN: group name não usa participant nem pushName", async () => {
    await processEvolutionTextInbound({
      inbound: groupInbound({
        pushName: "João LID",
        senderNumber: "5511777666555",
        addressing: {
          remoteJid: GROUP_JID,
          participant: "123456789012345@lid",
          participantPn: "5511777666555@s.whatsapp.net"
        }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    const groupArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => c[0].isGroup
    )[0];
    const partArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => !c[0].isGroup
    )[0];
    expect(groupArg.name).toBe(`Grupo ${GROUP_DIGITS}`);
    expect(groupArg.name).not.toBe("João LID");
    expect(partArg.name).toBe("João LID");
    expect(partArg.number).toBe("5511777666555");
    expect(partArg.number).not.toContain("lid");
  });

  it("shape 442: participantAlt PN + ignore → group_messages_disabled", async () => {
    resolveSettings.mockResolvedValue({
      callsGroups: { groupMessagesMode: "ignore" }
    });
    const result = await processEvolutionTextInbound({
      inbound: groupInbound({
        pushName: "Participante Teste",
        senderNumber: "5511999999999",
        addressing: {
          remoteJid: GROUP_JID,
          participant: "999999999999999@lid",
          participantAlt: "5511999999999@s.whatsapp.net"
        }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result).toEqual({
      status: "skipped",
      reason: "group_messages_disabled"
    });
    expect(createContact).not.toHaveBeenCalled();
    expect(createEvoMessage).not.toHaveBeenCalled();
  });

  it("shape 442: participantAlt PN + receive → cria grupo com fallback e participant pushName", async () => {
    const result = await processEvolutionTextInbound({
      inbound: groupInbound({
        pushName: "Participante Teste",
        senderNumber: "5511999999999",
        addressing: {
          remoteJid: GROUP_JID,
          participant: "999999999999999@lid",
          participantAlt: "5511999999999@s.whatsapp.net"
        }
      }),
      whatsapp,
      evolutionPayloadSanitized: {}
    });
    expect(result.status).toBe("created");
    const groupArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => c[0].isGroup
    )[0];
    const partArg = createContact.mock.calls.find(
      (c: [{ isGroup?: boolean }]) => !c[0].isGroup
    )[0];
    expect(groupArg.name).toBe(`Grupo ${GROUP_DIGITS}`);
    expect(groupArg.name).not.toBe("Participante Teste");
    expect(partArg.name).toBe("Participante Teste");
    expect(partArg.number).toBe("5511999999999");
    expect(partArg.number).not.toContain("lid");
  });

  it("CreateOrUpdateContactService não atualiza name de contato existente", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../../../services/ContactServices/CreateOrUpdateContactService.ts"
      ),
      "utf8"
    );
    const updateBlock = src.slice(
      src.indexOf("if (contact) {"),
      src.indexOf("} else {")
    );
    expect(updateBlock).toContain("profilePicUrl");
    expect(updateBlock).not.toMatch(/\bname\b/);
  });
});
