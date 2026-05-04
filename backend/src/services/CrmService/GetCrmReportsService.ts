import { Op } from "sequelize";
import CrmDeal from "../../models/CrmDeal";
import CrmPipeline from "../../models/CrmPipeline";
import CrmStage from "../../models/CrmStage";
import CrmDealStageHistory from "../../models/CrmDealStageHistory";
import User from "../../models/User";

export type CrmReportsInput = {
  companyId: number;
  start: Date;
  end: Date;
  pipelineIdQ: string | undefined;
  assignedUserIdQ: string | undefined;
  sourceQ: string | undefined;
  statusQ: string | undefined;
  /** Operador em modo "assigned": força deals só deste responsável. */
  visibilityAssignedUserId?: number | undefined;
};

function numValue(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildStructuralWhere(input: {
  companyId: number;
  pipelineId: number | null;
  assignedUserIdQ: string | undefined;
  sourceQ: string | undefined;
  visibilityAssignedUserId?: number | undefined;
}): Record<string, unknown> {
  const w: Record<string, unknown> = { companyId: input.companyId };
  if (input.pipelineId != null) {
    w.pipelineId = input.pipelineId;
  }
  if (input.visibilityAssignedUserId != null) {
    w.assignedUserId = input.visibilityAssignedUserId;
  } else if (input.assignedUserIdQ !== undefined && input.assignedUserIdQ !== "") {
    if (input.assignedUserIdQ === "unassigned") {
      w.assignedUserId = { [Op.is]: null };
    } else {
      const n = Number(input.assignedUserIdQ);
      if (Number.isFinite(n)) {
        w.assignedUserId = n;
      }
    }
  }
  if (
    input.sourceQ != null &&
    input.sourceQ !== "" &&
    ["whatsapp", "manual", "instagram", "other"].includes(input.sourceQ)
  ) {
    w.source = input.sourceQ;
  }
  return w;
}

export type CrmReportsSummary = {
  createdCount: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number | null;
  openValue: number;
  wonValue: number;
  lostValue: number;
  avgCloseMs: number | null;
  attentionCount: number;
};

export type CrmReportStageRow = {
  stageId: number;
  stageName: string;
  currentCount: number;
  currentValue: number;
  avgDurationMs: number | null;
  percentOfOpen: number;
};

export type CrmReportBottleneck = {
  stageId: number;
  stageName: string;
  avgDurationMs: number;
};

export type CrmReportAttentionDeal = {
  id: number;
  title: string;
  stageName: string;
  assignedUserName: string | null;
  lastActivityAt: string | null;
};

export type CrmReportTimelineRow = {
  date: string;
  created: number;
  won: number;
  lost: number;
};

export type CrmReportsResult = {
  summary: CrmReportsSummary;
  stages: CrmReportStageRow[];
  bottlenecks: CrmReportBottleneck[];
  attentionDeals: CrmReportAttentionDeal[];
  timeline: CrmReportTimelineRow[];
};

function enumerateUtcDayKeys(start: Date, end: Date): string[] {
  const s = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const e = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );
  const out: string[] = [];
  for (let t = s; t <= e; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function buildTimeline(
  start: Date,
  end: Date,
  createdRows: Array<{ createdAt: Date }>,
  wonDeals: Array<{ updatedAt: Date }>,
  lostDeals: Array<{ updatedAt: Date }>,
  includeWon: boolean,
  includeLost: boolean
): CrmReportTimelineRow[] {
  const dayKeys = enumerateUtcDayKeys(start, end);
  const createdMap = new Map<string, number>();
  for (const r of createdRows) {
    const k = new Date(r.createdAt).toISOString().slice(0, 10);
    createdMap.set(k, (createdMap.get(k) ?? 0) + 1);
  }
  const wonMap = new Map<string, number>();
  if (includeWon) {
    for (const r of wonDeals) {
      const k = new Date(r.updatedAt).toISOString().slice(0, 10);
      wonMap.set(k, (wonMap.get(k) ?? 0) + 1);
    }
  }
  const lostMap = new Map<string, number>();
  if (includeLost) {
    for (const r of lostDeals) {
      const k = new Date(r.updatedAt).toISOString().slice(0, 10);
      lostMap.set(k, (lostMap.get(k) ?? 0) + 1);
    }
  }
  return dayKeys.map((date) => ({
    date,
    created: createdMap.get(date) ?? 0,
    won: wonMap.get(date) ?? 0,
    lost: lostMap.get(date) ?? 0
  }));
}

export default async function GetCrmReportsService(
  input: CrmReportsInput
): Promise<CrmReportsResult> {
  const { companyId, start, end } = input;
  const now = Date.now();

  const pipelineIdNum =
    input.pipelineIdQ && Number.isFinite(Number(input.pipelineIdQ))
      ? Number(input.pipelineIdQ)
      : null;

  let funnelPipelineId: number | null = null;
  if (pipelineIdNum != null) {
    const pExist = await CrmPipeline.findOne({
      where: { id: pipelineIdNum, companyId }
    });
    if (pExist) funnelPipelineId = pipelineIdNum;
  }
  if (funnelPipelineId == null) {
    const def = await CrmPipeline.findOne({
      where: { companyId, isDefault: true }
    });
    funnelPipelineId = def?.id ?? null;
  }

  const structural = buildStructuralWhere({
    companyId,
    pipelineId: pipelineIdNum,
    assignedUserIdQ: input.assignedUserIdQ,
    sourceQ: input.sourceQ,
    visibilityAssignedUserId: input.visibilityAssignedUserId
  });

  const createdWhere: Record<string, unknown> = {
    ...structural,
    createdAt: { [Op.gte]: start, [Op.lte]: end }
  };
  if (
    input.statusQ === "open" ||
    input.statusQ === "won" ||
    input.statusQ === "lost"
  ) {
    createdWhere.status = input.statusQ;
  }

  const openWhere: Record<string, unknown> = {
    ...structural,
    status: "open"
  };

  const includeWon =
    input.statusQ == null ||
    input.statusQ === "" ||
    input.statusQ === "won";
  const includeLost =
    input.statusQ == null ||
    input.statusQ === "" ||
    input.statusQ === "lost";

  const [createdRows, openCount, attentionCount] = await Promise.all([
    CrmDeal.findAll({
      where: createdWhere,
      attributes: ["createdAt"]
    }),
    CrmDeal.count({ where: openWhere }),
    CrmDeal.count({
      where: {
        ...structural,
        status: "open",
        attentionAt: { [Op.ne]: null }
      }
    })
  ]);
  const createdCount = createdRows.length;

  let wonDeals: CrmDeal[] = [];
  let lostDeals: CrmDeal[] = [];
  if (includeWon) {
    wonDeals = await CrmDeal.findAll({
      where: {
        ...structural,
        status: "won",
        updatedAt: { [Op.gte]: start, [Op.lte]: end }
      },
      attributes: ["id", "value", "createdAt", "updatedAt"]
    });
  }
  if (includeLost) {
    lostDeals = await CrmDeal.findAll({
      where: {
        ...structural,
        status: "lost",
        updatedAt: { [Op.gte]: start, [Op.lte]: end }
      },
      attributes: ["id", "value", "createdAt", "updatedAt"]
    });
  }

  const wonCount = wonDeals.length;
  const lostCount = lostDeals.length;
  const wonValue = wonDeals.reduce((s, d) => s + numValue(d.value), 0);
  const lostValue = lostDeals.reduce((s, d) => s + numValue(d.value), 0);

  let conversionRate: number | null = null;
  if (includeWon && includeLost) {
    const decided = wonCount + lostCount;
    if (decided > 0) {
      conversionRate = Math.round((100 * wonCount) / decided);
    }
  }

  const openRows = await CrmDeal.findAll({
    where: openWhere,
    attributes: ["id", "value", "createdAt", "updatedAt"]
  });
  const openValue = openRows.reduce((s, d) => s + numValue(d.value), 0);

  const closeDurations: number[] = [];
  for (const d of [...wonDeals, ...lostDeals]) {
    const c0 = new Date(d.createdAt).getTime();
    const c1 = new Date(d.updatedAt).getTime();
    if (!Number.isNaN(c0) && !Number.isNaN(c1) && c1 >= c0) {
      closeDurations.push(c1 - c0);
    }
  }
  const avgCloseMs =
    closeDurations.length > 0
      ? closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length
      : null;

  const summary: CrmReportsSummary = {
    createdCount,
    openCount,
    wonCount,
    lostCount,
    conversionRate,
    openValue,
    wonValue,
    lostValue,
    avgCloseMs,
    attentionCount
  };

  const attentionDeals = await loadAttentionDeals(structural);

  const timeline = buildTimeline(
    start,
    end,
    createdRows,
    wonDeals,
    lostDeals,
    includeWon,
    includeLost
  );

  if (!funnelPipelineId) {
    return {
      summary,
      stages: [],
      bottlenecks: [],
      attentionDeals,
      timeline
    };
  }

  const stages = await CrmStage.findAll({
    where: { pipelineId: funnelPipelineId, companyId },
    order: [["position", "ASC"]],
    attributes: ["id", "name"]
  });

  const funnelDealWhere: Record<string, unknown> = {
    companyId,
    pipelineId: funnelPipelineId,
    status: "open"
  };
  if (structural.assignedUserId !== undefined) {
    funnelDealWhere.assignedUserId = structural.assignedUserId;
  }
  if (structural.source !== undefined) {
    funnelDealWhere.source = structural.source;
  }

  const openInFunnel = await CrmDeal.findAll({
    where: funnelDealWhere,
    attributes: ["id", "stageId", "value", "lastActivityAt", "createdAt"]
  });

  const openIds = openInFunnel.map((d) => d.id);
  const openHistoryRows =
    openIds.length > 0
      ? await CrmDealStageHistory.findAll({
          where: {
            companyId,
            dealId: { [Op.in]: openIds },
            leftAt: { [Op.is]: null }
          },
          attributes: ["dealId", "enteredAt"]
        })
      : [];
  const enteredByDeal = new Map<number, Date>(
    openHistoryRows.map((r) => [r.dealId, r.enteredAt])
  );

  const structuralDealIds = await CrmDeal.findAll({
    where: structural,
    attributes: ["id"]
  });
  const allowedIds = new Set(structuralDealIds.map((d) => d.id));

  const closedSegments = await CrmDealStageHistory.findAll({
    where: {
      companyId,
      leftAt: { [Op.gte]: start, [Op.lte]: end },
      durationMs: { [Op.ne]: null }
    },
    attributes: ["dealId", "toStageId", "durationMs"]
  });
  const closedFiltered = closedSegments.filter((h) => allowedIds.has(h.dealId));

  const durationsByStage = new Map<number, number[]>();
  for (const h of closedFiltered) {
    const sid = h.toStageId;
    const dur = Number(h.durationMs);
    if (!Number.isFinite(dur) || dur < 0) continue;
    const arr = durationsByStage.get(sid) ?? [];
    arr.push(dur);
    durationsByStage.set(sid, arr);
  }

  const totalOpenInFunnel = openInFunnel.length;
  const stagesOut: CrmReportStageRow[] = stages.map((st) => {
    const inStage = openInFunnel.filter((d) => d.stageId === st.id);
    const currentCount = inStage.length;
    const currentValue = inStage.reduce((s, d) => s + numValue(d.value), 0);

    const sampleMs: number[] = [];
    for (const d of inStage) {
      const ent =
        enteredByDeal.get(d.id) ??
        d.lastActivityAt ??
        d.createdAt ??
        new Date(now);
      const t = new Date(ent as Date).getTime();
      if (!Number.isNaN(t)) {
        sampleMs.push(Math.max(0, now - t));
      }
    }
    const hist = durationsByStage.get(st.id) ?? [];
    const allSamples = [...sampleMs, ...hist];
    const avgDurationMs =
      allSamples.length > 0
        ? allSamples.reduce((a, b) => a + b, 0) / allSamples.length
        : null;

    const percentOfOpen =
      totalOpenInFunnel > 0
        ? Math.round((100 * currentCount) / totalOpenInFunnel)
        : 0;

    return {
      stageId: st.id,
      stageName: String(st.name || ""),
      currentCount,
      currentValue,
      avgDurationMs,
      percentOfOpen
    };
  });

  const bottleneckMap = new Map<number, { sum: number; n: number }>();
  for (const h of closedFiltered) {
    const sid = h.toStageId;
    const dur = Number(h.durationMs);
    if (!Number.isFinite(dur) || dur < 0) continue;
    const cur = bottleneckMap.get(sid) ?? { sum: 0, n: 0 };
    cur.sum += dur;
    cur.n += 1;
    bottleneckMap.set(sid, cur);
  }

  const stageNameById = new Map(stages.map((s) => [s.id, String(s.name || "")]));
  const bottlenecks: CrmReportBottleneck[] = [...bottleneckMap.entries()]
    .map(([stageId, { sum, n }]) => ({
      stageId,
      stageName: stageNameById.get(stageId) ?? `#${stageId}`,
      avgDurationMs: n > 0 ? sum / n : 0
    }))
    .filter((b) => b.avgDurationMs > 0)
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 15);

  return {
    summary,
    stages: stagesOut,
    bottlenecks,
    attentionDeals,
    timeline
  };
}

async function loadAttentionDeals(
  structural: Record<string, unknown>
): Promise<CrmReportAttentionDeal[]> {
  const rows = await CrmDeal.findAll({
    where: {
      ...structural,
      status: "open",
      attentionAt: { [Op.ne]: null }
    },
    include: [
      {
        model: CrmStage,
        required: false,
        attributes: ["name"]
      },
      {
        model: User,
        as: "assignedUser",
        attributes: ["name"],
        required: false
      }
    ],
    order: [["lastActivityAt", "ASC"]],
    limit: 50
  });

  return rows.map((d) => {
    const stage = d.stage;
    const au = d.assignedUser;
    return {
      id: d.id,
      title: String(d.title || "").trim() || "—",
      stageName: stage?.name != null ? String(stage.name) : "—",
      assignedUserName: au?.name != null ? String(au.name) : null,
      lastActivityAt: d.lastActivityAt
        ? new Date(d.lastActivityAt).toISOString()
        : null
    };
  });
}
