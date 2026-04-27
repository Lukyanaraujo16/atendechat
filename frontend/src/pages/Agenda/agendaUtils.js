import moment from "moment";

/** Filtro rápido exclusivo (um de cada vez). */
export const QUICK_FILTERS = {
  ALL: "all",
  /** Criador ou participante */
  MY_EVENTS: "my",
  CREATED_BY_ME: "createdByMe",
  COLLECTIVE: "collective",
  INDIVIDUAL: "individual",
  TODAY: "today",
  /** Hoje 00:00 até fim do dia (hoje + 7 dias), inclusivo */
  NEXT_7: "next7",
};

export const appointmentOverlapsRange = (a, rangeStart, rangeEnd) => {
  const as = new Date(a.startAt).getTime();
  const ae = new Date(a.endAt).getTime();
  return as <= rangeEnd.getTime() && ae >= rangeStart.getTime();
};

export const applyQuickFilter = (list, filterId, userId) => {
  if (!list || !list.length) return [];
  const uid = Number(userId);
  const now = moment();

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

/** Agrupa pelo dia de início do evento: hoje / amanhã / depois. */
export const groupAppointmentsByStartDay = (list) => {
  const sorted = sortAppointmentsByStart(list);
  const todayKey = moment().format("YYYY-MM-DD");
  const tomorrowKey = moment().clone().add(1, "day").format("YYYY-MM-DD");
  const today = [];
  const tomorrow = [];
  const later = [];
  for (const a of sorted) {
    const dayKey = moment(a.startAt).format("YYYY-MM-DD");
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

export const countOverlappingToday = (list) => {
  const now = moment();
  const start = now.clone().startOf("day").toDate();
  const end = now.clone().endOf("day").toDate();
  return (list || []).filter((a) => appointmentOverlapsRange(a, start, end)).length;
};

export const appointmentOverlapsToday = (a) => {
  const now = moment();
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

export const formatEventWhen = (a, locale) => {
  const m = locale === "en" ? "en" : locale === "es" ? "es" : "pt-br";
  const s = moment(a.startAt).locale(m);
  const e = moment(a.endAt).locale(m);
  if (a.allDay) {
    return s.format("LL");
  }
  if (s.isSame(e, "day")) {
    return `${s.format("LL")} · ${s.format("LT")} – ${e.format("LT")}`;
  }
  return `${s.format("LL LT")} → ${e.format("LL LT")}`;
};
