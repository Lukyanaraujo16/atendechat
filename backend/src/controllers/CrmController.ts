import { Request, Response } from "express";
import { Op, Transaction, Sequelize } from "sequelize";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import sequelize from "../database";
import CrmPipeline from "../models/CrmPipeline";
import CrmStage from "../models/CrmStage";
import CrmDeal, { CrmDealSource, CrmDealStatus } from "../models/CrmDeal";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import User from "../models/User";
import { normalizeBusinessSegment } from "../config/businessSegment";
import { crmPipelineTemplates } from "../config/crmPipelineTemplates";
import { stageWinLostFromName } from "../services/CrmService/crmStageWinLost";
import BootstrapCrmForCompanyService from "../services/CrmService/BootstrapCrmForCompanyService";
import {
  normalizeDealPriority,
  sanitizeDealTags
} from "../services/CrmService/crmDealTags";
import {
  dealStatusFromStage,
  assertStageBelongsToPipeline,
  mergeDealWhereWithSearch
} from "../services/CrmService/crmDealUtils";
import RunCrmAutomationRulesForDealService from "../services/CrmAutomationRule/RunCrmAutomationRulesForDealService";
import CreateCrmDealActivityService from "../services/CrmService/CreateCrmDealActivityService";
import {
  closeOpenCrmDealStageHistory,
  openCrmDealStageHistoryRecord
} from "../services/CrmService/crmDealStageHistoryService";
import GetCrmDealTimelineService from "../services/CrmService/GetCrmDealTimelineService";
import GetCrmReportsService from "../services/CrmService/GetCrmReportsService";
import ListCrmStagesService from "../services/CrmService/ListCrmStagesService";
import CreateCrmStageService, {
  StageKindInput
} from "../services/CrmService/CreateCrmStageService";
import UpdateCrmStageService from "../services/CrmService/UpdateCrmStageService";
import DeleteCrmStageService from "../services/CrmService/DeleteCrmStageService";
import ReorderCrmStagesService from "../services/CrmService/ReorderCrmStagesService";
import CrmCustomField, { CrmCustomFieldType } from "../models/CrmCustomField";
import ListCrmCustomFieldsService from "../services/CrmService/ListCrmCustomFieldsService";
import CreateCrmCustomFieldService from "../services/CrmService/CreateCrmCustomFieldService";
import UpdateCrmCustomFieldService from "../services/CrmService/UpdateCrmCustomFieldService";
import DeleteOrDeactivateCrmCustomFieldService from "../services/CrmService/DeleteOrDeactivateCrmCustomFieldService";
import ValidateCrmDealCustomFieldsService from "../services/CrmService/ValidateCrmDealCustomFieldsService";
import CrmDealStageHistory from "../models/CrmDealStageHistory";
import ListCrmSavedViewsService from "../services/CrmService/ListCrmSavedViewsService";
import CreateCrmSavedViewService from "../services/CrmService/CreateCrmSavedViewService";
import UpdateCrmSavedViewService from "../services/CrmService/UpdateCrmSavedViewService";
import DeleteCrmSavedViewService from "../services/CrmService/DeleteCrmSavedViewService";
import {
  getCrmVisibilityModeForCompany,
  getForcedAssignedUserIdForRequest
} from "../services/CrmService/crmDealVisibility";

const crmStageKindSchema = Yup.string()
  .oneOf(["normal", "won", "lost"])
  .optional();

const crmCustomFieldTypeSchema = Yup.string().oneOf([
  "text",
  "number",
  "currency",
  "date",
  "select",
  "boolean"
]);

function normalizeDealFollowUpNote(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, 65535);
}

function blankToNullFollowUpAt(body: Record<string, unknown>): void {
  if (body.nextFollowUpAt === "") body.nextFollowUpAt = null;
}

const STAGE_COLORS = [
  "#5c6bc0",
  "#7e57c2",
  "#26a69a",
  "#42a5f5",
  "#66bb6a",
  "#ef5350"
];

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function reqUserId(req: Request): number | null {
  return req.user?.id != null ? Number(req.user.id) : null;
}

function parseReportDateStart(s: string): Date {
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}

function parseReportDateEnd(s: string): Date {
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return new Date(`${s.slice(0, 10)}T23:59:59.999Z`);
}

export const getCrmReports = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const q = req.query as Record<string, string | undefined>;

  const schema = Yup.object({
    startDate: Yup.string().required(),
    endDate: Yup.string().required(),
    pipelineId: Yup.string().nullable(),
    assignedUserId: Yup.string().nullable(),
    source: Yup.string().nullable(),
    status: Yup.string().oneOf(["open", "won", "lost"]).nullable()
  });

  try {
    await schema.validate(
      {
        startDate: q.startDate ?? "",
        endDate: q.endDate ?? "",
        pipelineId: q.pipelineId,
        assignedUserId: q.assignedUserId,
        source: q.source,
        status: q.status
      },
      { abortEarly: false }
    );
  } catch {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const start = parseReportDateStart(String(q.startDate));
  const end = parseReportDateEnd(String(q.endDate));
  if (end.getTime() < start.getTime()) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const visMode = await getCrmVisibilityModeForCompany(companyId);
  const visibilityAssignedUserId = getForcedAssignedUserIdForRequest(req, visMode);

  const data = await GetCrmReportsService({
    companyId,
    start,
    end,
    pipelineIdQ: q.pipelineId,
    assignedUserIdQ: q.assignedUserId,
    sourceQ: q.source,
    statusQ: q.status,
    visibilityAssignedUserId: visibilityAssignedUserId ?? undefined
  });

  return res.json(data);
};

