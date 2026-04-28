import moment from "moment-timezone";

export const AGENDA_FALLBACK_TIMEZONE = "America/Sao_Paulo";

/**
 * Ordem: timezone da empresa na sessão → fallback seguro (sem usar relógio da VPS no cliente).
 * Fallback “sistema” global pode ser acrescentado aqui quando existir chave em SystemSettings.
 */
export function resolveAgendaTimezone(user) {
  const raw = user?.company?.timezone;
  if (raw && typeof raw === "string" && raw.trim() && moment.tz.zone(raw.trim())) {
    return raw.trim();
  }
  return AGENDA_FALLBACK_TIMEZONE;
}

/** datetime-local (YYYY-MM-DDTHH:mm) no fuso da empresa → ISO UTC */
export function wallDateTimeToUtcIso(naiveLocal, tz) {
  const m = moment.tz(String(naiveLocal).trim(), "YYYY-MM-DDTHH:mm", true, tz);
  if (!m.isValid()) {
    return null;
  }
  return m.utc().toISOString();
}

/** Apenas data (YYYY-MM-DD) — início do dia civil no TZ da empresa → ISO UTC */
export function wallDateStartToUtcIso(dateStr, tz) {
  const m = moment.tz(String(dateStr).trim(), "YYYY-MM-DD", true, tz);
  if (!m.isValid()) {
    return null;
  }
  return m.startOf("day").utc().toISOString();
}

/** Fim do dia civil no TZ da empresa → ISO UTC */
export function wallDateEndToUtcIso(dateStr, tz) {
  const m = moment.tz(String(dateStr).trim(), "YYYY-MM-DD", true, tz);
  if (!m.isValid()) {
    return null;
  }
  return m.endOf("day").utc().toISOString();
}

/** Instante UTC (string API) → valor para input datetime-local no TZ da empresa */
export function utcIsoToDatetimeLocal(iso, tz) {
  const m = moment.utc(iso);
  if (!m.isValid()) {
    return "";
  }
  return m.tz(tz).format("YYYY-MM-DDTHH:mm");
}

/**
 * Converte intervalo devolvido pelo react-big-calendar (após drag/resize) para ISO UTC da API.
 * Usa sempre o relógio civil no TZ da empresa (não o timezone do navegador).
 *
 * @param {{ start: Date; end: Date; allDay: boolean }} range
 * @param {string} tz IANA
 * @returns {{ startAt: string; endAt: string; allDay: boolean } | null}
 */
export function rbcInteractionToApiUtc(range, tz) {
  const { start, end, allDay: allDayRaw } = range;
  const allDay = Boolean(allDayRaw);
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return null;
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (allDay) {
    const startDayStr = moment.tz(start, tz).format("YYYY-MM-DD");
    const endExclusive = moment.tz(end, tz);
    const lastDayStr = endExclusive.clone().subtract(1, "ms").format("YYYY-MM-DD");
    const startAt = wallDateStartToUtcIso(startDayStr, tz);
    const endAt = wallDateEndToUtcIso(lastDayStr, tz);
    if (!startAt || !endAt) {
      return null;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return null;
    }
    return { startAt, endAt, allDay: true };
  }

  const startStr = moment.tz(start, tz).format("YYYY-MM-DDTHH:mm");
  const endStr = moment.tz(end, tz).format("YYYY-MM-DDTHH:mm");
  const startAt = wallDateTimeToUtcIso(startStr, tz);
  const endAt = wallDateTimeToUtcIso(endStr, tz);
  if (!startAt || !endAt) {
    return null;
  }
  if (new Date(endAt) <= new Date(startAt)) {
    return null;
  }
  return { startAt, endAt, allDay: false };
}
