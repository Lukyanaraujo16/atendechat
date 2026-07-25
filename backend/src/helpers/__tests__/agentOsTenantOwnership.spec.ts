/**
 * Fase 1.4.1 — ownership HTTP por entidade (cross-tenant).
 */
import AppError from "../../errors/AppError";
import {
  __resetAgentOsActionOwnershipIndexForTests,
  assertCompanyOwnsActionId,
  assertRecordOwnedByCompany,
  companyOwnsActionId,
  filterActionResultsForCompany,
  filterRecordsOwnedByCompany,
  rememberCompanyActionId
} from "../agentOsTenantOwnership";

describe("agentOsTenantOwnership", () => {
  beforeEach(() => {
    __resetAgentOsActionOwnershipIndexForTests();
  });

  describe("assertRecordOwnedByCompany", () => {
    it("permite registro do mesmo tenant", () => {
      expect(() =>
        assertRecordOwnedByCompany({ companyId: 10 }, 10)
      ).not.toThrow();
    });

    it("404 seguro para outro tenant", () => {
      try {
        assertRecordOwnedByCompany({ companyId: 99 }, 10);
        fail("expected throw");
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).statusCode).toBe(404);
        expect((e as AppError).message).toBe("ERR_NOT_FOUND");
      }
    });

    it("404 seguro para companyId null (incidente global)", () => {
      try {
        assertRecordOwnedByCompany({ companyId: null }, 10);
        fail("expected throw");
      } catch (e) {
        expect((e as AppError).statusCode).toBe(404);
      }
    });

    it("404 seguro para registro inexistente", () => {
      try {
        assertRecordOwnedByCompany(null, 10);
        fail("expected throw");
      } catch (e) {
        expect((e as AppError).statusCode).toBe(404);
      }
    });
  });

  describe("filterRecordsOwnedByCompany", () => {
    it("remove cross-tenant e null companyId", () => {
      const out = filterRecordsOwnedByCompany(
        [
          { id: "a", companyId: 1 },
          { id: "b", companyId: 2 },
          { id: "c", companyId: null },
          { id: "d", companyId: 1 }
        ],
        1
      );
      expect(out.map(r => r.id)).toEqual(["a", "d"]);
    });
  });

  describe("actionId index", () => {
    it("bloqueia actionId de outro tenant e permite do mesmo", () => {
      rememberCompanyActionId(1, "act-own");
      rememberCompanyActionId(2, "act-other");

      expect(companyOwnsActionId(1, "act-own")).toBe(true);
      expect(companyOwnsActionId(1, "act-other")).toBe(false);

      expect(() => assertCompanyOwnsActionId(1, "act-own")).not.toThrow();
      try {
        assertCompanyOwnsActionId(1, "act-other");
        fail("expected throw");
      } catch (e) {
        expect((e as AppError).statusCode).toBe(404);
      }
    });

    it("filtra results pelo índice do tenant", () => {
      rememberCompanyActionId(5, "a1");
      const filtered = filterActionResultsForCompany(
        [{ actionId: "a1" }, { actionId: "a2" }, { actionId: "x" }],
        5
      );
      expect(filtered).toEqual([{ actionId: "a1" }]);
    });
  });
});