async function crmStageNameMap(
  companyId: number,
  ids: Array<number | null | undefined>
): Promise<Map<number, string>> {
  const uniq = [
    ...new Set(
      ids.filter((x) => x != null && Number.isFinite(Number(x))) as number[]
    )
  ];
  if (!uniq.length) return new Map();
  const rows = await CrmStage.findAll({
    where: { companyId, id: uniq },
    attributes: ["id", "name"]
  });
  return new Map(rows.map((r) => [r.id, String(r.name || "")]));
}

type DealSnapshot = {
  title: string;
  value: string | number | null;
  contactId: number | null;
  ticketId: number | null;
  expectedCloseAt: Date | null;
  notes: string | null;
  source: string;
  assignedUserId: number | null;
  tags: string | null;
  status: string;
  pipelineId: number;
  followUpNote: string | null;
};

function snapshotDeal(deal: CrmDeal): DealSnapshot {
  return {
    title: deal.title,
    value: deal.value,
    contactId: deal.contactId,
    ticketId: deal.ticketId,
    expectedCloseAt: deal.expectedCloseAt,
    notes: deal.notes,
    source: deal.source,
    assignedUserId: deal.assignedUserId,
    tags: JSON.stringify(deal.tags || []),
    status: deal.status,
    pipelineId: deal.pipelineId,
    followUpNote: deal.followUpNote
  };
}

function shouldLogDealUpdated(body: Record<string, unknown>, before: DealSnapshot): boolean {
  if (body.title != null && String(body.title).trim() !== String(before.title)) {
    return true;
  }
  if (body.value !== undefined) {
    const bv = body.value == null || body.value === "" ? null : Number(body.value);
    const cv =
      before.value == null || before.value === "" ? null : Number(before.value);
    if (bv !== cv) return true;
  }
  if (body.contactId !== undefined) {
    const bc =
      body.contactId === null || body.contactId === ""
        ? null
        : Number(body.contactId);
    if (bc !== (before.contactId ?? null)) return true;
  }
  if (body.ticketId !== undefined) {
    const bt =
      body.ticketId === null || body.ticketId === ""
        ? null
        : Number(body.ticketId);
    if (bt !== (before.ticketId ?? null)) return true;
  }
  if (body.expectedCloseAt !== undefined) {
    const b = body.expectedCloseAt
      ? new Date(String(body.expectedCloseAt)).getTime()
      : null;
    const c = before.expectedCloseAt
      ? new Date(before.expectedCloseAt).getTime()
      : null;
    if (b !== c) return true;
  }
  if (body.notes !== undefined) {
    if (String(body.notes ?? "") !== String(before.notes ?? "")) return true;
  }
  if (body.source != null && String(body.source) !== String(before.source)) {
    return true;
  }
  if (body.assignedUserId !== undefined) {
    const ba =
      body.assignedUserId === null || body.assignedUserId === ""
        ? null
        : Number(body.assignedUserId);
    if (ba !== (before.assignedUserId ?? null)) return true;
  }
  if (body.tags !== undefined) {
    const next = JSON.stringify(sanitizeDealTags(body.tags as unknown[]) ?? []);
    if (next !== before.tags) return true;
  }
  if (body.status != null && String(body.status) !== String(before.status)) {
    return true;
  }
  if (body.pipelineId != null && Number(body.pipelineId) !== before.pipelineId) {
    return true;
  }
  return false;
}

function customFieldsActivityMetadata(
  before: unknown,
  after: unknown,
  defs: CrmCustomField[]
): Record<string, unknown> {
  const b =
    before && typeof before === "object" && !Array.isArray(before)
      ? (before as Record<string, unknown>)
      : {};
  const a =
    after && typeof after === "object" && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : {};
  const labelByKey = new Map(defs.map((d) => [d.key, d.label]));
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changes: { key: string; label: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    const jsB = JSON.stringify(b[k]);
    const jsA = JSON.stringify(a[k]);
    if (jsB !== jsA) {
      changes.push({
        key: k,
        label: labelByKey.get(k) || k,
        from: b[k],
        to: a[k]
      });
    }
  }
  if (changes.length > 12) {
    return { summary: true };
  }
  return { changes };
}

const dealInclude = [
  {
    model: Contact,
    as: "contact",
    attributes: ["id", "name", "number"],
    required: false
  },
  {
    model: User,
    as: "assignedUser",
    attributes: ["id", "name"],
    required: false
  },
  {
    model: Ticket,
    as: "ticket",
    attributes: ["id", "status", "lastMessage", "updatedAt"],
    required: false
  }
];

async function findDealRowForRequest(
  req: Request,
  companyId: number,
  dealId: number
): Promise<CrmDeal | null> {
  const mode = await getCrmVisibilityModeForCompany(companyId);
  const vis = getForcedAssignedUserIdForRequest(req, mode);
  const where: Record<string, unknown> = { id: dealId, companyId };
  if (vis != null) where.assignedUserId = vis;
  return CrmDeal.findOne({ where });
}

