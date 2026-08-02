/**
 * Fase 2.18 — Natural Response Pacing + typing indicator
 */
/* eslint-disable import/first */

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (jid: string) => jid,
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest.fn()
}));

jest.mock("../../../helpers/whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: jest
    .fn()
    .mockReturnValue(false)
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import fs from "fs";
import path from "path";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import { getTicketRemoteJid } from "../../../helpers/GetTicketRemoteJid";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../../helpers/whatsappUnavailablePresence";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import {
  AI_AGENT_PACING,
  bucketAiAgentResponseLength,
  calculateAiAgentResponsePacing,
  waitAiAgentPacingDelay
} from "../calculateAiAgentResponsePacing";
import { applyAiAgentLivePacing } from "../applyAiAgentLivePacing";
import { startAiAgentTypingPresence } from "../startAiAgentTypingPresence";

const mockedGetWbot = GetTicketWbot as jest.Mock;
const mockedGetJid = getTicketRemoteJid as jest.Mock;
const mockedPresenceSuppressed =
  isWhatsAppDisableAllReadAndPresenceSideEffects as jest.Mock;

function ticket(partial: Record<string, unknown>): Ticket {
  return partial as unknown as Ticket;
}

function whatsapp(partial: Record<string, unknown>): Whatsapp {
  return partial as unknown as Whatsapp;
}

