import AppError from "../../errors/AppError";
import { resolveRequestCompanyContext } from "../resolveRequestCompanyContext";

describe("resolveRequestCompanyContext", () => {
  it("retorna empresa da sessão", () => {
    const ctx = resolveRequestCompanyContext({
      user: { id: "9", companyId: 42, supportMode: false },
      query: {},
      body: {}
    } as any);
    expect(ctx.companyId).toBe(42);
    expect(ctx.userId).toBe(9);
    expect(ctx.supportMode).toBe(false);
  });

  it("aceita supportMode com companyId ativo", () => {
    const ctx = resolveRequestCompanyContext({
      user: {
        id: "9",
        companyId: 7,
        supportMode: true,
        supportHomeCompanyId: 1
      },
      query: {},
      body: {}
    } as any);
    expect(ctx.companyId).toBe(7);
    expect(ctx.supportMode).toBe(true);
    expect(ctx.supportHomeCompanyId).toBe(1);
  });

  it("sem companyId → ERR_AGENTOS_TENANT_CONTEXT_REQUIRED", () => {
    expect(() =>
      resolveRequestCompanyContext({
        user: { id: "9", companyId: null },
        query: {},
        body: {}
      } as any)
    ).toThrow(AppError);
    try {
      resolveRequestCompanyContext({
        user: { id: "9", companyId: null },
        query: {},
        body: {}
      } as any);
    } catch (e: any) {
      expect(e.message).toBe("ERR_AGENTOS_TENANT_CONTEXT_REQUIRED");
      expect(e.statusCode).toBe(403);
    }
  });

  it("companyId arbitrário na query → ERR_AGENTOS_TENANT_ACCESS_DENIED", () => {
    try {
      resolveRequestCompanyContext({
        user: { id: "9", companyId: 42 },
        query: { companyId: "99" },
        body: {}
      } as any);
      fail("expected throw");
    } catch (e: any) {
      expect(e.message).toBe("ERR_AGENTOS_TENANT_ACCESS_DENIED");
      expect(e.statusCode).toBe(403);
    }
  });

  it("companyId igual na query é aceito", () => {
    const ctx = resolveRequestCompanyContext({
      user: { id: "9", companyId: 42 },
      query: { companyId: "42" },
      body: {}
    } as any);
    expect(ctx.companyId).toBe(42);
  });
});
