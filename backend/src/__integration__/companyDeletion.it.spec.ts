/* eslint-disable no-restricted-syntax, no-await-in-loop -- fixtures sequenciais em teste */
/**
 * Integração (Postgres real + arquivos descartáveis) — desativação/reativação e exclusão definitiva.
 * Integrações externas (Baileys/Evolution) são simuladas: nenhuma sessão real é tocada.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { Router } from "express";
import request from "supertest";
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import Company from "../models/Company";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import Queue from "../models/Queue";
import CompanyLog from "../models/CompanyLog";
import CompanyDeletion from "../models/CompanyDeletion";
import CreateInventoryProductService from "../services/InventoryService/CreateInventoryProductService";
import CreateInventoryStockMovementService from "../services/InventoryService/CreateInventoryStockMovementService";
import CreateInventorySaleService from "../services/InventoryService/CreateInventorySaleService";
import AddInventorySaleItemService from "../services/InventoryService/AddInventorySaleItemService";
import CompleteInventorySaleService from "../services/InventoryService/CompleteInventorySaleService";
import CreateInventoryCustomerService from "../services/InventoryService/CreateInventoryCustomerService";
import InventorySale from "../models/InventorySale";
import AuthUserService from "../services/UserServices/AuthUserService";
import isAuth from "../middleware/isAuth";
import { buildApp, tokenFor } from "./helpers/miniApp";
import { EvolutionHttpError } from "../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient";
import {
  requestCompanyDeletion,
  resumeCompanyDeletions,
  runCompanyDeletion,
  serializeCompanyDeletion
} from "../services/CompanyService/CompanyDeletionService";
import {
  applyCompanyDeactivation,
  applyCompanyReactivation
} from "../services/CompanyService/CompanyActivationService";
import {
  invalidateCompanyActivationCache,
  isCompanyDeactivated
} from "../helpers/companyActivation";
import { getBackendPublicFolder } from "../helpers/publicFolder";
import { getStickerCompanyDir } from "../helpers/stickerStorage";
import {
  assertDisposableDatabase,
  catchError,
  createCompany,
  createOpenInvoice,
  createUser
} from "./helpers/fixtures";

// sharp (via stickerStorage) não tem binário darwin-arm64 neste ambiente local; não é usado aqui.
jest.mock("sharp", () => jest.fn());
jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: () => undefined }),
    emit: () => undefined
  })
}));
const mockRemoveWbot = jest.fn();
const mockCloseWbot = jest.fn(() => true);
jest.mock("../libs/wbot", () => ({
  removeWbot: (...a: unknown[]) => mockRemoveWbot(...a),
  closeWbotWithoutLogout: (...a: unknown[]) => (mockCloseWbot as any)(...a)
}));
const mockEvolutionDelete = jest.fn(async (..._a: unknown[]) => ({}));
// Nenhuma chamada real à VPS Evolution: só o DELETE de instância é simulado.
jest.mock(
  "../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient",
  () => ({
    ...jest.requireActual(
      "../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient"
    ),
    evolutionDeleteInstance: (...a: unknown[]) => mockEvolutionDelete(...a)
  })
);
const mockStartAll = jest.fn(async () => undefined);
jest.mock("../services/WbotServices/StartAllWhatsAppsSessions", () => ({
  StartAllWhatsAppsSessions: (...a: unknown[]) => (mockStartAll as any)(...a)
}));

const tag = `itdel-${Date.now()}`;
const createdFiles: string[] = [];
let seq = 0;

function publicFile(name: string): string {
  const fileName = `${tag}-${name}`;
  const abs = path.join(getBackendPublicFolder(), fileName);
  fs.writeFileSync(abs, Buffer.alloc(1024, 1));
  createdFiles.push(abs);
  return fileName;
}
const fileExists = (f: string) =>
  fs.existsSync(path.join(getBackendPublicFolder(), f));

/** Linhas da empresa em TODAS as tabelas com "companyId" (inventário real do banco). */
async function rowsByTable(companyId: number): Promise<Record<string, number>> {
  const tables = await sequelize.query<{ table_name: string }>(
    `SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'companyId' AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT IN ('CompanyDeletions', 'CompanyDeletionArchives')`,
    { type: QueryTypes.SELECT }
  );
  const out: Record<string, number> = {};
  for (const { table_name: t } of tables) {
    // eslint-disable-next-line no-await-in-loop
    const [r] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "${t}" WHERE "companyId" = :id`,
      { replacements: { id: companyId }, type: QueryTypes.SELECT }
    );
    if (r.n > 0) out[t] = r.n;
  }
  return out;
}

async function seedFullCompany() {
  const company = await createCompany();
  const admin = await createUser({ companyId: company.id, profile: "admin" });
  await createUser({ companyId: company.id });
  const queue = await Queue.create({
    name: `Fila ${tag}-${(seq += 1)}`,
    color: "#000000",
    companyId: company.id
  } as any);
  const baileys = await Whatsapp.create({
    name: `B ${tag}-${seq}`,
    companyId: company.id,
    status: "CONNECTED",
    connectionProvider: "baileys"
  } as any);
  const evo = await Whatsapp.create({
    name: `E ${tag}-${seq}`,
    companyId: company.id,
    status: "CONNECTED",
    connectionProvider: "evolution"
  } as any);
  await sequelize.query(
    `INSERT INTO "WhatsappEvolutionCredentials" ("companyId", "whatsappId", "baseUrl", "instanceName", "apiKeyEncrypted", "apiKeyMasked", "createdAt", "updatedAt")
     VALUES (:c, :w, 'http://evo.test', :n, 'x', '***', now(), now())`,
    { replacements: { c: company.id, w: evo.id, n: `inst-${tag}-${seq}` } }
  );
  const contact = await Contact.create({
    name: "Cliente IT",
    number: `5511${Date.now() % 1e8}${seq}`,
    companyId: company.id
  } as any);
  const ticket = await Ticket.create({
    contactId: contact.id,
    companyId: company.id,
    whatsappId: baileys.id,
    queueId: queue.id,
    status: "open"
  } as any);
  const owned = publicFile(`owned-${seq}.jpg`);
  await Message.create({
    id: `${tag}-m-${seq}`,
    body: "foto",
    ticketId: ticket.id,
    contactId: contact.id,
    companyId: company.id,
    mediaUrl: owned,
    mediaType: "image/jpeg",
    fromMe: false,
    read: true,
    ack: 0
  } as any);

  const product = await CreateInventoryProductService({
    companyId: company.id,
    body: {
      name: "Produto IT",
      sku: `DEL-${tag}-${seq}`,
      salePrice: "10.00",
      trackStock: true,
      currentQuantity: 10
    }
  } as any);
  await CreateInventoryStockMovementService({
    companyId: company.id,
    createdBy: admin.id,
    body: { productId: product.id, type: "in", quantity: 3, notes: "IT" }
  } as any);
  const customer: any = await CreateInventoryCustomerService({
    companyId: company.id,
    body: { name: "Cliente Estoque" }
  } as any);
  const sale = await CreateInventorySaleService({
    companyId: company.id,
    createdBy: admin.id,
    body: { customerId: customer.id }
  });
  await AddInventorySaleItemService({
    companyId: company.id,
    saleId: sale.id,
    body: { productId: product.id, quantity: 1 }
  } as any);
  await InventorySale.update({ paymentMethod: "pix" } as any, {
    where: { id: sale.id }
  });
  await CompleteInventorySaleService({
    companyId: company.id,
    saleId: sale.id,
    completedBy: admin.id,
    sellerUserId: admin.id,
    registerAsPaid: true,
    canManagePayments: true
  });
  await createOpenInvoice(company.id);

  fs.mkdirSync(getStickerCompanyDir(company.id), { recursive: true });
  fs.writeFileSync(path.join(getStickerCompanyDir(company.id), "s.webp"), "x");
  return { company, admin, ticket, contact, owned, baileys, evo };
}

afterAll(() => {
  createdFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
});

describe("Desativação e reativação (dados preservados)", () => {
  beforeAll(assertDisposableDatabase);
  beforeEach(() => jest.clearAllMocks());

  it("desativar bloqueia login, invalida sessões e fecha Baileys sem logout; reativar libera e reinicia", async () => {
    const { company, admin, baileys } = await seedFullCompany();
    const before = await rowsByTable(company.id);
    const tokenVersion = (await User.findByPk(admin.id))!.tokenVersion || 0;

    await company.update({ status: false });
    await CompanyLog.create({
      companyId: company.id,
      action: "block",
      userId: null
    } as any);
    await applyCompanyDeactivation(company.id);

    expect(await isCompanyDeactivated(company.id)).toBe(true);
    const err = await catchError(
      AuthUserService({ email: admin.email, password: "senha-it-123456" })
    );
    expect(err?.statusCode).toBe(403);
    expect(err?.message).toBe("ERR_COMPANY_INACTIVE");
    expect((await User.findByPk(admin.id))!.tokenVersion).toBe(
      tokenVersion + 1
    );
    expect(mockCloseWbot).toHaveBeenCalledWith(baileys.id);
    expect(mockRemoveWbot).not.toHaveBeenCalled(); // sem logout
    const after = await rowsByTable(company.id);
    delete after.CompanyLogs;
    const beforeData = { ...before };
    delete beforeData.CompanyLogs;
    expect(after).toEqual(beforeData); // nada apagado (só o log de bloqueio foi acrescentado)

    await company.update({ status: true });
    await CompanyLog.create({
      companyId: company.id,
      action: "unblock",
      userId: null
    } as any);
    await applyCompanyReactivation(company.id);
    expect(await isCompanyDeactivated(company.id)).toBe(false);
    expect(mockStartAll).toHaveBeenCalledWith(company.id);
    const ok = await AuthUserService({
      email: admin.email,
      password: "senha-it-123456"
    });
    expect(ok.token).toBeTruthy();
  });

  it("bloqueio financeiro automático mantém o acesso (para regularizar)", async () => {
    const company = await createCompany({ status: false });
    const user = await createUser({ companyId: company.id, profile: "admin" });
    await CompanyLog.create({
      companyId: company.id,
      action: "auto_block",
      userId: null
    } as any);
    invalidateCompanyActivationCache(company.id);
    expect(await isCompanyDeactivated(company.id)).toBe(false);
    expect(
      (
        await AuthUserService({
          email: user.email,
          password: "senha-it-123456"
        })
      ).token
    ).toBeTruthy();
  });
});

describe("Exclusão definitiva (Postgres real)", () => {
  beforeAll(assertDisposableDatabase);
  beforeEach(() => jest.clearAllMocks());

  it("remove todos os dados e arquivos da empresa, arquiva o financeiro e preserva a outra empresa", async () => {
    const other = await seedFullCompany();
    const { company, owned, baileys, evo } = await seedFullCompany();
    // Arquivo compartilhado: referenciado também pela outra empresa.
    const shared = publicFile("shared.jpg");
    await Message.create({
      id: `${tag}-sh1`,
      body: "x",
      ticketId: (await Ticket.findOne({ where: { companyId: company.id } }))!
        .id,
      companyId: company.id,
      mediaUrl: shared,
      mediaType: "image/jpeg",
      fromMe: true,
      read: true,
      ack: 0
    } as any);
    await Message.create({
      id: `${tag}-sh2`,
      body: "x",
      ticketId: other.ticket.id,
      companyId: other.company.id,
      mediaUrl: shared,
      mediaType: "image/jpeg",
      fromMe: true,
      read: true,
      ack: 0
    } as any);
    const otherBefore = await rowsByTable(other.company.id);
    expect(Object.keys(await rowsByTable(company.id)).length).toBeGreaterThan(
      10
    );

    const job = await requestCompanyDeletion({
      companyId: company.id,
      userId: other.admin.id,
      confirmName: company.name,
      runInBackground: false
    });

    expect({ status: job.status, err: job.lastError }).toEqual({
      status: "completed",
      err: null
    });
    expect(await Company.count({ where: { id: company.id } })).toBe(0);
    expect(await rowsByTable(company.id)).toEqual({});
    expect(await rowsByTable(other.company.id)).toEqual(otherBefore);
    expect(fileExists(owned)).toBe(false);
    expect(fileExists(shared)).toBe(true);
    expect(fileExists(other.owned)).toBe(true);
    expect(fs.existsSync(getStickerCompanyDir(company.id))).toBe(false);
    expect(fs.existsSync(getStickerCompanyDir(other.company.id))).toBe(true);
    expect(mockRemoveWbot).toHaveBeenCalledWith(baileys.id, true);
    expect(mockEvolutionDelete).toHaveBeenCalledWith({ whatsappId: evo.id });

    const archives = await sequelize.query<{
      tableName: string;
      rowCount: number;
    }>(
      `SELECT "tableName", "rowCount" FROM "CompanyDeletionArchives" WHERE "deletionId" = :id`,
      { replacements: { id: job.id }, type: QueryTypes.SELECT }
    );
    expect(archives.map(a => a.tableName)).toEqual(
      expect.arrayContaining(["Companies", "Invoices"])
    );
    expect(job.requestedBy).toBe(other.admin.id);
    expect(job.finishedAt).toBeTruthy();
  });

  it("confirmação errada: 400 e nada muda", async () => {
    const { company } = await seedFullCompany();
    const before = await rowsByTable(company.id);
    const err = await catchError(
      requestCompanyDeletion({
        companyId: company.id,
        userId: null,
        confirmName: "outro nome",
        runInBackground: false
      })
    );
    expect(err?.statusCode).toBe(400);
    expect(await rowsByTable(company.id)).toEqual(before);
    expect((await Company.findByPk(company.id))?.status).toBe(true);
    expect(
      await CompanyDeletion.count({ where: { companyId: company.id } })
    ).toBe(0);
  });

  it("pedido duplicado não cria segunda operação", async () => {
    const { company } = await seedFullCompany();
    const [a, b] = await Promise.all([
      requestCompanyDeletion({
        companyId: company.id,
        userId: null,
        confirmName: company.name,
        runInBackground: false
      }),
      requestCompanyDeletion({
        companyId: company.id,
        userId: null,
        confirmName: company.name,
        runInBackground: false
      })
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await CompanyDeletion.count({ where: { companyId: company.id } })
    ).toBe(1);
    expect(await runCompanyDeletion(a.id)).toBeTruthy(); // reexecução de concluída é no-op
    expect(await Company.count({ where: { id: company.id } })).toBe(0);
  });

  it("dependência de outra empresa: falha controlada, empresa desativada, outra intacta; retomada conclui", async () => {
    const { company } = await seedFullCompany();
    const other = await seedFullCompany();
    const [qi] = await sequelize.query<{ id: number }>(
      `INSERT INTO "QueueIntegrations" ("type", "name", "projectName", "jsonContent", "language", "companyId", "createdAt", "updatedAt") VALUES ('n8n', :n, :n, '{}', 'pt', :c, now(), now()) RETURNING id`,
      {
        replacements: { n: `qi-${tag}`, c: company.id },
        type: QueryTypes.SELECT
      }
    );
    // Ticket da OUTRA empresa apontando para a integração desta (FK NO ACTION).
    await other.ticket.update({ integrationId: qi.id } as any);

    const failed = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    expect(failed.status).toBe("failed");
    expect((failed.stats as any).errorMessage).toMatch(/pode ser retomada/);
    expect((await Company.findByPk(company.id))?.status).toBe(false);
    expect((await Ticket.findByPk(other.ticket.id))?.get("integrationId")).toBe(
      qi.id
    );

    await other.ticket.update({ integrationId: null } as any);
    const retried = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    expect(retried.id).toBe(failed.id);
    expect(retried.status).toBe("completed");
    expect(retried.attempts).toBe(2);
    expect(await rowsByTable(company.id)).toEqual({});
  });

  it("empresa parcialmente apagada (mecanismo antigo) e falha ao remover arquivo: retomada conclui", async () => {
    const { company, owned } = await seedFullCompany();
    // Simula a exclusão parcial antiga: usuários, mensagens, tickets e contatos já removidos.
    for (const t of [
      "Messages",
      "Tickets",
      "Contacts",
      "Users",
      "Whatsapps",
      "Queues"
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(`DELETE FROM "${t}" WHERE "companyId" = :id`, {
        replacements: { id: company.id }
      });
    }
    const spy = jest.spyOn(fs, "rmSync").mockImplementationOnce(() => {
      throw Object.assign(new Error("EBUSY"), { code: "EBUSY" });
    });
    let job;
    try {
      job = await requestCompanyDeletion({
        companyId: company.id,
        userId: null,
        confirmName: company.name,
        runInBackground: false
      });
    } finally {
      spy.mockRestore();
    }
    expect(job.status).toBe("failed");
    expect(await Company.count({ where: { id: company.id } })).toBe(0); // banco já concluído
    expect((job.filePaths || []).length).toBeGreaterThan(0);

    job = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    expect(job.status).toBe("completed");
    expect(fileExists(owned)).toBe(true); // mensagem já tinha sido apagada pelo mecanismo antigo: arquivo fica órfão (sem referência)
  });

  it("Evolution indisponível: para ANTES do banco, mostra pendência e retoma depois", async () => {
    const { company } = await seedFullCompany();
    const before = await rowsByTable(company.id);
    mockEvolutionDelete.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "timeout")
    );
    const failed = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    const view = serializeCompanyDeletion(failed)!;
    expect(view).toMatchObject({ status: "failed", evolutionPending: 1 });
    expect(view.errorMessage).toMatch(/Evolution/);
    const after = await rowsByTable(company.id);
    delete after.CompanyLogs;
    const beforeData = { ...before };
    delete beforeData.CompanyLogs;
    expect(after).toEqual(beforeData); // nenhum dado apagado
    expect((await Company.findByPk(company.id))?.status).toBe(false);

    const done = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    expect(serializeCompanyDeletion(done)).toMatchObject({
      status: "completed",
      evolutionPending: 0
    });
  });

  it("instância já ausente (404) conclui; instância compartilhada com outra empresa nunca é removida", async () => {
    const a = await seedFullCompany();
    mockEvolutionDelete.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "Evolution HTTP 404")
    );
    const doneA = await requestCompanyDeletion({
      companyId: a.company.id,
      userId: null,
      confirmName: a.company.name,
      runInBackground: false
    });
    expect(doneA.status).toBe("completed");
    expect((doneA.stats as any).integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "already_absent" })
      ])
    );

    const b = await seedFullCompany();
    const other = await seedFullCompany();
    const [cred] = await sequelize.query<{
      baseUrl: string;
      instanceName: string;
    }>(
      `SELECT "baseUrl", "instanceName" FROM "WhatsappEvolutionCredentials" WHERE "companyId" = :c`,
      { replacements: { c: b.company.id }, type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `UPDATE "WhatsappEvolutionCredentials" SET "baseUrl" = :u, "instanceName" = :n WHERE "companyId" = :c`,
      {
        replacements: {
          u: cred.baseUrl,
          n: cred.instanceName,
          c: other.company.id
        }
      }
    );
    mockEvolutionDelete.mockClear();
    const doneB = await requestCompanyDeletion({
      companyId: b.company.id,
      userId: null,
      confirmName: b.company.name,
      runInBackground: false
    });
    expect(doneB.status).toBe("completed");
    expect(mockEvolutionDelete).not.toHaveBeenCalled();
    expect((doneB.stats as any).integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "shared_skipped" })
      ])
    );
    expect(
      await Whatsapp.count({ where: { companyId: other.company.id } })
    ).toBe(2);
  });

  it("durante a exclusão, tokens ainda válidos da empresa são recusados (nenhum registro novo)", async () => {
    const { company, admin } = await seedFullCompany();
    const router = Router();
    router.post("/probe", isAuth, (_req, res) => res.json({ ok: true }));
    const app = buildApp([router]);
    const token = tokenFor({
      id: admin.id,
      profile: "admin",
      companyId: company.id
    });
    expect(
      (
        await request(app)
          .post("/probe")
          .set("Authorization", `Bearer ${token}`)
      ).status
    ).toBe(200);

    mockEvolutionDelete.mockRejectedValueOnce(
      new EvolutionHttpError("ERR_EVOLUTION_TIMEOUT", "t")
    );
    await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    const r = await request(app)
      .post("/probe")
      .set("Authorization", `Bearer ${token}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("ERR_COMPANY_INACTIVE");
  });

  it("arquivo fora das raízes permitidas nunca é tocado; operação registra e conclui", async () => {
    const { company } = await seedFullCompany();
    const outside = path.join(os.tmpdir(), `${tag}-outside.txt`);
    fs.writeFileSync(outside, "x");
    createdFiles.push(outside);
    const job = await CompanyDeletion.create({
      companyId: company.id,
      companyName: company.name,
      requestedBy: null,
      status: "pending",
      phase: "integrations",
      attempts: 0,
      stats: {},
      filePaths: [{ kind: "file", path: outside }]
    } as any);
    const done = (await runCompanyDeletion(job.id))!;
    expect(done.status).toBe("completed");
    expect(fs.existsSync(outside)).toBe(true);
    expect((done.stats as any).filesSkippedOutsideRoots).toBe(1);
  });

  it("reinício do backend: operação 'running' abandonada é retomada e concluída", async () => {
    const { company } = await seedFullCompany();
    const job = await CompanyDeletion.create({
      companyId: company.id,
      companyName: company.name,
      requestedBy: null,
      status: "running",
      phase: "database",
      attempts: 1,
      stats: {}
    } as any);
    await resumeCompanyDeletions();
    const reloaded = await CompanyDeletion.findByPk(job.id);
    expect(reloaded?.status).toBe("completed");
    expect(reloaded?.attempts).toBe(2);
    expect(await Company.count({ where: { id: company.id } })).toBe(0);
  });

  it("dois executores simultâneos: só um processa", async () => {
    const { company } = await seedFullCompany();
    const job = await CompanyDeletion.create({
      companyId: company.id,
      companyName: company.name,
      requestedBy: null,
      status: "pending",
      phase: "integrations",
      attempts: 0,
      stats: {}
    } as any);
    await Promise.all([runCompanyDeletion(job.id), runCompanyDeletion(job.id)]);
    const reloaded = await CompanyDeletion.findByPk(job.id);
    expect(reloaded?.status).toBe("completed");
    expect(reloaded?.attempts).toBe(1);
  });

  it("falha no arquivamento financeiro: nada é apagado e a retomada conclui", async () => {
    const { company } = await seedFullCompany();
    const before = await rowsByTable(company.id);
    const original = sequelize.query.bind(sequelize);
    const spy = jest.spyOn(sequelize, "query").mockImplementation(((
      sql: any,
      opts: any
    ) => {
      if (String(sql).includes('INSERT INTO "CompanyDeletionArchives"')) {
        spy.mockRestore();
        return Promise.reject(new Error("disk full"));
      }
      return original(sql, opts);
    }) as any);
    const failed = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    spy.mockRestore();
    expect(failed.status).toBe("failed");
    const after = await rowsByTable(company.id);
    delete after.CompanyLogs;
    const beforeData = { ...before };
    delete beforeData.CompanyLogs;
    expect(after).toEqual(beforeData);

    const done = await requestCompanyDeletion({
      companyId: company.id,
      userId: null,
      confirmName: company.name,
      runInBackground: false
    });
    expect(done.status).toBe("completed");
  });

  it("arquivo financeiro sem FK: sobrevive à exclusão e guarda as faturas", async () => {
    const fks = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE contype = 'f' AND conrelid IN ('"CompanyDeletionArchives"'::regclass, '"CompanyDeletions"'::regclass)`,
      { type: QueryTypes.SELECT }
    );
    expect(fks[0].n).toBe(0);
    const [inv] = await sequelize.query<{ rows: any[] }>(
      `SELECT "rows" FROM "CompanyDeletionArchives" WHERE "tableName" = 'Invoices' ORDER BY id DESC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    expect(inv.rows[0]).toEqual(
      expect.objectContaining({
        value: expect.anything(),
        dueDate: expect.anything(),
        status: "open"
      })
    );
  });
});
