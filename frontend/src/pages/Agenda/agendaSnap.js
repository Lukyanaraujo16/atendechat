import moment from "moment-timezone";

/**
 * Alinhado a `step={30}` do react-big-calendar — evita eventos “entre” linhas da grelha.
 * (15 min seria possível com step={15} timeslots={4}; aqui priorizamos consistência visual.)
 */
export const AGENDA_SNAP_MINUTES = 30;

export function snapMomentToGrid(m, snapMinutes = AGENDA_SNAP_MINUTES) {
  const sod = m.clone().startOf("day");
  const mins = m.diff(sod, "minutes");
  const snapped = Math.round(mins / snapMinutes) * snapMinutes;
  return sod.clone().add(snapped, "minutes").second(0).millisecond(0);
}

/**
 * Ajusta pares datetime-local (YYYY-MM-DDTHH:mm) no TZ da empresa.
 */
export function snapDatetimeLocalPair(startStr, endStr, tz, snapMinutes = AGENDA_SNAP_MINUTES) {
  const s = moment.tz(String(startStr), "YYYY-MM-DDTHH:mm", true, tz);
  const e = moment.tz(String(endStr), "YYYY-MM-DDTHH:mm", true, tz);
  if (!s.isValid() || !e.isValid()) {
    return { startStr: String(startStr), endStr: String(endStr) };
  }
  const s2 = snapMomentToGrid(s, snapMinutes);
  let e2 = snapMomentToGrid(e, snapMinutes);
  if (e2.valueOf() <= s2.valueOf()) {
    e2 = s2.clone().add(snapMinutes, "minutes");
  }
  return {
    startStr: s2.format("YYYY-MM-DDTHH:mm"),
    endStr: e2.format("YYYY-MM-DDTHH:mm"),
  };
}

/**
 * @param {'move'|'resize'} mode — move preserva duração após snap do início; resize alinha início e fim.
 */
export function snapInteractionDates(
  { start, end, allDay, mode },
  tz,
  snapMinutes = AGENDA_SNAP_MINUTES
) {
  const s = moment.tz(start, tz);
  const e = moment.tz(end, tz);
  if (allDay) {
    return {
      start: s.clone().startOf("day").toDate(),
      end: e.clone().startOf("day").toDate(),
    };
  }
  if (mode === "move") {
    const durMs = e.valueOf() - s.valueOf();
    const s2 = snapMomentToGrid(s, snapMinutes);
    const e2 = s2.clone().add(durMs, "ms");
    return { start: s2.toDate(), end: e2.toDate() };
  }
  const s2 = snapMomentToGrid(s, snapMinutes);
  let e2 = snapMomentToGrid(e, snapMinutes);
  if (e2.valueOf() <= s2.valueOf()) {
    e2 = s2.clone().add(snapMinutes, "minutes");
  }
  return { start: s2.toDate(), end: e2.toDate() };
}

export function snapOpenNewMoments(startM, endM, snapMinutes = AGENDA_SNAP_MINUTES) {
  const s2 = snapMomentToGrid(startM, snapMinutes);
  let e2 = snapMomentToGrid(endM, snapMinutes);
  if (e2.valueOf() <= s2.valueOf()) {
    e2 = s2.clone().add(snapMinutes, "minutes");
  }
  return { startM: s2, endM: e2 };
}
