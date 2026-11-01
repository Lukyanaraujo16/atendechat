/* eslint-disable no-restricted-syntax, no-await-in-loop -- fixtures sequenciais em teste */
/**
 * Integração (Postgres real + arquivos descartáveis em public/) — política definitiva de cota:
 * avisos 80/90/100 sem duplicidade e com rearme, recálculo sem teto, dry-run sem efeitos e
 * limpeza do mais antigo para o mais recente até ~90%, preservando protegidos e compartilhados.
 */
import fs from "fs";
import path from "path";
import { QueryTypes } from "sequelize";
import sequelize from "../database";
import Company from "../models/Company";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import Campaign from "../models/Campaign";
import CompanyLog from "../models/CompanyLog";
import UserNotification from "../models/UserNotification";
import CompanyStorageSnapshot from "../models/CompanyStorageSnapshot";
import CreateCompanyStorageSnapshotService from "../services/CompanyService/CreateCompanyStorageSnapshotService";
import RecalculateCompanyStorageUsageService from "../services/CompanyService/RecalculateCompanyStorageUsageService";
import CleanupCompanyStorageService from "../services/CompanyService/CleanupCompanyStorageService";
import { evaluateCompanyStorageThresholds } from "../services/CompanyService/adjustCompanyStorageUsage";
import { MESSAGE_MEDIA_AUTO_REMOVED_BODY } from "../services/CompanyMediaService/DeleteCompanyMediaItemService";
import { getBackendPublicFolder } from "../helpers/publicFolder";
import {
  assertDisposableDatabase,
  createCompany,
  createUser
} from "./helpers/fixtures";

jest.mock("../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: () => undefined }),
    emit: () => undefined
  })
}));

const MB = 1024 * 1024;
const FILE_BYTES = 2 * MB;
const LIMIT_BYTES = Math.round(0.01 * 1024 ** 3); // storageLimitGb = 0,01
const created: string[] = [];
const tag = `itstorage-${Date.now()}`;

function diskFile(name: string, bytes = FILE_BYTES): string {
  const fileName = `${tag}-${name}`;
  const abs = path.join(getBackendPublicFolder(), fileName);
  fs.writeFileSync(abs, Buffer.alloc(bytes, 1));
  created.push(abs);
  return fileName;
}
const exists = (fileName: string) =>
  fs.existsSync(path.join(getBackendPublicFolder(), fileName));

let seq = 0;
async function ticketFor(companyId: number) {
  seq += 1;
  const contact = await Contact.create({
    name: "Contato IT",
    number: `5527${Date.now() % 1e8}${seq}`,
    companyId
  } as any);
  const ticket = await Ticket.create({
    contactId: contact.id,
    companyId,
    status: "closed"
  } as any);
  return { contactId: contact.id, ticketId: ticket.id };
}
async function mediaMessage(
  companyId: number,
  t: { ticketId: number; contactId: number },
  file: string,
  mediaType: string,
  ageMinutes: number
) {
  seq += 1;
  const id = `${tag}-${seq}`;
  await Message.create({
    id,
    body: `legenda ${seq}`,
    ticketId: t.ticketId,
    contactId: t.contactId,
    companyId,
    mediaUrl: file,
    mediaType,
    fromMe: false,
    read: true,
    ack: 0
  } as any);
  await sequelize.query(
    `UPDATE "Messages" SET "createdAt" = now() - (:m || ' minutes')::interval WHERE id = :id`,
    { replacements: { m: String(ageMinutes), id }, type: QueryTypes.UPDATE }
  );
  return id;
}
const DAY = 24 * 60;
const notifications = (companyId: number, type: string) =>
  UserNotification.count({ where: { companyId, type } });

afterAll(() => {
  created.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
});

describe("Avisos de armazenamento (80/90/100)", () => {
  beforeAll(assertDisposableDatabase);

  it("um aviso por nível, sem duplicar, e rearme só após cair 5 pontos", async () => {
    const company = await createCompany();
    await company.update({ storageLimitGb: 0.01 } as any);
    await createUser({ companyId: company.id, profile: "admin" });
    const setPercent = async (p: number) => {
      await company.update({
        storageUsedBytes: Math.round((LIMIT_BYTES * p) / 100)
      } as any);
      await evaluateCompanyStorageThresholds(company.id);
    };

    await setPercent(81);
    await setPercent(82);
    await Promise.all([
      setPercent(85),
      evaluateCompanyStorageThresholds(company.id)
    ]);
    expect(await notifications(company.id, "storage_warning_80")).toBe(1);

    await setPercent(91);
    expect(await notifications(company.id, "storage_warning_90")).toBe(1);
    await setPercent(101);
    await setPercent(105);
    expect(await notifications(company.id, "storage_limit_exceeded")).toBe(1);
    const n100 = await UserNotification.findOne({
      where: { companyId: company.id, type: "storage_limit_exceeded" }
    });
    expect(n100?.body).toMatch(
      /limpeza automática removerá os arquivos mais antigos/
    );

    // 97%: ainda dentro da margem → não rearma; voltar a 100% não repete.
    await setPercent(97);
    await setPercent(100);
    expect(await notifications(company.id, "storage_limit_exceeded")).toBe(1);
    // 90% (limpeza): rearma o 100%; novo estouro avisa de novo.
    await setPercent(90);
    expect((await Company.findByPk(company.id))?.storageAlertWatermark).toBe(
      90
    );
    await setPercent(100);
    expect(await notifications(company.id, "storage_limit_exceeded")).toBe(2);
  });
});

