/**
 * Integração (Postgres real) — renovação administrativa.
 * Cobre o incidente P0: Companies.dueDate (timestamptz) chega como Date e era gravado em
 * SaaSSubscriptionRenewals.previousDueDate (STRING) → SequelizeValidationError → HTTP 500.
 */
import sequelize from "../database";
import RenewCompanyDueDateService from "../services/CompanyService/RenewCompanyDueDateService";
import { applySubscriptionRenewal } from "../services/SaasBilling/applySubscriptionRenewal";
import {
  DOMAIN_DATE_RE,
  addMonths,
  assertDisposableDatabase,
  catchError,
  countState,
  createCompany,
  createUser,
  daysFromToday,
  describeError,
  domainDate,
  rawRenewals,
  reloadCompany,
  today
} from "./helpers/fixtures";

const RECURRENCES: Array<[string, number]> = [
  ["MENSAL", 1],
  ["TRIMESTRAL", 3],
  ["SEMESTRAL", 6],
  ["ANUAL", 12]
];

/** Chamada no contrato do ROADMAP: (id, userId, { reason, expectedCurrentDueDate }). */
const renew = (id: number, userId: number | null, expected?: string | null) =>
  (RenewCompanyDueDateService as any)(id, userId, {
    reason: "Renovação de teste de integração",
    ...(expected === undefined ? {} : { expectedCurrentDueDate: expected })
  });

