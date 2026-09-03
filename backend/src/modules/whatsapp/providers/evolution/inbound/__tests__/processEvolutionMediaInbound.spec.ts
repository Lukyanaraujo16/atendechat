/* eslint-disable import/first */
import { promises as fs } from "fs";
import os from "os";
import path from "path";

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

jest.mock("../evolutionHttpClient", () => {
  const actual = jest.requireActual("../evolutionHttpClient");
  return {
    ...actual,
    evolutionGetBase64FromMediaMessage: jest.fn(),
    evolutionDownloadMediaFromUrl: jest.fn()
  };
});

const createEvent = jest.fn();
const findMessage = jest.fn();
const findByPkMessage = jest.fn();
const createContact = jest.fn();
const findOrCreateTicket = jest.fn();
const createEvoMessage = jest.fn();
const resolveQuoted = jest.fn();

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findMessage(...a),
    findByPk: (...a: unknown[]) => findByPkMessage(...a)
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

import { UniqueConstraintError } from "sequelize";
import { processEvolutionWebhook } from "../processEvolutionWebhook";
import { processEvolutionTextInbound } from "../processEvolutionTextInbound";
import {
  EvolutionHttpError,
  evolutionDownloadMediaFromUrl,
  evolutionGetBase64FromMediaMessage
} from "../evolutionHttpClient";

const getBase64 = evolutionGetBase64FromMediaMessage as jest.Mock;
const downloadUrl = evolutionDownloadMediaFromUrl as jest.Mock;

