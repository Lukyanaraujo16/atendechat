import moment from "moment-timezone";

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

export function normalizeHexColor(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return HEX_COLOR.test(s) ? s.toLowerCase() : null;
}

function linearize(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Texto legível sobre fundo #rrggbb (estilo Material / WCAG simplificado). */
export function contrastTextOnHex(bgHex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bgHex || "");
  if (!m) return "#ffffff";
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const L = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  return L > 0.55 ? "#202124" : "#ffffff";
}

function shadeHex(hex, amount) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return hex;
  const r = Math.min(255, Math.max(0, parseInt(m[1], 16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(m[2], 16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(m[3], 16) + amount));
  const to = (n) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Paleta pré-definida (tons próximos ao Google Calendar). */
export const GOOGLE_CALENDAR_PALETTE = [
  { key: "blue", hex: "#1a73e8" },
  { key: "green", hex: "#0f9d58" },
  { key: "yellow", hex: "#f9ab00" },
  { key: "red", hex: "#d93025" },
  { key: "purple", hex: "#9334e6" },
  { key: "gray", hex: "#616161" },
];

/**
 * react-big-calendar chama onRangeChange assim:
 * — Mês: { start, end } (primeiro/último dia visível na grelha)
 * — Semana: array com 7 dias (localizer.range)
 * — Dia: array com 1 dia
 */
export function normalizeReactBigCalendarFetchRange(rangeInput, tz) {
  if (!rangeInput || !tz) return null;

  if (
    typeof rangeInput === "object" &&
    !Array.isArray(rangeInput) &&
    rangeInput.start &&
    rangeInput.end
  ) {
    return {
      start: moment.tz(rangeInput.start, tz).startOf("day").toDate(),
      end: moment.tz(rangeInput.end, tz).endOf("day").toDate(),
    };
  }

  if (Array.isArray(rangeInput) && rangeInput.length > 0) {
    const first = rangeInput[0];
    const last = rangeInput[rangeInput.length - 1];
    return {
      start: moment.tz(first, tz).startOf("day").toDate(),
      end: moment.tz(last, tz).endOf("day").toDate(),
    };
  }

  return null;
}

/** Converte compromissos da API para eventos do react-big-calendar (datas válidas, all-day correto). */
export function toCalendarEventsForRbc(list, myId, tz) {
  if (!list || !list.length) return [];
  const uid = Number(myId);
  const zone = tz || moment.tz.guess();
  return list
    .map((a) => {
      const start = new Date(a.startAt);
      let end = new Date(a.endAt);
      if (Number.isNaN(start.getTime())) return null;
      if (Number.isNaN(end.getTime())) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      const allDay = Boolean(a.allDay);
      let endForRbc = end;
      if (allDay) {
        const sd = moment.tz(start, zone).startOf("day");
        const ed = moment.tz(end, zone).startOf("day");
        const lastDay = ed.isBefore(sd) ? sd : ed;
        endForRbc = lastDay.clone().add(1, "day").startOf("day").toDate();
      }
      const isMine = Number(a.createdBy) === uid;
      const collective = Boolean(a.isCollective);
      const custom = normalizeHexColor(a.color);
      const palette = resolveAgendaEventPalette({ collective, isMine, customColor: custom });
      return {
        id: a.id,
        title: a.title || "",
        start,
        end: endForRbc,
        allDay,
        resource: { ...a, isMine, ...palette },
      };
    })
    .filter(Boolean);
}

/** Cores: personalizada ou padrão por tipo (com borda para “criado por mim”). */
export function resolveAgendaEventPalette({ collective, isMine, customColor }) {
  const accentBorder = isMine ? "#f9ab00" : "transparent";
  const solid = normalizeHexColor(customColor);
  if (solid) {
    const text = contrastTextOnHex(solid);
    return {
      eventColor: solid,
      eventColorStrong: shadeHex(solid, -12),
      eventBg: solid,
      eventBgHover: shadeHex(solid, -18),
      textColor: text,
      accentBorder,
      fillSolid: true,
    };
  }
  if (collective) {
    return {
      eventColor: "#1a73e8",
      eventColorStrong: "#1967d2",
      eventBg: "rgba(26, 115, 232, 0.18)",
      eventBgHover: "rgba(26, 115, 232, 0.28)",
      textColor: "#174ea6",
      accentBorder,
      fillSolid: false,
    };
  }
  return {
    eventColor: "#0f9d58",
    eventColorStrong: "#0d904f",
    eventBg: "rgba(15, 157, 88, 0.18)",
    eventBgHover: "rgba(15, 157, 88, 0.28)",
    textColor: "#137333",
    accentBorder,
    fillSolid: false,
  };
}

/** Filtro rápido exclusivo (um de cada vez). */
export const QUICK_FILTERS = {
  ALL: "all",
  MY_EVENTS: "my",
  CREATED_BY_ME: "createdByMe",
  COLLECTIVE: "collective",
  INDIVIDUAL: "individual",
  TODAY: "today",
  NEXT_7: "next7",
};

export const appointmentOverlapsRange = (a, rangeStart, rangeEnd) => {
  const as = new Date(a.startAt).getTime();
  const ae = new Date(a.endAt).getTime();
  return as <= rangeEnd.getTime() && ae >= rangeStart.getTime();
};

export const applyQuickFilter = (list, filterId, userId, tz) => {
  if (!list || !list.length) return [];
  const uid = Number(userId);
  const zone = tz || moment.tz.guess();
  const now = moment.tz(zone);

  switch (filterId) {
    case QUICK_FILTERS.ALL:
      return list;
    case QUICK_FILTERS.MY_EVENTS:
      return list.filter((a) => {
        if (Number(a.createdBy) === uid) return true;
        return (a.participants || []).some((p) => Number(p.userId) === uid);
      });
    case QUICK_FILTERS.CREATED_BY_ME:
      return list.filter((a) => Number(a.createdBy) === uid);
    case QUICK_FILTERS.COLLECTIVE:
      return list.filter((a) => Boolean(a.isCollective));
    case QUICK_FILTERS.INDIVIDUAL:
      return list.filter((a) => !a.isCollective);
    case QUICK_FILTERS.TODAY: {
      const start = now.clone().startOf("day").toDate();
      const end = now.clone().endOf("day").toDate();
      return list.filter((a) => appointmentOverlapsRange(a, start, end));
    }
    case QUICK_FILTERS.NEXT_7: {
      const start = now.clone().startOf("day").toDate();
      const end = now.clone().add(7, "day").endOf("day").toDate();
      return list.filter((a) => appointmentOverlapsRange(a, start, end));
    }
    default:
      return list;
  }
};

export const matchesSearchText = (a, q) => {
  if (!q || !String(q).trim()) return true;
  const needle = String(q).trim().toLowerCase();
  const hay = (s) => Boolean(s && String(s).toLowerCase().includes(needle));
  if (hay(a.title) || hay(a.description)) return true;
  const creator = a.creator?.name || a.creator?.email || "";
  if (hay(creator)) return true;
  for (const p of a.participants || []) {
    const n = p.user?.name || p.user?.email || "";
    if (hay(n)) return true;
  }
  return false;
};

/** Agrupa pelo dia de início do evento no fuso da empresa. */
export const groupAppointmentsByStartDay = (list, tz) => {
  const sorted = sortAppointmentsByStart(list);
  const zone = tz || moment.tz.guess();
  const todayAnchor = moment.tz(zone);
  const todayKey = todayAnchor.format("YYYY-MM-DD");
  const tomorrowKey = todayAnchor.clone().add(1, "day").format("YYYY-MM-DD");
  const today = [];
  const tomorrow = [];
  const later = [];
  for (const a of sorted) {
    const dayKey = moment.utc(a.startAt).tz(zone).format("YYYY-MM-DD");
    if (dayKey === todayKey) today.push(a);
    else if (dayKey === tomorrowKey) tomorrow.push(a);
    else later.push(a);
  }
  return [
    { id: "today", items: today },
    { id: "tomorrow", items: tomorrow },
    { id: "later", items: later },
  ].filter((g) => g.items.length > 0);
};

export const countOverlappingToday = (list, tz) => {
  const zone = tz || moment.tz.guess();
  const now = moment.tz(zone);
  const start = now.clone().startOf("day").toDate();
  const end = now.clone().endOf("day").toDate();
  return (list || []).filter((a) => appointmentOverlapsRange(a, start, end)).length;
};

export const appointmentOverlapsToday = (a, tz) => {
  const zone = tz || moment.tz.guess();
  const now = moment.tz(zone);
  return appointmentOverlapsRange(
    a,
    now.clone().startOf("day").toDate(),
    now.clone().endOf("day").toDate()
  );
};

export const canEditAppointment = (event, userId, elevated) => {
  if (!event) return false;
  return (
    Number(event.createdBy) === Number(userId) || (elevated && Boolean(event.isCollective))
  );
};

export const sortAppointmentsByStart = (list) =>
  [...(list || [])].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

export const visibilityLabelKey = (v) => {
  if (v === "team") return "agenda.form.visTeam";
  if (v === "company") return "agenda.form.visCompany";
  return "agenda.form.visPrivate";
};

export const participantStatusKey = (s) => {
  if (s === "accepted") return "agenda.participantStatus.accepted";
  if (s === "declined") return "agenda.participantStatus.declined";
  return "agenda.participantStatus.pending";
};

export const formatEventWhen = (a, locale, tz) => {
  const m = locale === "en" ? "en" : locale === "es" ? "es" : "pt-br";
  const zone = tz || moment.tz.guess();
  const s = moment.utc(a.startAt).tz(zone).locale(m);
  const e = moment.utc(a.endAt).tz(zone).locale(m);
  if (a.allDay) {
    return s.format("LL");
  }
  if (s.isSame(e, "day")) {
    return `${s.format("LL")} · ${s.format("LT")} – ${e.format("LT")}`;
  }
  return `${s.format("LL LT")} → ${e.format("LL LT")}`;
};
