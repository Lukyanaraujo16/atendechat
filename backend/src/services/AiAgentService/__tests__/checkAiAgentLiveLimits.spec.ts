/* eslint-disable import/first */
jest.mock("../../../models/AiAgentRuntimeLog", () => ({
  __esModule: true,
  default: {
    count: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  }
}));

import { Op } from "sequelize";
import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import {
  checkAiAgentLiveLimits,
  resolveAiAgentLiveCycleCutoff
} from "../checkAiAgentLiveLimits";
import {
  AI_AGENT_LIVE_COOLDOWN_MS,
  AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET
} from "../aiAgentLiveConfig";
import { AI_AGENT_LIVE_ERROR_CODES } from "../aiAgentLiveErrors";

const countMock = AiAgentRuntimeLog.count as jest.Mock;
const findOneMock = AiAgentRuntimeLog.findOne as jest.Mock;
const findAllMock = AiAgentRuntimeLog.findAll as jest.Mock;
const createMock = AiAgentRuntimeLog.create as jest.Mock;
const updateMock = AiAgentRuntimeLog.update as jest.Mock;
const destroyMock = AiAgentRuntimeLog.destroy as jest.Mock;

const CYCLE = new Date("2026-09-23T12:00:00.000Z");

function countWhere() {
  return countMock.mock.calls[0][0].where as Record<string, unknown>;
}

describe("resolveAiAgentLiveCycleCutoff", () => {
  it("null/undefined/inválido → lifetime (sem cutoff)", () => {
    expect(resolveAiAgentLiveCycleCutoff(null)).toBeNull();
    expect(resolveAiAgentLiveCycleCutoff(undefined)).toBeNull();
    expect(resolveAiAgentLiveCycleCutoff("")).toBeNull();
    expect(resolveAiAgentLiveCycleCutoff("not-a-date")).toBeNull();
  });

  it("Date/ISO → cutoff do ciclo atual", () => {
    expect(resolveAiAgentLiveCycleCutoff(CYCLE)).toEqual(CYCLE);
    expect(
      resolveAiAgentLiveCycleCutoff("2026-09-23T12:00:00.000Z")
    ).toEqual(CYCLE);
  });
});

describe("checkAiAgentLiveLimits — cota por ciclo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOneMock.mockResolvedValue(null);
    findAllMock.mockResolvedValue([]);
  });

  it("1 — mesmo ciclo com 5 SENT Live → deny live_ticket_limit_reached", async () => {
    countMock.mockResolvedValue(AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({
      allowed: false,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_TICKET_LIMIT_REACHED
    });
    expect(countWhere().mode).toBe("live");
    expect(countWhere().sentAt).toEqual({ [Op.gte]: CYCLE });
  });

  it("2 — mesmo ciclo com 4 SENT Live → allowed nesse limite", async () => {
    countMock.mockResolvedValue(AI_AGENT_LIVE_MAX_REPLIES_PER_TICKET - 1);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({ allowed: true });
    expect(countWhere().sentAt).toEqual({ [Op.gte]: CYCLE });
  });

  it("3 — 5+ SENT do ciclo anterior + zero no atual → allowed", async () => {
    countMock.mockImplementation(async ({ where }) => {
      if (where.sentAt?.[Op.gte]?.getTime() === CYCLE.getTime()) {
        return 0;
      }
      return 9;
    });

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({ allowed: true });
    expect(countWhere().sentAt).toEqual({ [Op.gte]: CYCLE });
  });

  it("4 — 5+ SENT anteriores + 4 SENT atuais → allowed", async () => {
    countMock.mockResolvedValue(4);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({ allowed: true });
  });

  it("5 — 5+ SENT anteriores + 5 SENT atuais → deny", async () => {
    countMock.mockResolvedValue(5);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.errorCode).toBe(
        AI_AGENT_LIVE_ERROR_CODES.LIVE_TICKET_LIMIT_REACHED
      );
    }
  });

  it("6 — aiAgentCycleStartedAt null → lifetime (sem filtro sentAt)", async () => {
    countMock.mockResolvedValue(5);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: null
    });

    expect(result.allowed).toBe(false);
    if (result.allowed === false) {
      expect(result.errorCode).toBe(
        AI_AGENT_LIVE_ERROR_CODES.LIVE_TICKET_LIMIT_REACHED
      );
    }
    expect(countWhere().sentAt).toBeUndefined();
    expect(countWhere().ticketId).toBe(11);
  });

  it("11 — cooldown ignora sentAt do ciclo anterior", async () => {
    countMock.mockResolvedValue(1);
    findOneMock.mockResolvedValue(null);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({ allowed: true });
    expect(findOneMock.mock.calls[0][0].where.sentAt).toEqual({
      [Op.gte]: CYCLE
    });
  });

  it("12 — cooldown continua bloqueando dentro do ciclo atual", async () => {
    countMock.mockResolvedValue(1);
    findOneMock.mockResolvedValue({
      sentAt: new Date(Date.now() - AI_AGENT_LIVE_COOLDOWN_MS / 2)
    });

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({
      allowed: false,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_COOLDOWN_ACTIVE
    });
  });

  it("13 — falhas consecutivas do ciclo anterior não contaminam o atual", async () => {
    countMock.mockResolvedValue(0);
    findAllMock.mockResolvedValue([]);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({ allowed: true });
    expect(findAllMock.mock.calls[0][0].where.createdAt).toEqual({
      [Op.gte]: CYCLE
    });
  });

  it("14 — falhas consecutivas do ciclo atual continuam bloqueando", async () => {
    const failedAt = new Date("2026-09-23T12:10:00.000Z");
    countMock.mockImplementation(async ({ where }) => {
      if (where.deliveryStatus) return 0;
      return 0;
    });
    findAllMock.mockResolvedValue([
      { id: 21, liveStatus: "failed", createdAt: failedAt },
      { id: 20, liveStatus: "failed", createdAt: failedAt }
    ]);

    const result = await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(result).toEqual({
      allowed: false,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_GENERATION_FAILED
    });
    const successWhere = countMock.mock.calls[1][0].where;
    expect(successWhere.createdAt[Op.gte]).toEqual(CYCLE);
    expect(successWhere.createdAt[Op.gt]).toEqual(failedAt);
  });

  it("15 — RuntimeLogs históricos não são apagados nem mutados", async () => {
    countMock.mockResolvedValue(0);

    await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(destroyMock).not.toHaveBeenCalled();
  });

  it("16 — Shadow permanece fora da cota Live (mode=live na query)", async () => {
    countMock.mockResolvedValue(0);

    await checkAiAgentLiveLimits({
      companyId: 1,
      ticketId: 11,
      aiAgentCycleStartedAt: CYCLE
    });

    expect(countWhere().mode).toBe("live");
    expect(countWhere().mode).not.toBe("shadow");
  });
});
