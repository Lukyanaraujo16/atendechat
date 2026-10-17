/**
 * Integração (Postgres real) — notificações financeiras do Super Admin (âmbito plataforma, companyId NULL).
 *
 * Regressão: o changeColumn das migrations 20260424100000/20260428120000 não removia o NOT NULL no Postgres
 * (Sequelize 5 gera só ADD FOREIGN KEY). CreateUserNotificationService engolia o erro → notificações de
 * renovação/reativação/cobrança ao Super Admin nunca eram gravadas. Corrigido em 20261019120000.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import UserNotification from "../models/UserNotification";
import UserNotificationPreferences from "../models/UserNotificationPreferences";
import {
  notifySuperAdminsBillingReactivated,
  notifySuperAdminsBillingRenewal
} from "../services/CompanyService/notifySuperAdminsBilling";
import CreateUserNotificationService from "../services/UserNotificationService/CreateUserNotificationService";
import ListUserNotificationsService from "../services/UserNotificationService/ListUserNotificationsService";
import UpsertMyNotificationPreferencesService from "../services/UserNotificationPreferences/UpsertMyNotificationPreferencesService";
import { assertDisposableDatabase, createCompany, createUser } from "./helpers/fixtures";

describe("Notificações de plataforma do Super Admin (Postgres real)", () => {
  beforeAll(async () => {
    await assertDisposableDatabase();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("schema: companyId aceita NULL em UserNotifications e UserNotificationPreferences", async () => {
    const rows = await sequelize.query<{ table_name: string; is_nullable: string }>(
      `SELECT table_name, is_nullable FROM information_schema.columns
       WHERE column_name = 'companyId'
         AND table_name IN ('UserNotifications', 'UserNotificationPreferences')`,
      { type: QueryTypes.SELECT }
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.is_nullable).toBe("YES");
  });

  it("renovação/reativação gravam notificação de plataforma para cada Super Admin; tenant não vê", async () => {
    const host = await createCompany();
    const superUser = await createUser({ companyId: host.id, superUser: true });
    const client = await createCompany();
    const tenantUser = await createUser({ companyId: client.id, profile: "admin" });

    await notifySuperAdminsBillingRenewal(client, "2026-09-10", "2026-11-10");
    await notifySuperAdminsBillingReactivated(client, "2026-11-10");

    const forSuper = await UserNotification.findAll({
      where: { userId: superUser.id },
      order: [["id", "ASC"]]
    });
    const billing = forSuper.filter(n => String(n.type).startsWith("company_billing"));
    expect(billing.length).toBeGreaterThanOrEqual(2);
    for (const n of billing) {
      expect(n.companyId).toBeNull();
      expect((n.data as any)?.companyId).toBe(client.id);
    }

    // Super Admin logado numa empresa vê as de plataforma (NULL) + as da empresa.
    const superList = await ListUserNotificationsService({
      ctx: { userId: superUser.id, jwtCompanyId: host.id, isSuper: true },
      page: 1,
      limit: 100,
      filters: { kind: "billing" }
    });
    const superIds = (superList.notifications).map((n: any) => n.id);
    for (const n of billing) expect(superIds).toContain(n.id);

    // Tenant: nenhuma notificação de plataforma nem de outro usuário.
    const tenantList = await ListUserNotificationsService({
      ctx: { userId: tenantUser.id, jwtCompanyId: client.id, isSuper: false },
      page: 1,
      limit: 100,
      filters: {}
    });
    const tenantRows = tenantList.notifications;
    expect(tenantRows.filter((n: any) => n.companyId == null)).toEqual([]);
    expect(await UserNotification.count({ where: { userId: tenantUser.id, companyId: null } })).toBe(0);
  });

  it("notificação comum de empresa (ticket) continua exigindo e gravando companyId", async () => {
    const company = await createCompany();
    const user = await createUser({ companyId: company.id });
    const row = await CreateUserNotificationService({
      userId: user.id,
      companyId: company.id,
      type: "ticket_new",
      title: "Novo ticket",
      body: "Teste"
    });
    expect(row).not.toBeNull();
    expect(row?.companyId).toBe(company.id);

    const list = await ListUserNotificationsService({
      ctx: { userId: user.id, jwtCompanyId: company.id, isSuper: false },
      page: 1,
      limit: 100,
      filters: {}
    });
    const rows = list.notifications;
    expect(rows.map((n: any) => n.id)).toContain(row?.id);
  });

  it("preferências de âmbito plataforma (companyId NULL) do Super Admin podem ser gravadas", async () => {
    const host = await createCompany();
    const superUser = await createUser({ companyId: host.id, superUser: true });
    await UpsertMyNotificationPreferencesService(superUser.id, null, { inAppBilling: false });
    const pref = await UserNotificationPreferences.findOne({
      where: { userId: superUser.id, companyId: null }
    });
    expect(pref).not.toBeNull();
    expect((pref as any).inAppBilling).toBe(false);
  });
});
