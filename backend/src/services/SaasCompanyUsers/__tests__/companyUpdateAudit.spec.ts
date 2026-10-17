/**
 * CompanyController.update — auditoria de edição manual do vencimento e do cadastro.
 */
const mockPre: any = {};
const mockUpdated: any = {};

function inst(data: any) {
  return {
    ...data,
    get(field: string) {
      return (this as any)[field];
    },
    reload: jest.fn(async () => undefined),
    toJSON() {
      return { ...data };
    }
  };
}

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: (fn: any) => fn({}), addModels: jest.fn() }
}));
jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => mockPre.current) }
}));
jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => ({ super: true, companyId: 1 })) }
}));
jest.mock("../../../models/Plan", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(async () => null) }
}));
jest.mock("../../CompanyService/UpdateCompanyService", () => ({
  __esModule: true,
  default: jest.fn(async () => mockUpdated.current)
}));
jest.mock("../../CompanyService/CreateCompanyLogService", () => ({
  createCompanyLog: jest.fn(async () => 1)
}));
jest.mock("../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import { update } from "../../../controllers/CompanyController";
import { createCompanyLog } from "../../CompanyService/CreateCompanyLogService";

function res() {
  const r: any = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
}

const base = {
  id: 5,
  status: true,
  planId: 2,
  contractedPlanValue: null,
  timezone: "America/Sao_Paulo",
  name: "Empresa",
  phone: null,
  email: "a@b.com"
};

async function run(body: any, before: any, after: any) {
  mockPre.current = inst({ ...base, ...before });
  mockUpdated.current = inst({ ...base, ...after });
  await update({ body, params: { id: "5" }, user: { id: 1, companyId: 1 } } as any, res());
  return (createCompanyLog as jest.Mock).mock.calls.map(c => c[0]);
}

describe("CompanyController.update — auditoria", () => {
  beforeEach(() => jest.clearAllMocks());

  it("registra due_date_manual_edit normalizado quando o vencimento muda", async () => {
    const logs = await run(
      { dueDate: "2026-12-10" },
      { dueDate: "2026-11-10T03:00:00.000Z" },
      { dueDate: "2026-12-10" }
    );
    const log = logs.find(l => l.action === "due_date_manual_edit");
    expect(log).toEqual({
      companyId: 5,
      action: "due_date_manual_edit",
      userId: 1,
      metadata: { previousDueDate: "2026-11-10", newDueDate: "2026-12-10" }
    });
  });

  it("não registra quando o vencimento normalizado não muda", async () => {
    const logs = await run(
      { dueDate: "2026-11-10" },
      { dueDate: "2026-11-10T03:00:00.000Z" },
      { dueDate: "2026-11-10" }
    );
    expect(logs.find(l => l.action === "due_date_manual_edit")).toBeUndefined();
  });

  it("não registra quando dueDate não foi enviado", async () => {
    const logs = await run({ tradeName: "X" }, { dueDate: "2026-11-10" }, { dueDate: "2026-11-10", tradeName: "X" });
    expect(logs.find(l => l.action === "due_date_manual_edit")).toBeUndefined();
    const reg = logs.find(l => l.action === "registration_update");
    expect(reg.metadata).toEqual({
      fields: ["tradeName"],
      before: { tradeName: null },
      after: { tradeName: "X" }
    });
  });
});