async function findDealForRequest(
  req: Request,
  companyId: number,
  dealId: number
): Promise<CrmDeal | null> {
  const mode = await getCrmVisibilityModeForCompany(companyId);
  const vis = getForcedAssignedUserIdForRequest(req, mode);
  const where: Record<string, unknown> = { id: dealId, companyId };
  if (vis != null) where.assignedUserId = vis;
  return CrmDeal.findOne({ where, include: dealInclude });
}

export const bootstrapTenantCrm = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin" && !req.user.supportMode) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const companyId = companyIdOrThrow(req);
  const result = await BootstrapCrmForCompanyService(companyId);
  const pipeline = await CrmPipeline.findByPk(result.pipeline.id, {
    include: [
      {
        model: CrmStage,
        required: false,
        separate: true,
        order: [["position", "ASC"]]
      }
    ]
  });
  return res.status(200).json({
    bootstrapped: result.bootstrapped,
    reason: result.reason,
    pipeline
  });
};

export const listPipelines = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await CrmPipeline.findAll({
    where: { companyId },
    include: [
      {
        model: CrmStage,
        required: false,
        separate: true,
        order: [["position", "ASC"]]
      }
    ],
    order: [["id", "ASC"]]
  });
  return res.json(rows);
};

export const createPipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const schema = Yup.object({
    name: Yup.string().min(1).max(255).required(),
    segment: Yup.string().nullable()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const segment = normalizeBusinessSegment(body.segment || undefined);
  const stageNames = crmPipelineTemplates[segment] ?? crmPipelineTemplates.general;

  const result = await sequelize.transaction(async (t: Transaction) => {
    const pipeline = await CrmPipeline.create(
      {
        companyId,
        name: body.name.trim(),
        segment,
        isDefault: false
      },
      { transaction: t }
    );
    await Promise.all(
      stageNames.map((stageName, index) => {
        const { isWon, isLost } = stageWinLostFromName(stageName);
        return CrmStage.create(
          {
            pipelineId: pipeline.id,
            companyId,
            name: stageName,
            position: index,
            color: STAGE_COLORS[index % STAGE_COLORS.length],
            isWon,
            isLost
          },
          { transaction: t }
        );
      })
    );
    return CrmPipeline.findByPk(pipeline.id, {
      transaction: t,
      include: [
        {
          model: CrmStage,
          separate: true,
          order: [["position", "ASC"]]
        }
      ]
    });
  });

  return res.status(201).json(result);
};

export const updatePipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const schema = Yup.object({ name: Yup.string().min(1).max(255).required() });
  const { name } = await schema.validate(req.body);
  const pipeline = await CrmPipeline.findOne({ where: { id, companyId } });
  if (!pipeline) throw new AppError("ERR_NO_CRM_PIPELINE", 404);
  await pipeline.update({ name: String(name).trim() });
  return res.json(pipeline);
};

async function resolvePipelineIdForCompany(
  companyId: number,
  pipelineIdParam: string | undefined
): Promise<number> {
  if (pipelineIdParam && Number.isFinite(Number(pipelineIdParam))) {
    const pid = Number(pipelineIdParam);
    const exists = await CrmPipeline.findOne({ where: { id: pid, companyId } });
    if (!exists) throw new AppError("ERR_NO_CRM_PIPELINE", 404);
    return pid;
  }
  const def = await CrmPipeline.findOne({
    where: { companyId, isDefault: true }
  });
  if (!def) return -1;
  return def.id;
}

export const listDeals = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const {
    pipelineId: pipelineIdQ,
    search,
    assignedUserId: assignedQ,
    status,
    source: sourceQ,
    priority: priorityQ,
    tag: tagQ
  } = req.query as Record<string, string | undefined>;

  const pipelineId = await resolvePipelineIdForCompany(companyId, pipelineIdQ);
  if (pipelineId < 0) return res.json([]);

  const visMode = await getCrmVisibilityModeForCompany(companyId);
  const forcedAssignee = getForcedAssignedUserIdForRequest(req, visMode);

  const where: Record<string, unknown> = { companyId, pipelineId };

  if (forcedAssignee != null) {
    where.assignedUserId = forcedAssignee;
  } else if (assignedQ !== undefined && assignedQ !== "") {
    if (assignedQ === "unassigned") {
      where.assignedUserId = { [Op.is]: null };
    } else {
      const n = Number(assignedQ);
      if (Number.isFinite(n)) where.assignedUserId = n;
    }
  }

  if (status === "open" || status === "won" || status === "lost") {
    where.status = status as CrmDealStatus;
  }

  if (
    sourceQ != null &&
    sourceQ !== "" &&
    ["whatsapp", "manual", "instagram", "other"].includes(sourceQ)
  ) {
    where.source = sourceQ;
  }

  if (priorityQ != null && priorityQ !== "") {
    where.priority = normalizeDealPriority(priorityQ);
  }

  let finalWhere: Record<string, unknown> =
    search && String(search).trim()
      ? mergeDealWhereWithSearch(where, String(search))
      : where;

  const tagTrim = tagQ != null ? String(tagQ).trim().slice(0, 30) : "";
  if (tagTrim) {
    const dialect = sequelize.getDialect();
    if (dialect === "postgres" || dialect === "cockroachdb") {
      const safeJson = JSON.stringify([tagTrim]).replace(/'/g, "''");
      finalWhere = {
        [Op.and]: [
          finalWhere,
          Sequelize.literal(
            `"CrmDeals"."tags"::jsonb @> '${safeJson}'::jsonb`
          )
        ]
      };
    } else {
      finalWhere = {
        [Op.and]: [
          finalWhere,
          Sequelize.literal(
            `JSON_CONTAINS(CrmDeals.tags, JSON_QUOTE(${sequelize.escape(
              tagTrim
            )}), '$')`
          )
        ]
      };
    }
  }

  const deals = await CrmDeal.findAll({
    where: finalWhere,
    include: dealInclude,
    order: [["updatedAt", "DESC"]]
  });
  const ids = deals.map((d) => d.id);
  if (!ids.length) {
    return res.json([]);
  }
  const openRows = await CrmDealStageHistory.findAll({
    where: {
      companyId,
      dealId: { [Op.in]: ids },
      leftAt: { [Op.is]: null }
    },
    attributes: ["dealId", "enteredAt"]
  });
  const enteredMap = new Map<number, Date>(
    openRows.map((r) => [r.dealId, r.enteredAt])
  );
  const payload = deals.map((d) => ({
    ...d.toJSON(),
    currentStageEnteredAt: enteredMap.get(d.id) ?? null
  }));
  return res.json(payload);
};

