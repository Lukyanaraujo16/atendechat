/**
 * @jest-environment node
 *
 * Contrato do composer humano: presence provider-agnostic, send não espera presence.
 */
import fs from "fs";
import path from "path";
import api from "../../../services/api";
import {
  isEligibleForHumanWhatsAppTypingPresence,
  sendHumanTicketPresence,
} from "../humanWhatsAppTypingPresence";

jest.mock("../../../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(() => Promise.resolve({ data: { sent: true } })),
  },
}));

const source = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");

describe("MessageInputCustom human presence wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("liga o composer ao hook provider-agnostic", () => {
    expect(source).toMatch(/useHumanWhatsAppTypingPresence/);
    expect(source).toMatch(/onComposerTextChange=\{notifyTyping\}/);
    expect(source).toMatch(/onComposerBlur=\{pauseNow\}/);
    expect(source).toMatch(/notifyTyping\(next\)/);
    expect(source).toMatch(/reason === "input"/);
    expect(source).not.toMatch(/evolution/i);
    expect(source).not.toMatch(/baileys/i);
    expect(source).not.toMatch(/PRESENCE_UPDATE/);
    expect(source).not.toMatch(/recording"/);
  });

  it("envio de texto chama paused sem await e mantém POST /messages", () => {
    const sendFn = source.slice(
      source.indexOf("const handleSendMessage"),
      source.indexOf("const disableOption")
    );
    expect(sendFn).toMatch(/pauseNow\(\);/);
    expect(sendFn).not.toMatch(/await pauseNow/);
    expect(sendFn).toMatch(/api\.post\(`\/messages\/\$\{ticketId\}`/);
    const pauseIdx = sendFn.indexOf("pauseNow();");
    const postIdx = sendFn.indexOf("api.post");
    expect(pauseIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(pauseIdx);
  });

  it("sendHumanTicketPresence é best-effort e sem provider", async () => {
    api.post.mockResolvedValueOnce({ data: { sent: true } });
    await sendHumanTicketPresence(3, "composing");
    expect(api.post).toHaveBeenCalledWith("/tickets/3/presence", {
      presence: "composing",
    });
    expect(api.post.mock.calls[0][1].provider).toBeUndefined();

    api.post.mockRejectedValueOnce(new Error("presence down"));
    await expect(sendHumanTicketPresence(3, "paused")).resolves.toBeNull();
  });

  it("não envia presence inválida", async () => {
    await sendHumanTicketPresence(3, "unavailable");
    await sendHumanTicketPresence(3, "recording");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("Instagram, grupo e ticket fechado não são elegíveis", () => {
    const base = {
      id: 3,
      channel: "whatsapp",
      whatsappId: 11,
      isGroup: false,
      isOrphan: false,
    };
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 3,
        ticketStatus: "open",
        ticket: { ...base, channel: "instagram" },
      })
    ).toBe(false);
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 3,
        ticketStatus: "open",
        ticket: { ...base, isGroup: true },
      })
    ).toBe(false);
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 3,
        ticketStatus: "closed",
        ticket: base,
      })
    ).toBe(false);
    expect(
      isEligibleForHumanWhatsAppTypingPresence({
        ticketId: 3,
        ticketStatus: "open",
        ticket: base,
      })
    ).toBe(true);
  });
});