describe("Renovação administrativa (Postgres real)", () => {
  let superUserId: number;

  beforeAll(async () => {
    await assertDisposableDatabase();
    const host = await createCompany({ dueDate: daysFromToday(365) });
    superUserId = (await createUser({ companyId: host.id, superUser: true })).id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("pré-condição do P0: Company.dueDate lido do banco é um objeto Date", async () => {
    const company = await createCompany({ dueDate: daysFromToday(5) });
    expect(company.dueDate as unknown).toBeInstanceOf(Date);
  });

  describe.each(RECURRENCES)("recorrência %s (+%i meses)", (recurrence, months) => {
    it("dueDate futuro vindo do banco (Date): estende a partir do vencimento atual e grava previousDueDate YYYY-MM-DD", async () => {
      const due = daysFromToday(5);
      const company = await createCompany({ dueDate: due, recurrence });
      expect(company.dueDate as unknown).toBeInstanceOf(Date);

      const err = await catchError(renew(company.id, superUserId, due));
      expect(describeError(err)).toBe("sem erro");

      const after = await reloadCompany(company.id);
      expect(domainDate(after.dueDate)).toBe(addMonths(due, months));

      const rows = await rawRenewals(company.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].reason).toBe("manual_renew");
      expect(rows[0].previousDueDate).toBe(due);
      expect(rows[0].previousDueDate).toMatch(DOMAIN_DATE_RE);
      expect(rows[0].newDueDate).toBe(addMonths(due, months));
      expect(rows[0].monthsAdded).toBe(months);
    });

    it("dueDate null: renova a partir de hoje", async () => {
      const company = await createCompany({ dueDate: null, recurrence });
      const err = await catchError(renew(company.id, superUserId, null));
      expect(describeError(err)).toBe("sem erro");

      const after = await reloadCompany(company.id);
      expect(domainDate(after.dueDate)).toBe(addMonths(today(), months));
      const rows = await rawRenewals(company.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].previousDueDate).toBeNull();
    });
  });

  it("empresa bloqueada e vencida volta a status=true com vencimento futuro", async () => {
    const due = daysFromToday(-40);
    const company = await createCompany({ dueDate: due, status: false, recurrence: "MENSAL" });

    const result: any = await renew(company.id, superUserId, due);
    expect(result.autoUnblocked).toBe(true);

    const after = await reloadCompany(company.id);
    expect(after.status).toBe(true);
    const newDue = domainDate(after.dueDate) as string;
    expect(newDue > today()).toBe(true);

    const rows = await rawRenewals(company.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].previousDueDate).toBe(due);
    expect(rows[0].newDueDate).toBe(newDue);
  });

  it("motor direto (applySubscriptionRenewal manual_renew) com dueDate Date não lança SequelizeValidationError", async () => {
    const due = daysFromToday(-3);
    const company = await createCompany({ dueDate: due });
    const err = await catchError(
      applySubscriptionRenewal({
        companyId: company.id,
        reason: "manual_renew",
        actorUserId: superUserId,
        note: "teste motor"
      } as any)
    );
    expect(describeError(err)).toBe("sem erro");
    const rows = await rawRenewals(company.id);
    expect(rows[0].previousDueDate).toBe(due);
  });

  it("ajuste de vencimento (due_date_adjustment) com dueDate Date grava previousDueDate YYYY-MM-DD", async () => {
    const due = daysFromToday(-3);
    const target = daysFromToday(20);
    const company = await createCompany({ dueDate: due, status: false });
    const err = await catchError(
      applySubscriptionRenewal({
        companyId: company.id,
        reason: "due_date_adjustment",
        actorUserId: superUserId,
        explicitDueDate: target,
        note: "ajuste teste"
      } as any)
    );
    expect(describeError(err)).toBe("sem erro");
    const after = await reloadCompany(company.id);
    expect(domainDate(after.dueDate)).toBe(target);
    const rows = await rawRenewals(company.id);
    expect(rows[0].previousDueDate).toBe(due);
    expect(rows[0].newDueDate).toBe(target);
  });

  it("sem justificativa → ERR_RENEWAL_REASON_REQUIRED (400) e nada é gravado", async () => {
    const company = await createCompany({ dueDate: daysFromToday(5) });
    const err = await catchError(
      (RenewCompanyDueDateService as any)(company.id, superUserId, { reason: " ", expectedCurrentDueDate: null })
    );
    expect(err?.message).toBe("ERR_RENEWAL_REASON_REQUIRED");
    expect(err?.statusCode).toBe(400);
    expect((await countState(company.id)).renewals).toBe(0);
  });

  describe("renovação duplicada / concorrente (expectedCurrentDueDate)", () => {
    it("duas chamadas sequenciais com o mesmo expectedCurrentDueDate → 1 extensão; a segunda recebe ERR_RENEWAL_STALE (409)", async () => {
      const due = daysFromToday(5);
      const company = await createCompany({ dueDate: due, recurrence: "MENSAL" });

      await renew(company.id, superUserId, due);
      const err = await catchError(renew(company.id, superUserId, due));
      expect(err?.message).toBe("ERR_RENEWAL_STALE");
      expect(err?.statusCode).toBe(409);

      const after = await reloadCompany(company.id);
      expect(domainDate(after.dueDate)).toBe(addMonths(due, 1));
      expect(await rawRenewals(company.id)).toHaveLength(1);
    });

    it("duas chamadas SIMULTÂNEAS (Promise.all) com o mesmo expectedCurrentDueDate → exatamente 1 extensão", async () => {
      const due = daysFromToday(5);
      const company = await createCompany({ dueDate: due, recurrence: "MENSAL" });

      const results = await Promise.allSettled([
        renew(company.id, superUserId, due),
        renew(company.id, superUserId, due)
      ]);
      const ok = results.filter(r => r.status === "fulfilled");
      const failed = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].reason?.message).toBe("ERR_RENEWAL_STALE");

      const after = await reloadCompany(company.id);
      expect(domainDate(after.dueDate)).toBe(addMonths(due, 1));
      expect(await rawRenewals(company.id)).toHaveLength(1);
    });

    it("expectedCurrentDueDate null quando a empresa já tem vencimento → ERR_RENEWAL_STALE", async () => {
      const company = await createCompany({ dueDate: daysFromToday(5) });
      const err = await catchError(renew(company.id, superUserId, null));
      expect(err?.message).toBe("ERR_RENEWAL_STALE");
      expect(await rawRenewals(company.id)).toHaveLength(0);
    });
  });
});