export const listDealsByContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const contactId = Number(req.params.contactId);
  if (!Number.isFinite(contactId)) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const contact = await Contact.findOne({
    where: { id: contactId, companyId }
  });
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const visMode = await getCrmVisibilityModeForCompany(companyId);
  const forcedAssignee = getForcedAssignedUserIdForRequest(req, visMode);

  const where: Record<string, unknown> = { companyId, contactId };
  if (forcedAssignee != null) {
    where.assignedUserId = forcedAssignee;
  }

  const deals = await CrmDeal.findAll({
    where,
    include: [
      ...dealInclude,
      {
        model: CrmStage,
        attributes: ["id", "name", "position"],
        required: false
      },
      {
        model: CrmPipeline,
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["updatedAt", "DESC"]]
  });

  const ids = deals.map((d) => d.id);
  if (!ids.length) {
    return res.json([]);
  }

  const openRows = await CrmDealStageHistory.findAll({
    where: {
      companyId,
      dealId: { [Op.in]: ids },
      leftAt: { [Op.is]: null }
    },
    attributes: ["dealId", "enteredAt"]
  });
  const enteredMap = new Map<number, Date>(
    openRows.map((r) => [r.dealId, r.enteredAt])
  );

  const payload = deals.map((d) => ({
    ...d.toJSON(),
    currentStageEnteredAt: enteredMap.get(d.id) ?? null
  }));
  return res.json(payload);
};

export const showDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await findDealForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  return res.json(deal);
};

export const showDealTimeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const visMode = await getCrmVisibilityModeForCompany(companyId);
  const visUser = getForcedAssignedUserIdForRequest(req, visMode);
  const { deal, activities, stageHistory } = await GetCrmDealTimelineService({
    companyId,
    dealId: id,
    visibilityAssignedUserId: visUser ?? undefined
  });
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  return res.json({ deal, activities, stageHistory });
};

export const commentDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await findDealRowForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  const schema = Yup.object({
    comment: Yup.string().min(1).max(20000).required()
  });
  const { comment } = await schema.validate(req.body);
  const text = String(comment).trim();
  const userId = reqUserId(req);
  await CreateCrmDealActivityService({
    companyId,
    dealId: deal.id,
    userId,
    type: "comment",
    title: "comment",
    description: text,
    metadata: null
  });
  await deal.update({ lastActivityAt: new Date() });
  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.status(201).json({ activity: true, deal: full });
};

const sourceSchema = Yup.string()
  .oneOf(["whatsapp", "manual", "instagram", "other"])
  .nullable();

