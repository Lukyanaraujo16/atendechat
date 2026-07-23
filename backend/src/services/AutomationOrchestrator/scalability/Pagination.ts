import AppError from "../../../errors/AppError";
import { getScalabilityConfig } from "./ScalabilityConfig";

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  limit: number;
};

export function clampPageLimit(limit?: number): number {
  const cfg = getScalabilityConfig();
  const n = limit == null ? cfg.defaultPageLimit : Number(limit);
  if (!Number.isFinite(n) || n <= 0) return cfg.defaultPageLimit;
  return Math.min(cfg.maxPageLimit, Math.floor(n));
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string | null): Record<string, unknown> | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), "base64url").toString("utf8");
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as Record<string, unknown>;
    return null;
  } catch {
    throw new AppError("ERR_VALIDATION", 400, "cursor inválido");
  }
}

/**
 * Paginação por cursor sobre arrays in-memory (order estável por createdAt+id).
 */
export function paginateByCreatedAtId<
  T extends { createdAt?: string | Date; id?: string | number }
>(
  items: T[],
  opts?: { cursor?: string | null; limit?: number }
): CursorPage<T> {
  const limit = clampPageLimit(opts?.limit);
  const cur = decodeCursor(opts?.cursor);
  const sorted = [...items].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    if (ta !== tb) return tb - ta;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
  let start = 0;
  if (cur?.id != null) {
    const idx = sorted.findIndex(x => String(x.id) === String(cur.id));
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = sorted.slice(start, start + limit);
  const last = slice[slice.length - 1];
  const nextCursor =
    slice.length === limit && last
      ? encodeCursor({
          id: last.id,
          createdAt: last.createdAt
        })
      : null;
  return { items: slice, nextCursor, limit };
}
