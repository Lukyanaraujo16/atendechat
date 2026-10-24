/**
 * Integração (Postgres real) — payload mínimo do evento `company-{id}-payment` (Segurança 1).
 * A sala `company-{id}-mainchannel` chega a todos os usuários da empresa: o evento não pode levar
 * campos internos (internalNotes, contractedPlanValue, documento, contato, endereço).
 */
import crypto from "crypto";
import sequelize from "../database";
import Company from "../models/Company";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";
import { assertDisposableDatabase, createCompany, createOpenInvoice, daysFromToday } from "./helpers/fixtures";

const mockEmits: Array<{ room: string; event: string; data: any }> = [];
jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: (room: string) => ({ emit: (event: string, data: any) => mockEmits.push({ room, event, data }) })
  })
}));

const txid = () => `shc${crypto.randomBytes(14).toString("hex")}`;

describe("Segurança 1 — payload do evento de pagamento (Postgres real)", () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await assertDisposableDatabase();
  });

  beforeEach(() => {
    process.env = { ...originalEnv, SAAS_BILLING_AUTO_RENEW_ON_PAYMENT: "true" };
    mockEmits.length = 0;
  });

  afterAll(async () => {
    process.env = originalEnv;
    await sequelize.close();
  });

  async function sensitiveCompany() {
    const company = await createCompany({ dueDate: daysFromToday(-3) });
    await company.update({
      internalNotes: "nota interna da plataforma",
      contractedPlanValue: 12.34,
      document: "12345678000199",
      legalName: "Razão Social IT",
      email: "financeiro@empresa-it.example",
      phone: "5511999990000",
      addressStreet: "Rua Interna"
    } as any);
    return company;
  }

  it("emite só { id, dueDate, status } para a sala da empresa, com o nome de evento e action preservados", async () => {
    const company = await sensitiveCompany();
    const other = await sensitiveCompany();
    const invoice = await createOpenInvoice(company.id, { value: 100 });

    await confirmGatewayPayment({ invoiceId: invoice.id, amount: 100, method: "pix", externalTxid: txid(), gatewayProvider: "efi" });

    const payments = mockEmits.filter(m => m.event.endsWith("-payment"));
    expect(payments).toHaveLength(1);
    const [e] = payments;
    expect(e.room).toBe(`company-${company.id}-mainchannel`);
    expect(e.event).toBe(`company-${company.id}-payment`);
    expect(Object.keys(e.data).sort()).toEqual(["action", "company"]);
    expect(e.data.action).toBe("paid");
    // Objeto simples construído no emissor, nunca a instância Sequelize.
    expect(e.data.company).not.toBeInstanceOf(Company);
    expect(Object.keys(e.data.company).sort()).toEqual(["dueDate", "id", "status"]);

    const fresh = await Company.findByPk(company.id);
    expect(e.data.company.id).toBe(company.id);
    expect(e.data.company.status).toBe(fresh!.status);
    // Mesmo valor/tipo que a instância completa serializava (o frontend já interpreta este formato).
    expect(JSON.parse(JSON.stringify(e.data.company.dueDate))).toEqual(JSON.parse(JSON.stringify(fresh!.dueDate)));
    expect(e.data.company.dueDate).not.toEqual(company.dueDate); // renovado pelo pagamento

    const wire = JSON.stringify(e.data);
    for (const leaked of ["internalNotes", "contractedPlanValue", "document", "email", "phone", "legalName", "address",
      "nota interna", "12345678000199", "financeiro@empresa-it.example", "Rua Interna"]) {
      expect(wire).not.toContain(leaked);
    }
    expect(mockEmits.some(m => m.room === `company-${other.id}-mainchannel` || m.event === `company-${other.id}-payment`)).toBe(false);
  });

  it("reentrega do mesmo txid é idempotente e não emite de novo", async () => {
    const company = await sensitiveCompany();
    const invoice = await createOpenInvoice(company.id, { value: 100 });
    const input = { invoiceId: invoice.id, amount: 100, method: "pix" as const, externalTxid: txid(), gatewayProvider: "efi" };

    await confirmGatewayPayment(input);
    const again = await confirmGatewayPayment(input);

    expect(again.alreadyApplied).toBe(true);
    expect(mockEmits.filter(m => m.event === `company-${company.id}-payment`)).toHaveLength(1);
  });
});