async function assertRelationsForDeal(
  companyId: number,
  pipelineId: number,
  stageId: number,
  contactId: number | null | undefined,
  ticketId: number | null | undefined
): Promise<CrmStage> {
  const pipeline = await CrmPipeline.findOne({ where: { id: pipelineId, companyId } });
  if (!pipeline) throw new AppError("ERR_NO_CRM_PIPELINE", 404);

  const stage = await CrmStage.findOne({ where: { id: stageId, companyId } });
  assertStageBelongsToPipeline(stage, pipelineId, companyId);

  if (contactId != null) {
    const c = await Contact.findOne({ where: { id: contactId, companyId } });
    if (!c) throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (ticketId != null) {
    const tk = await Ticket.findOne({ where: { id: ticketId, companyId } });
    if (!tk) throw new AppError("ERR_NO_TICKET_FOUND", 404);
    if (contactId != null && tk.contactId !== contactId) {
      throw new AppError("ERR_TICKET_CONTACT_MISMATCH", 400);
    }
  }

  return stage as CrmStage;
}

export const storeDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const userId = req.user?.id != null ? Number(req.user.id) : null;

  const schema = Yup.object({
    title: Yup.string().min(1).max(500).required(),
    pipelineId: Yup.number().integer().required(),
    stageId: Yup.number().integer().required(),
    contactId: Yup.number().integer().nullable(),
    ticketId: Yup.number().integer().nullable(),
    value: Yup.number().nullable(),
    assignedUserId: Yup.number().integer().nullable(),
    expectedCloseAt: Yup.date().nullable(),
    nextFollowUpAt: Yup.date().nullable(),
    followUpNote: Yup.string().nullable().max(65535),
    notes: Yup.string().nullable().max(65535),
    source: sourceSchema,
    priority: Yup.string().max(16).nullable(),
    tags: Yup.array().of(Yup.string().max(60)).nullable(),
    customFields: Yup.mixed().nullable().optional()
  });

  const rawBody = { ...(req.body as Record<string, unknown>) };
  blankToNullFollowUpAt(rawBody);
  const body = await schema.validate(rawBody, { abortEarly: false });

  const visModeCreate = await getCrmVisibilityModeForCompany(companyId);
  const forcedCreate = getForcedAssignedUserIdForRequest(req, visModeCreate);
  let effectiveAssignedUserId = body.assignedUserId ?? null;
  if (forcedCreate != null) {
    if (effectiveAssignedUserId != null && effectiveAssignedUserId !== forcedCreate) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
    effectiveAssignedUserId = forcedCreate;
  }

  const stage = await assertRelationsForDeal(
    companyId,
    body.pipelineId,
    body.stageId,
    body.contactId ?? null,
    body.ticketId ?? null
  );

  if (effectiveAssignedUserId != null) {
    const u = await User.findOne({
      where: { id: effectiveAssignedUserId, companyId }
    });
    if (!u) throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const source = (body.source || "manual") as CrmDealSource;
  const status = dealStatusFromStage(stage);
  const priority = normalizeDealPriority(body.priority ?? "medium");
  const tags =
    body.tags !== undefined && body.tags !== null
      ? sanitizeDealTags(body.tags) ?? []
      : [];
  const mergedCustom = await ValidateCrmDealCustomFieldsService({
    companyId,
    pipelineId: body.pipelineId,
    raw: body.customFields ?? {},
    existing: null,
    mode: "create"
  });

  const now = new Date();

  const deal = await CrmDeal.create({
    companyId,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
    contactId: body.contactId ?? null,
    ticketId: body.ticketId ?? null,
    title: body.title.trim(),
    value: body.value == null ? null : body.value,
    status,
    source,
    priority,
    tags,
    lastActivityAt: now,
    expectedCloseAt: body.expectedCloseAt ?? null,
    nextFollowUpAt: body.nextFollowUpAt ?? null,
    followUpNote: normalizeDealFollowUpNote(
      body.followUpNote !== undefined ? body.followUpNote : null
    ),
    followUpNotifiedAt: null,
    attentionAt: null,
    attentionReason: null,
    attentionNotifiedAt: null,
    automationLastStaleNotifyAt: null,
    notes: body.notes ?? null,
    createdBy: userId,
    assignedUserId: effectiveAssignedUserId,
    customFields: mergedCustom
  });

  await openCrmDealStageHistoryRecord({
    companyId,
    dealId: deal.id,
    fromStageId: null,
    toStageId: body.stageId,
    enteredAt: deal.createdAt,
    changedBy: userId
  });

  await CreateCrmDealActivityService({
    companyId,
    dealId: deal.id,
    userId,
    type: "created",
    title: "created",
    metadata: { title: deal.title }
  });

  if (body.nextFollowUpAt) {
    await CreateCrmDealActivityService({
      companyId,
      dealId: deal.id,
      userId,
      type: "follow_up_set",
      title: "follow_up_set",
      metadata: { at: body.nextFollowUpAt }
    });
  }

  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.status(201).json(full);
};

export const updateDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await findDealRowForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);

  const schema = Yup.object({
    title: Yup.string().min(1).max(500).nullable(),
    pipelineId: Yup.number().integer().nullable(),
    stageId: Yup.number().integer().nullable(),
    contactId: Yup.number().integer().nullable(),
    ticketId: Yup.number().integer().nullable(),
    value: Yup.number().nullable(),
    assignedUserId: Yup.number().integer().nullable(),
    expectedCloseAt: Yup.date().nullable(),
    nextFollowUpAt: Yup.date().nullable(),
    followUpNote: Yup.string().nullable().max(65535),
    notes: Yup.string().nullable().max(65535),
    source: sourceSchema,
    status: Yup.string().oneOf(["open", "won", "lost"]).nullable(),
    priority: Yup.string().max(16).nullable(),
    tags: Yup.array().of(Yup.string().max(60)).nullable(),
    customFields: Yup.mixed().nullable().optional()
  });

  const rawBody = { ...(req.body as Record<string, unknown>) };
  blankToNullFollowUpAt(rawBody);
  const body = await schema.validate(rawBody, { abortEarly: false });

  const visModeUpd = await getCrmVisibilityModeForCompany(companyId);
  const forcedAssignUpd = getForcedAssignedUserIdForRequest(req, visModeUpd);
  if (forcedAssignUpd != null && body.assignedUserId !== undefined) {
    if (body.assignedUserId === null || Number(body.assignedUserId) !== forcedAssignUpd) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const nextPipelineId = body.pipelineId ?? deal.pipelineId;
  const nextStageId = body.stageId ?? deal.stageId;

  if (
    body.pipelineId != null &&
    body.pipelineId !== deal.pipelineId &&
    body.stageId == null
  ) {
    throw new AppError("ERR_CRM_STAGE_REQUIRED_ON_PIPELINE_CHANGE", 400);
  }

  const stage = await assertRelationsForDeal(
    companyId,
    nextPipelineId,
    nextStageId,
    body.contactId !== undefined ? body.contactId : deal.contactId,
    body.ticketId !== undefined ? body.ticketId : deal.ticketId
  );

  if (body.assignedUserId !== undefined && body.assignedUserId != null) {
    const u = await User.findOne({
      where: { id: body.assignedUserId, companyId }
    });
    if (!u) throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const prevStageId = deal.stageId;
  const prevPriority = deal.priority;
  const beforeSnap = snapshotDeal(deal);
  const prevCustomFields = deal.customFields;
  const prevFollowUp = deal.nextFollowUpAt;
  const hadAttention = deal.attentionAt != null;
  const userIdAct = reqUserId(req);
  const stageWillChange = body.stageId != null && body.stageId !== prevStageId;
  const tHist = new Date();

  const patch: Record<string, unknown> = {};
  if (body.title != null) patch.title = body.title.trim();
  if (body.pipelineId != null) patch.pipelineId = body.pipelineId;
  if (body.stageId != null) patch.stageId = body.stageId;
  if (body.contactId !== undefined) patch.contactId = body.contactId;
  if (body.ticketId !== undefined) patch.ticketId = body.ticketId;
  if (body.value !== undefined) patch.value = body.value;
  if (body.expectedCloseAt !== undefined) patch.expectedCloseAt = body.expectedCloseAt;
  if (body.nextFollowUpAt !== undefined) {
    patch.nextFollowUpAt = body.nextFollowUpAt;
    patch.followUpNotifiedAt = null;
  }
  if (body.followUpNote !== undefined) {
    patch.followUpNote = normalizeDealFollowUpNote(body.followUpNote);
  }
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.source != null) patch.source = body.source;
  if (body.assignedUserId !== undefined) patch.assignedUserId = body.assignedUserId;
  if (body.priority !== undefined) {
    patch.priority = normalizeDealPriority(body.priority);
  }
  if (body.tags !== undefined) {
    patch.tags = sanitizeDealTags(body.tags) ?? [];
  }

  if (body.customFields !== undefined) {
    const mergedCustom = await ValidateCrmDealCustomFieldsService({
      companyId,
      pipelineId: nextPipelineId,
      raw: body.customFields,
      existing: (deal.customFields as Record<string, unknown>) || null,
      mode: "update"
    });
    patch.customFields = mergedCustom;
  }

  patch.attentionAt = null;
  patch.attentionReason = null;
  patch.attentionNotifiedAt = null;
  patch.automationLastStaleNotifyAt = null;

  if (body.stageId != null || body.pipelineId != null) {
    patch.status = dealStatusFromStage(stage);
  } else if (body.status != null) {
    patch.status = body.status;
  }

  patch.lastActivityAt = new Date();

  if (stageWillChange) {
    await closeOpenCrmDealStageHistory({
      companyId,
      dealId: deal.id,
      leftAt: tHist
    });
  }

  await deal.update(patch);

  if (stageWillChange && body.stageId != null) {
    await openCrmDealStageHistoryRecord({
      companyId,
      dealId: deal.id,
      fromStageId: prevStageId,
      toStageId: body.stageId,
      enteredAt: tHist,
      changedBy: userIdAct
    });
    const sm = await crmStageNameMap(companyId, [prevStageId, body.stageId]);
    await CreateCrmDealActivityService({
      companyId,
      dealId: deal.id,
      userId: userIdAct,
      type: "stage_changed",
      title: "stage_changed",
      metadata: {
        fromStageId: prevStageId,
        toStageId: body.stageId,
        fromStageName: sm.get(prevStageId) ?? "",
        toStageName: sm.get(body.stageId) ?? ""
      }
    });
    await RunCrmAutomationRulesForDealService({
      companyId,
      dealId: deal.id,
      triggerType: "stage_changed",
      context: { toStageId: body.stageId }
    });
  }

  if (body.priority !== undefined) {
    const newP = normalizeDealPriority(body.priority);
    if (newP !== prevPriority) {
      await CreateCrmDealActivityService({
        companyId,
        dealId: deal.id,
        userId: userIdAct,
        type: "priority_changed",
        title: "priority_changed",
        metadata: { from: prevPriority, to: newP }
      });
      await RunCrmAutomationRulesForDealService({
        companyId,
        dealId: deal.id,
        triggerType: "priority_changed",
        context: { fromPriority: prevPriority, toPriority: newP }
      });
    }
  }

  await deal.reload();

  if (body.customFields !== undefined) {
    const prevStr = JSON.stringify(prevCustomFields ?? null);
    const nextStr = JSON.stringify(patch.customFields ?? null);
    if (prevStr !== nextStr) {
      const defs = await ListCrmCustomFieldsService({ companyId });
      await CreateCrmDealActivityService({
        companyId,
        dealId: deal.id,
        userId: userIdAct,
        type: "custom_fields_updated",
        title: "custom_fields_updated",
        metadata: customFieldsActivityMetadata(
          prevCustomFields,
          patch.customFields,
          defs
        )
      });
    }
  }

  if (body.nextFollowUpAt !== undefined) {
    const prevMs = prevFollowUp ? new Date(prevFollowUp).getTime() : null;
    const newMs = deal.nextFollowUpAt ? new Date(deal.nextFollowUpAt).getTime() : null;
    if (prevMs !== newMs) {
      if (newMs == null) {
        await CreateCrmDealActivityService({
          companyId,
          dealId: deal.id,
          userId: userIdAct,
          type: "follow_up_cleared",
          title: "follow_up_cleared",
          metadata: {}
        });
      } else {
        await CreateCrmDealActivityService({
          companyId,
          dealId: deal.id,
          userId: userIdAct,
          type: "follow_up_set",
          title: "follow_up_set",
          metadata: { at: deal.nextFollowUpAt }
        });
      }
    }
  }

  if (body.followUpNote !== undefined && body.nextFollowUpAt === undefined) {
    const oldN = normalizeDealFollowUpNote(beforeSnap.followUpNote);
    const newN = normalizeDealFollowUpNote(deal.followUpNote);
    if (String(oldN || "") !== String(newN || "") && deal.nextFollowUpAt) {
      await CreateCrmDealActivityService({
        companyId,
        dealId: deal.id,
        userId: userIdAct,
        type: "follow_up_set",
        title: "follow_up_set",
        metadata: { noteOnly: true }
      });
    }
  }

  if (hadAttention) {
    await CreateCrmDealActivityService({
      companyId,
      dealId: deal.id,
      userId: userIdAct,
      type: "attention_resolved",
      title: "attention_resolved",
      metadata: {}
    });
  }

  if (shouldLogDealUpdated(body as Record<string, unknown>, beforeSnap)) {
    await CreateCrmDealActivityService({
      companyId,
      dealId: deal.id,
      userId: userIdAct,
      type: "updated",
      title: "updated",
      metadata: {}
    });
  }

  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.json(full);
};

