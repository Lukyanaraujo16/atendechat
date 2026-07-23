import { rebuildExecutionFromPersistence } from "./PersistentReplayService";
import { listAgentOsEvents } from "./AgentOsEventBus";
import { getObservabilityMetrics } from "./ObservabilityMetricsStore";
import { getTimelinePersistent, listTimelines } from "./TimelineBuilder";
import { listAgentOsAlerts } from "./AlertEngine";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach(k => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(","), ...rows.map(r => keys.map(k => esc(r[k])).join(","))].join(
    "\n"
  );
}

export async function exportObservability(input: {
  companyId: number;
  kind: "replay" | "audit" | "metrics" | "timeline" | "events" | "alerts";
  format: "json" | "csv";
  traceId?: string;
}) {
  let data: unknown;

  switch (input.kind) {
    case "replay":
      if (!input.traceId) throw new Error("ERR_OBS_TRACE_REQUIRED");
      data = await rebuildExecutionFromPersistence({
        companyId: input.companyId,
        traceId: input.traceId
      });
      break;
    case "audit": {
      const rows = await observabilityRepository.listAudits(input.companyId, {
        limit: 500
      });
      data = (rows || []).map((r: any) =>
        typeof r.toJSON === "function" ? r.toJSON() : r
      );
      break;
    }
    case "metrics":
      data = getObservabilityMetrics(input.companyId);
      break;
    case "timeline":
      if (input.traceId) {
        data = await getTimelinePersistent(input.companyId, input.traceId);
      } else {
        data = listTimelines(input.companyId, 100);
      }
      break;
    case "events":
      data = listAgentOsEvents(input.companyId, {
        traceId: input.traceId,
        limit: 500
      });
      break;
    case "alerts":
      data = listAgentOsAlerts(input.companyId, { limit: 500 });
      break;
    default:
      throw new Error("ERR_OBS_EXPORT_KIND");
  }

  if (input.format === "json") {
    return {
      format: "json",
      kind: input.kind,
      data,
      exportedAt: new Date().toISOString()
    };
  }

  const rows = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [data as Record<string, unknown>];
  return {
    format: "csv",
    kind: input.kind,
    csv: toCsv(rows),
    exportedAt: new Date().toISOString()
  };
}
