import { Request, Response } from "express";
import logAiAgentProductSupportWrite from "../logAiAgentProductSupportWrite";

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

import { logger } from "../../utils/logger";

describe("logAiAgentProductSupportWrite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("não registra quando fora do supportMode", () => {
    const mw = logAiAgentProductSupportWrite("ai_agent.product.command");
    const req = {
      user: { id: 1, companyId: 10, supportMode: false },
      params: {},
      body: {},
      query: {},
      method: "POST",
      baseUrl: "",
      path: "/product/ai-agent/commands"
    } as unknown as Request;
    const handlers: Record<string, () => void> = {};
    const res = {
      statusCode: 200,
      on: (ev: string, fn: () => void) => {
        handlers[ev] = fn;
      }
    } as unknown as Response;
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
    handlers.finish?.();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("registra audit estruturado sem secrets em supportMode", () => {
    const mw = logAiAgentProductSupportWrite("ai_agent.product.command");
    const req = {
      user: {
        id: 7,
        companyId: 99,
        supportMode: true,
        supportHomeCompanyId: 1
      },
      params: { agentRef: "ref-a" },
      body: { command: "activate_live", apiKey: "sk-should-not-log" },
      query: {},
      method: "POST",
      baseUrl: "",
      path: "/product/ai-agent/agents/ref-a/commands"
    } as unknown as Request;
    const handlers: Record<string, () => void> = {};
    const res = {
      statusCode: 200,
      on: (ev: string, fn: () => void) => {
        handlers[ev] = fn;
      }
    } as unknown as Response;
    mw(req, res, jest.fn());
    handlers.finish?.();
    expect(logger.info).toHaveBeenCalled();
    const payload = (logger.info as jest.Mock).mock.calls[0][0];
    expect(payload.event).toBe("ai_agent.product.support_write");
    expect(payload.actorUserId).toBe(7);
    expect(payload.targetCompanyId).toBe(99);
    expect(payload.agentRef).toBe("ref-a");
    expect(payload.supportMode).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/sk-should-not-log/);
    expect(payload).not.toHaveProperty("apiKey");
  });
});