export const moveDealStage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const schema = Yup.object({ stageId: Yup.number().integer().required() });
  const { stageId } = await schema.validate(req.body);

  const deal = await findDealRowForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);

  const stage = await CrmStage.findOne({ where: { id: stageId, companyId } });
  assertStageBelongsToPipeline(stage, deal.pipelineId, companyId);

  if (deal.stageId === stageId) {
    const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
    return res.json(full);
  }

  const prev = deal.stageId;
  const uid = reqUserId(req);
  const t = new Date();
  await closeOpenCrmDealStageHistory({ companyId, dealId: deal.id, leftAt: t });

  const status = dealStatusFromStage(stage as CrmStage);
  await deal.update({
    stageId,
    status,
    lastActivityAt: new Date(),
    attentionAt: null,
    attentionReason: null,
    attentionNotifiedAt: null,
    automationLastStaleNotifyAt: null
  });

  await openCrmDealStageHistoryRecord({
    companyId,
    dealId: deal.id,
    fromStageId: prev,
    toStageId: stageId,
    enteredAt: t,
    changedBy: uid
  });

  const sm = await crmStageNameMap(companyId, [prev, stageId]);
  await CreateCrmDealActivityService({
    companyId,
    dealId: deal.id,
    userId: uid,
    type: "stage_changed",
    title: "stage_changed",
    metadata: {
      fromStageId: prev,
      toStageId: stageId,
      fromStageName: sm.get(prev) ?? "",
      toStageName: sm.get(stageId) ?? ""
    }
  });

  await RunCrmAutomationRulesForDealService({
    companyId,
    dealId: deal.id,
    triggerType: "stage_changed",
    context: { toStageId: stageId }
  });

  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.json(full);
};

