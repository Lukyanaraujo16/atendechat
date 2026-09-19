/* eslint-disable import/first */
import fs from "fs";
import path from "path";

const sendContent = jest.fn();
const getOutbound = jest.fn();

jest.mock("@ffmpeg-installer/ffmpeg", () => ({
  path: "/bin/echo"
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (jid: string) => jid
}));

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest
    .fn()
    .mockResolvedValue("5511999998888@s.whatsapp.net")
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("mime-types", () => ({
  lookup: () => "audio/mpeg"
}));

jest.mock("fs", () => ({
  existsSync: () => true,
  readFileSync: () => Buffer.from("audio")
}));

import SendWhatsAppMediaFlow from "../SendWhatsAppMediaFlow";

describe("SendWhatsAppMediaFlow 12.3-E Evolution audio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("áudio Evolution é deferido sem sendContent incompatível", async () => {
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendContent
    });
    const result = await SendWhatsAppMediaFlow({
      media: "/tmp/voice.mp3",
      ticket: { id: 77, isGroup: false, contactId: 5 } as never,
      isFlow: true,
      isRecord: true
    });
    expect(result).toBeUndefined();
    expect(sendContent).not.toHaveBeenCalled();
  });

  it("caminho Baileys de áudio legado permanece no adapter", () => {
    const realFs = jest.requireActual("fs") as typeof fs;
    const src = realFs.readFileSync(
      path.join(__dirname, "../SendWhatsAppMediaFlow.ts"),
      "utf8"
    );
    expect(src).toContain('typeMessage === "audio"');
    expect(src).toContain("audio/mp4");
    expect(src).toContain("ptt: true");
    expect(src).toContain("deferred for Evolution");
  });
});
