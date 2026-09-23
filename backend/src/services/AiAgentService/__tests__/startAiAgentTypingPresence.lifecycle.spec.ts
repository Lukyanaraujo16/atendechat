/* eslint-disable import/first */
/**
 * 12.4-F2 — lifecycle/race de typing: renew in-flight vs stop().
 */
const getOutbound = jest.fn();
const sendPresence = jest.fn();
const loggerInfo = jest.fn();

jest.mock("../../../modules/whatsapp/outbound/resolveWhatsAppOutbound", () => ({
  getWhatsAppOutboundForTicket: (...a: unknown[]) => getOutbound(...a)
}));

jest.mock("../../../helpers/GetTicketRemoteJid", () => ({
  getTicketRemoteJid: jest
    .fn()
    .mockResolvedValue("5511999998888@s.whatsapp.net")
}));

jest.mock("../../../helpers/whatsappUnavailablePresence", () => ({
  isWhatsAppDisableAllReadAndPresenceSideEffects: () => false
}));

jest.mock("@whiskeysockets/baileys", () => ({
  jidNormalizedUser: (j: string) => j
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: (...a: unknown[]) => loggerInfo(...a),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

import { startAiAgentTypingPresence } from "../startAiAgentTypingPresence";

function typingEvents(): string[] {
  return loggerInfo.mock.calls
    .map(call =>
      call[0] && typeof call[0] === "object"
        ? String((call[0] as { event?: string }).event || "")
        : ""
    )
    .filter(event => event.startsWith("ai_agent.typing_"));
}

function fakeTimers() {
  let renewCb: (() => void) | null = null;
  const clearIntervalFn = jest.fn();
  const clearTimeoutFn = jest.fn();
  const timers = {
    setInterval: ((cb: () => void) => {
      renewCb = cb;
      return { unref: () => undefined } as unknown as NodeJS.Timeout;
    }) as unknown as typeof setInterval,
    setTimeout: ((_cb: () => void) => {
      return { unref: () => undefined } as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
    clearInterval: clearIntervalFn as unknown as typeof clearInterval,
    clearTimeout: clearTimeoutFn as unknown as typeof clearTimeout
  };
  return {
    timers,
    clearIntervalFn,
    runRenew: () => renewCb?.()
  };
}

const ticket = {
  id: 1,
  contactId: 2,
  companyId: 1,
  whatsappId: 10,
  isGroup: false
} as never;

const whatsapp = { id: 10 } as never;

async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

describe("startAiAgentTypingPresence lifecycle 12.4-F2", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendPresence.mockResolvedValue(true);
    getOutbound.mockResolvedValue({
      provider: "evolution",
      sendPresence
    });
  });

  it("CASO 1 — start, renew e stop emitem started / renewed / stopped", async () => {
    const { timers, runRenew, clearIntervalFn } = fakeTimers();
    const handle = await startAiAgentTypingPresence({
      ticket,
      whatsapp,
      companyId: 1,
      executionId: "exec-normal",
      timers: timers as never
    });

    expect(handle.started).toBe(true);
    expect(typingEvents()).toContain("ai_agent.typing_started");
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ presence: "composing" })
    );

    runRenew();
    await flush();
    expect(typingEvents()).toContain("ai_agent.typing_renewed");

    await handle.stop("live_finished");
    expect(sendPresence).toHaveBeenCalledWith(
      expect.objectContaining({ presence: "paused" })
    );
    expect(clearIntervalFn).toHaveBeenCalled();
    const events = typingEvents();
    expect(events.filter(e => e === "ai_agent.typing_stopped")).toHaveLength(1);
    const stoppedAt = events.lastIndexOf("ai_agent.typing_stopped");
    const renewedAfterStop = events
      .slice(stoppedAt + 1)
      .includes("ai_agent.typing_renewed");
    expect(renewedAfterStop).toBe(false);
  });

  it("CASO 2 — composing in-flight após stop não emite renewed e compensates paused", async () => {
    const { timers, runRenew } = fakeTimers();
    let composingCount = 0;
    let resolveLateComposing: ((value: boolean) => void) | null = null;
    sendPresence.mockImplementation(async (input: { presence: string }) => {
      if (input.presence === "composing") {
        composingCount += 1;
        if (composingCount === 1) return true;
        return new Promise<boolean>(resolve => {
          resolveLateComposing = resolve;
        });
      }
      return true;
    });

    const handle = await startAiAgentTypingPresence({
      ticket,
      whatsapp,
      companyId: 1,
      executionId: "exec-race",
      timers: timers as never
    });
    expect(handle.started).toBe(true);

    runRenew();
    await flush();
    expect(resolveLateComposing).toBeTruthy();
    expect(typingEvents()).not.toContain("ai_agent.typing_renewed");

    await handle.stop("live_finished");
    expect(typingEvents()).toContain("ai_agent.typing_stopped");
    const pausedAfterStop = sendPresence.mock.calls.filter(
      (c: [{ presence: string }]) => c[0].presence === "paused"
    ).length;
    expect(pausedAfterStop).toBeGreaterThanOrEqual(1);

    resolveLateComposing!(true);
    await flush();

    const events = typingEvents();
    const stoppedAt = events.indexOf("ai_agent.typing_stopped");
    expect(stoppedAt).toBeGreaterThanOrEqual(0);
    expect(events.slice(stoppedAt + 1)).not.toContain(
      "ai_agent.typing_renewed"
    );
    expect(events.filter(e => e === "ai_agent.typing_renewed")).toHaveLength(0);

    const pausedTotal = sendPresence.mock.calls.filter(
      (c: [{ presence: string }]) => c[0].presence === "paused"
    ).length;
    expect(pausedTotal).toBeGreaterThan(pausedAfterStop);
  });

  it("CASO 3 — falha de composing no renew não gera unhandled rejection nem renewed", async () => {
    const { timers, runRenew } = fakeTimers();
    let composingCount = 0;
    sendPresence.mockImplementation(async (input: { presence: string }) => {
      if (input.presence === "composing") {
        composingCount += 1;
        if (composingCount === 1) return true;
        throw new Error("presence_timeout");
      }
      return true;
    });

    const handle = await startAiAgentTypingPresence({
      ticket,
      whatsapp,
      companyId: 1,
      executionId: "exec-fail",
      timers: timers as never
    });

    runRenew();
    await flush();
    expect(typingEvents()).not.toContain("ai_agent.typing_renewed");
    expect(typingEvents()).toContain("ai_agent.typing_failed");
    await expect(handle.stop("after_fail")).resolves.toBeUndefined();
    expect(typingEvents()).toContain("ai_agent.typing_stopped");
  });

  it("CASO 4 — stop repetido não reativa nem duplica stopped", async () => {
    const { timers } = fakeTimers();
    const handle = await startAiAgentTypingPresence({
      ticket,
      whatsapp,
      companyId: 1,
      executionId: "exec-stop-twice",
      timers: timers as never
    });

    await handle.stop("first");
    const pausedAfterFirst = sendPresence.mock.calls.filter(
      (c: [{ presence: string }]) => c[0].presence === "paused"
    ).length;
    const stoppedCount = typingEvents().filter(
      e => e === "ai_agent.typing_stopped"
    ).length;

    await handle.stop("second");
    const pausedAfterSecond = sendPresence.mock.calls.filter(
      (c: [{ presence: string }]) => c[0].presence === "paused"
    ).length;
    const stoppedAfterSecond = typingEvents().filter(
      e => e === "ai_agent.typing_stopped"
    ).length;

    expect(pausedAfterSecond).toBe(pausedAfterFirst);
    expect(stoppedAfterSecond).toBe(stoppedCount);
    expect(stoppedAfterSecond).toBe(1);
    expect(typingEvents()).not.toContain("ai_agent.typing_renewed");
  });
});