describe("Limpeza por cota (Postgres real)", () => {
  let company: Company;
  let ids: Record<string, string>;
  let files: Record<string, string>;
  let otherOwn: string;

  beforeAll(async () => {
    await assertDisposableDatabase();
    company = await createCompany();
    await company.update({ storageLimitGb: 0.01 } as any);
    await createUser({ companyId: company.id, profile: "admin" });
    const other = await createCompany();
    const t = await ticketFor(company.id);
    const o = await ticketFor(other.id);

    files = {
      shared: diskFile("shared.jpg"),
      campaign: diskFile("campaign.png"),
      pdf: diskFile("contrato.pdf"),
      oldImage: diskFile("old.jpg"),
      audio: diskFile("old.ogg"),
      video: diskFile("recent20d.mp4"),
      docx: diskFile("recent10d.docx"),
      image2d: diskFile("recent2d.jpg"),
      uploading: diskFile("now.jpg")
    };
    ids = {
      shared: await mediaMessage(
        company.id,
        t,
        files.shared,
        "image/jpeg",
        300 * DAY
      ),
      campaign: await mediaMessage(
        company.id,
        t,
        files.campaign,
        "image/png",
        250 * DAY
      ),
      pdf: await mediaMessage(
        company.id,
        t,
        files.pdf,
        "application",
        200 * DAY
      ),
      oldImage: await mediaMessage(
        company.id,
        t,
        files.oldImage,
        "image/jpeg",
        150 * DAY
      ),
      audio: await mediaMessage(
        company.id,
        t,
        files.audio,
        "audio/ogg",
        100 * DAY
      ),
      video: await mediaMessage(
        company.id,
        t,
        files.video,
        "video/mp4",
        20 * DAY
      ),
      docx: await mediaMessage(
        company.id,
        t,
        files.docx,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        10 * DAY
      ),
      image2d: await mediaMessage(
        company.id,
        t,
        files.image2d,
        "image/jpeg",
        2 * DAY
      ),
      uploading: await mediaMessage(
        company.id,
        t,
        files.uploading,
        "image/jpeg",
        1
      )
    };
    // Referência protegida na própria empresa (campanha) e arquivo usado por outra empresa.
    await Campaign.create({
      name: "Campanha IT",
      companyId: company.id,
      mediaPath: files.campaign,
      mediaName: "c.png",
      status: "INATIVA"
    } as any);
    await mediaMessage(other.id, o, files.shared, "image/jpeg", 300 * DAY);
    // Arquivo exclusivo da outra empresa, mais antigo que todos: nunca entra na limpeza desta.
    otherOwn = diskFile("other-own.pdf");
    await mediaMessage(other.id, o, otherOwn, "application/pdf", 400 * DAY);
  });

  it("snapshot grava no schema real (sem coluna updatedAt)", async () => {
    const snap = await CreateCompanyStorageSnapshotService({
      companyId: company.id,
      reason: "manual_recalculate"
    });
    expect(snap?.id).toBeTruthy();
  });

  it("recálculo conta todos os arquivos da empresa", async () => {
    const r = await RecalculateCompanyStorageUsageService(company.id);
    expect(r.usedBytes).toBe(9 * FILE_BYTES);
  });

  it("sem STORAGE_AUTO_CLEANUP_ENABLED a rotina padrão só simula", async () => {
    delete process.env.STORAGE_AUTO_CLEANUP_ENABLED;
    const r = await CleanupCompanyStorageService(company.id);
    expect(r.dryRun).toBe(true);
    expect(r.removed).toBe(0);
    Object.values(files).forEach(f => expect(exists(f)).toBe(true));
  });

  it("dry-run: planeja do mais antigo ao mais recente até 90% e não altera nada", async () => {
    const r = await CleanupCompanyStorageService(company.id, { dryRun: true });
    // 18 MB → meta 9,66 MB: precisa liberar 9,2 MB = 5 arquivos elegíveis mais antigos.
    expect(r).toMatchObject({
      dryRun: true,
      candidates: 5,
      removed: 0,
      stop: "target_reached",
      skippedShared: 2
    });
    Object.values(files).forEach(f => expect(exists(f)).toBe(true));
    expect(
      await Message.count({
        where: { companyId: company.id, mediaUrl: null } as any
      })
    ).toBe(0);
  });

  it("limpeza real (concorrente): PDF, docx e anexos antigos saem; recentes, protegidos e compartilhados ficam", async () => {
    const [a, b] = await Promise.all([
      CleanupCompanyStorageService(company.id, { dryRun: false }),
      CleanupCompanyStorageService(company.id, { dryRun: false })
    ]);
    expect([a.stop, b.stop]).toContain("target_reached");

    for (const k of ["pdf", "oldImage", "audio", "video", "docx"])
      expect(exists(files[k])).toBe(false);
    for (const k of ["shared", "campaign", "image2d", "uploading"])
      expect(exists(files[k])).toBe(true);
    expect(exists(otherOwn)).toBe(true); // outra empresa nunca é afetada

    const pdfMsg = await Message.findByPk(ids.pdf);
    expect(pdfMsg?.getDataValue("mediaUrl")).toBeNull();
    expect(pdfMsg?.body).toContain("legenda");
    expect(pdfMsg?.body).toContain(MESSAGE_MEDIA_AUTO_REMOVED_BODY);
    expect((await Company.findByPk(company.id))?.storageUsedBytes).toBe(
      String(4 * FILE_BYTES)
    );
    expect(
      await CompanyStorageSnapshot.count({
        where: { companyId: company.id, reason: "auto_cleanup" }
      })
    ).toBeGreaterThan(0);
    expect(
      await CompanyLog.count({
        where: { companyId: company.id, action: "storage_cleanup" }
      })
    ).toBeGreaterThan(0);
  });

  it("dentro da cota não faz nada", async () => {
    const r = await CleanupCompanyStorageService(company.id, { dryRun: false });
    expect(r).toMatchObject({ stop: "within_quota", removed: 0 });
  });

  it("falha parcial ao apagar o arquivo: mensagem restaurada, nada contado como liberado", async () => {
    const c = await createCompany();
    await c.update({ storageLimitGb: 0.01 } as any);
    const t = await ticketFor(c.id);
    const pdf = diskFile("busy.pdf", 12 * MB);
    const id = await mediaMessage(c.id, t, pdf, "application/pdf", 90 * DAY);
    const before = await Message.findByPk(id);
    await RecalculateCompanyStorageUsageService(c.id);
    const spy = jest.spyOn(fs, "unlinkSync").mockImplementationOnce(() => {
      throw new Error("EBUSY");
    });
    try {
      const r = await CleanupCompanyStorageService(c.id, { dryRun: false });
      expect(r).toMatchObject({
        failed: 1,
        removed: 0,
        freedBytes: 0,
        stop: "no_more_eligible"
      });
    } finally {
      spy.mockRestore();
    }
    const after = await Message.findByPk(id);
    expect(after?.getDataValue("mediaUrl")).toBe(pdf);
    expect(after?.body).toBe(before?.body);
    expect(exists(pdf)).toBe(true);
    expect(Number((await Company.findByPk(c.id))?.storageUsedBytes)).toBe(
      12 * MB
    );
  });

  it("sem elegíveis suficientes: para, registra o que faltou e mantém o aviso de excedido", async () => {
    const c = await createCompany();
    await c.update({ storageLimitGb: 0.01 } as any);
    await createUser({ companyId: c.id, profile: "admin" });
    const t = await ticketFor(c.id);
    const big = diskFile("big-recent.mp4", 12 * MB);
    await mediaMessage(c.id, t, big, "video/mp4", 2); // na janela de upload → protegido
    await RecalculateCompanyStorageUsageService(c.id);

    const r = await CleanupCompanyStorageService(c.id, { dryRun: false });
    expect(r).toMatchObject({ stop: "no_more_eligible", removed: 0 });
    expect(r.unfreedBytes).toBeGreaterThan(0);
    expect(exists(big)).toBe(true);
    expect((await Company.findByPk(c.id))?.storageAlertWatermark).toBe(100);
    const log = await CompanyLog.findOne({
      where: { companyId: c.id, action: "storage_cleanup" }
    });
    expect((log?.metadata as any)?.unfreedBytes).toBeGreaterThan(0);
  });

  it("recálculo além do antigo teto de 800 por origem", async () => {
    const c = await createCompany();
    const t = await ticketFor(c.id);
    const values: string[] = [];
    for (let i = 0; i < 805; i += 1) {
      const f = diskFile(`many-${i}.jpg`, 10);
      values.push(
        `('${tag}-many-${i}', 'x', ${t.ticketId}, ${t.contactId}, ${c.id}, '${f}', 'image/jpeg', false, true, 0, now(), now())`
      );
    }
    await sequelize.query(
      `INSERT INTO "Messages" (id, body, "ticketId", "contactId", "companyId", "mediaUrl", "mediaType", "fromMe", read, ack, "createdAt", "updatedAt") VALUES ${values.join(
        ","
      )}`
    );
    const r = await RecalculateCompanyStorageUsageService(c.id);
    expect(r.usedBytes).toBe(805 * 10);
  });
});