describe("calculateAiAgentResponsePacing", () => {
  const fixedRng = () => 0.5; // jitter 0

  it("resposta curta tem alvo ~2–3s", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "Olá!",
      processingStartedAtMs: 1000,
      nowMs: 1000,
      jitterRng: fixedRng
    });
    expect(r.responseLengthBucket).toBe("short");
    expect(r.targetDurationMs).toBeGreaterThanOrEqual(2000);
    expect(r.targetDurationMs).toBeLessThanOrEqual(3500);
    expect(r.remainingDelayMs).toBe(r.targetDurationMs);
  });

  it("resposta média tem alvo ~3–5s", () => {
    const text = "a".repeat(120);
    const r = calculateAiAgentResponsePacing({
      responseText: text,
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: fixedRng
    });
    expect(r.responseLengthBucket).toBe("medium");
    expect(r.targetDurationMs).toBeGreaterThanOrEqual(3500);
    expect(r.targetDurationMs).toBeLessThanOrEqual(5500);
  });

  it("resposta longa tem alvo maior e respeita teto", () => {
    const text = "a".repeat(400);
    const r = calculateAiAgentResponsePacing({
      responseText: text,
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: fixedRng
    });
    expect(r.responseLengthBucket).toBe("long");
    expect(r.targetDurationMs).toBeGreaterThanOrEqual(5000);
    expect(r.targetDurationMs).toBeLessThanOrEqual(
      AI_AGENT_PACING.absoluteMaxMs
    );
  });

  it("respeita mínimo absoluto em resposta normal", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "ok",
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: () => 0 // jitter negativo máximo
    });
    expect(r.targetDurationMs).toBeGreaterThanOrEqual(
      AI_AGENT_PACING.absoluteMinMs
    );
  });

  it("respeita máximo absoluto", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "x".repeat(5000),
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: () => 1 // jitter positivo máximo
    });
    expect(r.targetDurationMs).toBeLessThanOrEqual(
      AI_AGENT_PACING.absoluteMaxMs
    );
  });

  it("provider lento conta no pacing (atraso restante menor)", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "Olá!",
      processingStartedAtMs: 0,
      nowMs: 2800,
      jitterRng: fixedRng
    });
    expect(r.processingDurationMs).toBe(2800);
    expect(r.remainingDelayMs).toBe(Math.max(0, r.targetDurationMs - 2800));
    expect(r.remainingDelayMs).toBeLessThan(r.targetDurationMs);
  });

  it("provider rápido recebe atraso mínimo restante", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "Oi",
      processingStartedAtMs: 0,
      nowMs: 100,
      jitterRng: fixedRng
    });
    expect(r.remainingDelayMs).toBeGreaterThanOrEqual(
      AI_AGENT_PACING.absoluteMinMs - 100
    );
  });

  it("jitter fica dentro da faixa injetável", () => {
    const low = calculateAiAgentResponsePacing({
      responseText: "Olá mundo",
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: () => 0
    });
    const high = calculateAiAgentResponsePacing({
      responseText: "Olá mundo",
      processingStartedAtMs: 0,
      nowMs: 0,
      jitterRng: () => 1
    });
    expect(low.jitterMs).toBe(-AI_AGENT_PACING.jitterAmplitudeMs);
    expect(high.jitterMs).toBe(AI_AGENT_PACING.jitterAmplitudeMs);
    expect(high.targetDurationMs - low.targetDurationMs).toBeLessThanOrEqual(
      AI_AGENT_PACING.jitterAmplitudeMs * 2
    );
  });

  it("fórmula é determinística com jitterRng fixo", () => {
    const a = calculateAiAgentResponsePacing({
      responseText: "Mesma resposta",
      processingStartedAtMs: 10,
      nowMs: 510,
      jitterRng: () => 0.42
    });
    const b = calculateAiAgentResponsePacing({
      responseText: "Mesma resposta",
      processingStartedAtMs: 10,
      nowMs: 510,
      jitterRng: () => 0.42
    });
    expect(a).toEqual(b);
  });

  it("handoff usa alvo curto/natural", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "Vou transferir você.",
      processingStartedAtMs: 0,
      nowMs: 0,
      kind: "handoff",
      jitterRng: fixedRng
    });
    expect(r.targetDurationMs).toBeGreaterThanOrEqual(2000);
    expect(r.targetDurationMs).toBeLessThanOrEqual(4500);
  });

  it("fallback técnico é curto", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "Não consegui compreender bem o áudio…",
      processingStartedAtMs: 0,
      nowMs: 0,
      kind: "fallback",
      jitterRng: fixedRng
    });
    expect(r.targetDurationMs).toBeLessThanOrEqual(1600);
  });

  it("error não aplica espera longa", () => {
    const r = calculateAiAgentResponsePacing({
      responseText: "",
      processingStartedAtMs: 0,
      nowMs: 0,
      kind: "error",
      jitterRng: fixedRng
    });
    expect(r.targetDurationMs).toBeLessThanOrEqual(1000);
  });

  it("bucketAiAgentResponseLength classifica corretamente", () => {
    expect(bucketAiAgentResponseLength("")).toBe("empty");
    expect(bucketAiAgentResponseLength("curta")).toBe("short");
    expect(bucketAiAgentResponseLength("a".repeat(100))).toBe("medium");
    expect(bucketAiAgentResponseLength("a".repeat(300))).toBe("long");
  });
});

describe("waitAiAgentPacingDelay", () => {
  it("não espera quando remaining=0", async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const result = await waitAiAgentPacingDelay(0, { sleepFn });
    expect(result).toBe("completed");
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("usa sleepFn injetável", async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    await waitAiAgentPacingDelay(1234, { sleepFn });
    expect(sleepFn).toHaveBeenCalledWith(1234);
  });

  it("cancela via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const result = await waitAiAgentPacingDelay(5000, {
      sleepFn,
      signal: controller.signal
    });
    expect(result).toBe("cancelled");
    expect(sleepFn).not.toHaveBeenCalled();
  });
});

describe("applyAiAgentLivePacing", () => {
  it("emite cálculo e aguarda restante", async () => {
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    await applyAiAgentLivePacing({
      processingStartedAtMs: Date.now() - 100,
      responseText: "Oi",
      kind: "normal",
      companyId: 1,
      ticketId: 10,
      agentId: 9,
      whatsappId: 3,
      executionId: "exec-1",
      jitterRng: () => 0.5,
      sleepFn
    });
    expect(sleepFn).toHaveBeenCalled();
    const waited = sleepFn.mock.calls[0][0] as number;
    expect(waited).toBeGreaterThan(0);
    expect(waited).toBeLessThanOrEqual(AI_AGENT_PACING.absoluteMaxMs);
  });
});