export const resolveDealAttention = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await findDealRowForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);

  const hadAttention = deal.attentionAt != null;
  const userIdAct = reqUserId(req);

  await deal.update({
    attentionAt: null,
    attentionReason: null,
    attentionNotifiedAt: null,
    automationLastStaleNotifyAt: null,
    lastActivityAt: new Date()
  });

  if (hadAttention) {
    await CreateCrmDealActivityService({
      companyId,
      dealId: deal.id,
      userId: userIdAct,
      type: "attention_resolved",
      title: "attention_resolved",
      metadata: {}
    });
  }

  const full = await CrmDeal.findByPk(deal.id, { include: dealInclude });
  return res.json(full);
};

export const removeDeal = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const deal = await findDealRowForRequest(req, companyId, id);
  if (!deal) throw new AppError("ERR_NO_CRM_DEAL", 404);
  await deal.destroy();
  return res.status(204).send();
};

export const listPipelineStages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const pipelineId = Number(req.params.pipelineId);
  if (!Number.isFinite(pipelineId)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const rows = await ListCrmStagesService({ companyId, pipelineId });
  return res.json(rows);
};

export const createPipelineStage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const pipelineId = Number(req.params.pipelineId);
  if (!Number.isFinite(pipelineId)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const schema = Yup.object({
    name: Yup.string().min(1).max(255).required(),
    color: Yup.string().max(32).optional(),
    kind: crmStageKindSchema
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const stage = await CreateCrmStageService({
    companyId,
    pipelineId,
    name: body.name,
    color: body.color,
    kind: body.kind as StageKindInput | undefined
  });
  return res.status(201).json(stage);
};

export const updateStage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const stageId = Number(req.params.stageId);
  if (!Number.isFinite(stageId)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const schema = Yup.object({
    name: Yup.string().min(1).max(255).optional(),
    color: Yup.string().max(32).optional(),
    kind: crmStageKindSchema
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  if (
    body.name === undefined &&
    body.color === undefined &&
    body.kind === undefined
  ) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const stage = await UpdateCrmStageService({
    companyId,
    stageId,
    name: body.name,
    color: body.color,
    kind: body.kind as StageKindInput | undefined
  });
  return res.json(stage);
};

export const reorderStages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const schema = Yup.object({
    pipelineId: Yup.number().integer().required(),
    stageIds: Yup.array()
      .of(Yup.number().integer().required())
      .min(1)
      .required()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const rows = await ReorderCrmStagesService({
    companyId,
    pipelineId: body.pipelineId,
    stageIds: body.stageIds
  });
  return res.json(rows);
};

export const deleteStage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const stageId = Number(req.params.stageId);
  if (!Number.isFinite(stageId)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  await DeleteCrmStageService({ companyId, stageId });
  return res.status(204).send();
};

export const listCrmCustomFields = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const q = req.query as Record<string, string | undefined>;
  const pipelineIdQ = q.pipelineId;
  const pipelineId =
    pipelineIdQ != null &&
    pipelineIdQ !== "" &&
    Number.isFinite(Number(pipelineIdQ))
      ? Number(pipelineIdQ)
      : undefined;
  const rows = await ListCrmCustomFieldsService({ companyId, pipelineId });
  return res.json(rows);
};

export const createCrmCustomField = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const schema = Yup.object({
    label: Yup.string().min(1).max(255).required(),
    type: crmCustomFieldTypeSchema.required(),
    pipelineId: Yup.number().integer().nullable().optional(),
    options: Yup.mixed().nullable().optional(),
    required: Yup.boolean().optional(),
    visibleOnCard: Yup.boolean().optional(),
    position: Yup.number().integer().optional()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const pipelineId =
    body.pipelineId === null || body.pipelineId === undefined
      ? null
      : Number(body.pipelineId);
  const row = await CreateCrmCustomFieldService({
    companyId,
    pipelineId,
    label: body.label,
    type: body.type as CrmCustomFieldType,
    options: body.options,
    required: body.required,
    visibleOnCard: body.visibleOnCard,
    position: body.position
  });
  return res.status(201).json(row);
};

export const updateCrmCustomField = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const schema = Yup.object({
    label: Yup.string().min(1).max(255).optional(),
    type: crmCustomFieldTypeSchema.optional(),
    options: Yup.mixed().nullable().optional(),
    required: Yup.boolean().optional(),
    visibleOnCard: Yup.boolean().optional(),
    position: Yup.number().integer().optional(),
    active: Yup.boolean().optional(),
    pipelineId: Yup.number().integer().nullable().optional()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const row = await UpdateCrmCustomFieldService({
    companyId,
    id,
    label: body.label,
    type: body.type as CrmCustomFieldType | undefined,
    options: body.options,
    required: body.required,
    visibleOnCard: body.visibleOnCard,
    position: body.position,
    active: body.active,
    pipelineId: body.pipelineId
  });
  return res.json(row);
};

export const deleteCrmCustomField = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const row = await DeleteOrDeactivateCrmCustomFieldService({ companyId, id });
  return res.json(row);
};

function reqUserSupportMeta(req: Request): {
  requesterId: number | null;
  requesterProfile?: string;
  requesterSupportMode: boolean;
} {
  const u = req.user as
    | { id?: string; profile?: string; supportMode?: boolean }
    | undefined;
  return {
    requesterId: u?.id != null ? Number(u.id) : null,
    requesterProfile: u?.profile,
    requesterSupportMode: Boolean(u?.supportMode)
  };
}

export const listCrmSavedViews = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListCrmSavedViewsService({ companyId });
  return res.json(rows);
};

export const createCrmSavedView = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const schema = Yup.object({
    name: Yup.string().min(1).max(120).required(),
    filters: Yup.mixed().required(),
    isDefault: Yup.boolean().optional()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const row = await CreateCrmSavedViewService({
    companyId,
    userId: reqUserId(req),
    name: body.name,
    filters: body.filters,
    isDefault: body.isDefault
  });
  return res.status(201).json(row);
};

export const updateCrmSavedView = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const meta = reqUserSupportMeta(req);
  const schema = Yup.object({
    name: Yup.string().min(1).max(120).optional(),
    filters: Yup.mixed().optional(),
    isDefault: Yup.boolean().optional()
  });
  const body = await schema.validate(req.body, { abortEarly: false });
  const row = await UpdateCrmSavedViewService({
    companyId,
    id,
    requesterId: meta.requesterId,
    requesterProfile: meta.requesterProfile,
    requesterSupportMode: meta.requesterSupportMode,
    name: body.name,
    filters: body.filters,
    isDefault: body.isDefault
  });
  return res.json(row);
};

export const deleteCrmSavedView = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const meta = reqUserSupportMeta(req);
  await DeleteCrmSavedViewService({
    companyId,
    id,
    requesterId: meta.requesterId,
    requesterProfile: meta.requesterProfile,
    requesterSupportMode: meta.requesterSupportMode
  });
  return res.status(204).send();
};