describe("processEvolutionWebhook media + idempotency Fase 7", () => {
  const whatsapp = {
    id: 10,
    companyId: 1,
    connectionProvider: "evolution"
  } as never;

  let tmpDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "evo-media-"));
    findMessage.mockResolvedValue(null);
    findByPkMessage.mockResolvedValue(null);
    createContact.mockResolvedValue({ id: 5, number: "5511999998888" });
    findOrCreateTicket.mockResolvedValue({ id: 77, queueId: null });
    resolveQuoted.mockResolvedValue(null);
    createEvoMessage.mockResolvedValue({ id: "IMGMEDIA1" });
    createEvent.mockImplementation(async (row: any) => ({
      id: 100,
      ...row,
      update: jest.fn().mockResolvedValue(undefined)
    }));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const imageBody = {
    event: "MESSAGES_UPSERT",
    instance: "inst",
    data: {
      key: {
        remoteJid: "5511999998888@s.whatsapp.net",
        fromMe: false,
        id: "IMGMEDIA1"
      },
      pushName: "Ana",
      message: {
        imageMessage: {
          mimetype: "image/jpeg",
          caption: "oi",
          base64: Buffer.from("fake-jpeg-bytes").toString("base64")
        }
      },
      messageType: "imageMessage",
      messageTimestamp: 1709553296
    },
    apikey: "secret"
  };

  it("processa imagem com base64 sem rawProviderMessage", async () => {
    const result = await processEvolutionTextInbound({
      inbound: {
        provider: "evolution",
        companyId: 1,
        whatsappId: 10,
        messageId: "IMGMEDIA1",
        fromMe: false,
        timestamp: new Date(),
        messageType: "imageMessage",
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
          hasMedia: true,
          mimetype: "image/jpeg",
          filename: null,
          caption: "oi",
          isPtt: false
        },
        wrapping: { isEphemeral: false, isViewOnce: false },
        messageStubType: null,
        ack: null,
        editedMessageId: null,
        rawProviderMessage: null
      },
      whatsapp,
      evolutionPayloadSanitized: { event: "MESSAGES_UPSERT" },
      mediaHints: {
        kind: "image",
        messageId: "IMGMEDIA1",
        mimetype: "image/jpeg",
        filename: null,
        inlineBase64: Buffer.from("fake-jpeg-bytes").toString("base64")
      },
      deps: { publicDir: tmpDir }
    });

    expect(result.status).toBe("created");
    expect(createEvoMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: expect.any(String),
        persistedMediaType: "image"
      })
    );
    const savedName = createEvoMessage.mock.calls[0][0].mediaUrl as string;
    const saved = await fs.readFile(path.join(tmpDir, savedName));
    expect(saved.toString()).toBe("fake-jpeg-bytes");
    expect(
      createEvoMessage.mock.calls[0][0].inbound.rawProviderMessage
    ).toBeNull();
    expect(getBase64).not.toHaveBeenCalled();
    expect(downloadUrl).not.toHaveBeenCalled();
  });

  it("imagem com URL CDN bloqueada persiste via getBase64 Evolution", async () => {
    downloadUrl.mockRejectedValue(
      new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
        "URL de mídia bloqueada: host_not_evolution_base"
      )
    );
    getBase64.mockResolvedValue({
      base64: Buffer.from("cdn-fallback-bytes").toString("base64"),
      mimetype: "image/jpeg"
    });
    createEvoMessage.mockResolvedValue({ id: "3A5809589B19B293D6F5" });

    const result = await processEvolutionTextInbound({
      inbound: {
        provider: "evolution",
        companyId: 1,
        whatsappId: 10,
        messageId: "3A5809589B19B293D6F5",
        fromMe: false,
        timestamp: new Date(),
        messageType: "imageMessage",
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
          hasMedia: true,
          mimetype: "image/jpeg",
          filename: null,
          caption: "oi",
          isPtt: false
        },
        wrapping: { isEphemeral: false, isViewOnce: false },
        messageStubType: null,
        ack: null,
        editedMessageId: null,
        rawProviderMessage: null
      },
      whatsapp,
      evolutionPayloadSanitized: { event: "MESSAGES_UPSERT" },
      mediaHints: {
        kind: "image",
        messageId: "3A5809589B19B293D6F5",
        mimetype: "image/jpeg",
        filename: null,
        mediaUrl: "https://mmg.whatsapp.net/v/t62.7118-24/example"
      },
      deps: { publicDir: tmpDir }
    });

    expect(result.status).toBe("created");
    expect(downloadUrl).toHaveBeenCalledTimes(1);
    expect(getBase64).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappId: 10,
        messageId: "3A5809589B19B293D6F5",
        convertToMp4: false
      })
    );
    const savedName = createEvoMessage.mock.calls[0][0].mediaUrl as string;
    const saved = await fs.readFile(path.join(tmpDir, savedName));
    expect(saved.toString()).toBe("cdn-fallback-bytes");
    expect(createEvoMessage.mock.calls[0][0].persistedMediaType).toBe("image");
  });

  it("replay de mídia não recria ticket/message (webhook unique)", async () => {
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({} as never));
    const result = await processEvolutionWebhook({
      whatsapp,
      body: imageBody,
      apiKeyValid: true
    });
    expect(result.outcome).toBe("duplicate");
    expect(createContact).not.toHaveBeenCalled();
    expect(findOrCreateTicket).not.toHaveBeenCalled();
  });

  it("mesmo message id já em Message → duplicate sem download", async () => {
    findMessage.mockResolvedValue({ id: "IMGMEDIA1" });
    const result = await processEvolutionTextInbound({
      inbound: {
        provider: "evolution",
        companyId: 1,
        whatsappId: 10,
        messageId: "IMGMEDIA1",
        fromMe: false,
        timestamp: new Date(),
        messageType: "imageMessage",
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
          hasMedia: true,
          mimetype: "image/jpeg",
          filename: null,
          caption: "oi",
          isPtt: false
        },
        wrapping: { isEphemeral: false, isViewOnce: false },
        messageStubType: null,
        ack: null,
        editedMessageId: null,
        rawProviderMessage: null
      },
      whatsapp,
      evolutionPayloadSanitized: {},
      mediaHints: {
        kind: "image",
        messageId: "IMGMEDIA1",
        mimetype: "image/jpeg",
        filename: null,
        inlineBase64: "aaaa"
      },
      deps: {
        publicDir: tmpDir,
        extractMedia: jest.fn(async () => {
          throw new Error("should not download");
        })
      }
    });
    expect(result.status).toBe("duplicate");
    expect(createEvoMessage).not.toHaveBeenCalled();
  });

  it("texto Evolution Fase 6 continua processando", async () => {
    createEvoMessage.mockResolvedValue({ id: "3EB0MSG1" });
    const result = await processEvolutionWebhook({
      whatsapp,
      body: {
        event: "MESSAGES_UPSERT",
        data: {
          key: {
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: false,
            id: "3EB0MSG1"
          },
          message: { conversation: "oi" },
          messageType: "conversation",
          messageTimestamp: 1
        }
      },
      apiKeyValid: true
    });
    expect(result.outcome).toBe("processed");
  });
});