describe("startAiAgentTypingPresence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPresenceSuppressed.mockReturnValue(false);
    mockedGetJid.mockResolvedValue("5511999999999@s.whatsapp.net");
    (Contact.findOne as jest.Mock).mockResolvedValue(null);
  });

  function fakeTimers() {
    let renewCb: (() => void) | null = null;
    let maxCb: (() => void) | null = null;
    const clearIntervalFn = jest.fn();
    const clearTimeoutFn = jest.fn();
    const timers = {
      setInterval: ((cb: () => void) => {
        renewCb = cb;
        return { unref: () => undefined } as unknown as NodeJS.Timeout;
      }) as unknown as typeof setInterval,
      setTimeout: ((cb: () => void) => {
        maxCb = cb;
        return { unref: () => undefined } as unknown as NodeJS.Timeout;
      }) as unknown as typeof setTimeout,
      clearInterval: clearIntervalFn as unknown as typeof clearInterval,
      clearTimeout: clearTimeoutFn as unknown as typeof clearTimeout
    };
    return {
      timers,
      clearIntervalFn,
      clearTimeoutFn,
      runRenew: () => renewCb?.(),
      runMax: () => maxCb?.()
    };
  }

  it("envia composing, renova e paused no stop", async () => {
    const sendPresenceUpdate = jest.fn().mockResolvedValue(undefined);
    const presenceSubscribe = jest.fn().mockResolvedValue(undefined);
    mockedGetWbot.mockResolvedValue({ sendPresenceUpdate, presenceSubscribe });
    const { timers, clearIntervalFn, runRenew } = fakeTimers();

    const handle = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 10,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-a",
      renewIntervalMs: 1000,
      maxDurationMs: 10_000,
      timers
    });

    expect(handle.started).toBe(true);
    expect(presenceSubscribe).toHaveBeenCalledWith(
      "5511999999999@s.whatsapp.net"
    );
    expect(sendPresenceUpdate).toHaveBeenCalledWith(
      "composing",
      "5511999999999@s.whatsapp.net"
    );

    const before = sendPresenceUpdate.mock.calls.length;
    runRenew();
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
    expect(sendPresenceUpdate.mock.calls.length).toBeGreaterThan(before);

    await handle.stop("after_send");
    expect(sendPresenceUpdate).toHaveBeenCalledWith(
      "paused",
      "5511999999999@s.whatsapp.net"
    );
    expect(clearIntervalFn).toHaveBeenCalled();
    await handle.stop("again");
  });

  it("falha de presence não bloqueia (started=false, stop ok)", async () => {
    mockedGetWbot.mockRejectedValue(new Error("wbot offline"));
    const handle = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 11,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-b",
      timers: fakeTimers().timers
    });
    expect(handle.started).toBe(false);
    await expect(handle.stop("provider_failed")).resolves.toBeUndefined();
  });

  it("whatsapp mismatch não inicia typing", async () => {
    const sendPresenceUpdate = jest.fn();
    mockedGetWbot.mockResolvedValue({ sendPresenceUpdate });
    const handle = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 12,
        companyId: 1,
        contactId: 2,
        whatsappId: 99,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-c"
    });
    expect(handle.started).toBe(false);
    expect(mockedGetWbot).not.toHaveBeenCalled();
  });

  it("presence suppressed não envia composing", async () => {
    mockedPresenceSuppressed.mockReturnValue(true);
    const handle = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 13,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-d"
    });
    expect(handle.started).toBe(false);
    expect(mockedGetWbot).not.toHaveBeenCalled();
  });

  it("max duration encerra typing", async () => {
    const sendPresenceUpdate = jest.fn().mockResolvedValue(undefined);
    mockedGetWbot.mockResolvedValue({ sendPresenceUpdate });
    const { timers, runMax } = fakeTimers();

    const handle = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 14,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-e",
      renewIntervalMs: 50_000,
      maxDurationMs: 2000,
      timers
    });

    runMax();
    await Promise.resolve();
    await Promise.resolve();
    expect(sendPresenceUpdate).toHaveBeenCalledWith(
      "paused",
      "5511999999999@s.whatsapp.net"
    );
    await handle.stop("cleanup");
  });

  it("isolamento multiagente: sessions independentes por executionId", async () => {
    const sendA = jest.fn().mockResolvedValue(undefined);
    const sendB = jest.fn().mockResolvedValue(undefined);
    mockedGetWbot
      .mockResolvedValueOnce({ sendPresenceUpdate: sendA })
      .mockResolvedValueOnce({ sendPresenceUpdate: sendB });

    mockedGetJid
      .mockResolvedValueOnce("111@s.whatsapp.net")
      .mockResolvedValueOnce("222@s.whatsapp.net");

    const a = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 21,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "exec-t1",
      timers: fakeTimers().timers
    });
    const b = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 22,
        companyId: 1,
        contactId: 3,
        whatsappId: 4,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 4 }),
      companyId: 1,
      agentId: 10,
      executionId: "exec-t2",
      timers: fakeTimers().timers
    });

    expect(a.executionId).toBe("exec-t1");
    expect(b.executionId).toBe("exec-t2");
    await a.stop("done");
    expect(sendA).toHaveBeenCalledWith("paused", "111@s.whatsapp.net");
    expect(sendB).not.toHaveBeenCalledWith("paused", expect.anything());
    await b.stop("done");
    expect(sendB).toHaveBeenCalledWith("paused", "222@s.whatsapp.net");
  });

  it("tenant isolation: companyId diferente não compartilha handle", async () => {
    const sendPresenceUpdate = jest.fn().mockResolvedValue(undefined);
    mockedGetWbot.mockResolvedValue({ sendPresenceUpdate });
    mockedGetJid.mockResolvedValue("5511888888888@s.whatsapp.net");

    const t1 = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 31,
        companyId: 1,
        contactId: 2,
        whatsappId: 3,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 3 }),
      companyId: 1,
      agentId: 9,
      executionId: "c1-exec",
      timers: fakeTimers().timers
    });
    const t2 = await startAiAgentTypingPresence({
      ticket: ticket({
        id: 32,
        companyId: 2,
        contactId: 5,
        whatsappId: 8,
        isGroup: false
      }),
      whatsapp: whatsapp({ id: 8 }),
      companyId: 2,
      agentId: 20,
      executionId: "c2-exec",
      timers: fakeTimers().timers
    });

    expect(t1.executionId).not.toBe(t2.executionId);
    await t1.stop("c1");
    await t2.stop("c2");
  });
});

describe("Shadow / Simulator policy (documentada)", () => {
  it("Shadow não importa presence (módulo não acoplado ao ShadowService)", () => {
    const shadowSrc = fs.readFileSync(
      path.join(__dirname, "../AiAgentShadowService.ts"),
      "utf8"
    );
    expect(shadowSrc).not.toMatch(/startAiAgentTypingPresence/);
    expect(shadowSrc).not.toMatch(/applyAiAgentLivePacing/);
  });

  it("Simulator calcula preview sem presence real", () => {
    const simSrc = fs.readFileSync(
      path.join(__dirname, "../AiAgentSimulationService.ts"),
      "utf8"
    );
    expect(simSrc).toMatch(/pacingPreview/);
    expect(simSrc).toMatch(/appliedInSimulator: false/);
    expect(simSrc).not.toMatch(/startAiAgentTypingPresence/);
  });
});
