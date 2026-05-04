/**
 * Filtros avançados do CRM (client-side, AND entre regras).
 * Campos personalizados: field = "custom.<key>" (key do CrmCustomField).
 */

function isSameLocalCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function followUpCategory(deal) {
  const raw = deal.nextFollowUpAt;
  if (raw == null) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  if (t < now) return "overdue";
  if (isSameLocalCalendarDay(new Date(t), new Date())) return "today";
  return "future";
}

const UNASSIGNED = "__unassigned__";

function normalizeDateKey(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length >= 10) return s.slice(0, 10);
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function coerceDealNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function getCustomKey(field) {
  if (!field || typeof field !== "string") return null;
  if (!field.startsWith("custom.")) return null;
  const k = field.slice(7).trim();
  return k || null;
}

function ruleIsComplete(row, defsByKey) {
  if (!row || !row.field || !row.operator) return false;
  const ck = getCustomKey(row.field);
  if (ck) {
    const def = defsByKey.get(ck);
    if (!def) return false;
    if (def.type === "boolean") {
      return row.value === true || row.value === false;
    }
  } else {
    if (row.field === "attention") {
      return row.value === true || row.value === false;
    }
    if (
      row.field === "stageId" ||
      row.field === "assignedUserId" ||
      row.field === "priority" ||
      row.field === "source" ||
      row.field === "status" ||
      row.field === "followUp"
    ) {
      return row.value !== "" && row.value != null;
    }
  }
  if (row.value === "" || row.value == null) return false;
  return true;
}

function matchBuiltin(deal, field, operator, value) {
  switch (field) {
    case "stageId": {
      const ds = String(deal.stageId ?? "");
      const vs = String(value ?? "");
      if (operator === "equals") return ds === vs;
      if (operator === "not_equals") return ds !== vs;
      return true;
    }
    case "assignedUserId": {
      const du =
        deal.assignedUserId == null || deal.assignedUserId === ""
          ? null
          : String(deal.assignedUserId);
      const isUn = value === UNASSIGNED || value === "" || value == null;
      const vu = isUn ? null : String(value);
      if (operator === "equals") {
        if (vu === null) return du === null;
        return du === vu;
      }
      if (operator === "not_equals") {
        if (vu === null) return du !== null;
        return du !== vu;
      }
      return true;
    }
    case "priority": {
      const dv = String(deal.priority ?? "medium");
      const vv = String(value ?? "");
      if (operator === "equals") return dv === vv;
      if (operator === "not_equals") return dv !== vv;
      return true;
    }
    case "source": {
      const dv = String(deal.source ?? "manual");
      const vv = String(value ?? "");
      if (operator === "equals") return dv === vv;
      if (operator === "not_equals") return dv !== vv;
      return true;
    }
    case "status": {
      const dv = String(deal.status ?? "");
      const vv = String(value ?? "");
      if (operator === "equals") return dv === vv;
      if (operator === "not_equals") return dv !== vv;
      return true;
    }
    case "attention": {
      const has = deal.attentionAt != null;
      const want = value === true;
      if (operator === "equals") return has === want;
      return true;
    }
    case "followUp": {
      const cat = followUpCategory(deal);
      const v = String(value ?? "");
      if (operator !== "equals") return true;
      if (v === "has") return deal.nextFollowUpAt != null;
      if (v === "overdue") return cat === "overdue";
      if (v === "today") return cat === "today";
      return true;
    }
    default:
      return true;
  }
}

function matchCustom(deal, def, operator, value) {
  const key = def.key;
  const raw =
    deal.customFields && typeof deal.customFields === "object"
      ? deal.customFields[key]
      : null;

  const t = def.type;
  if (t === "text") {
    const hay = String(raw ?? "").toLowerCase();
    const needle = String(value ?? "").toLowerCase();
    if (operator === "contains") return hay.includes(needle);
    if (operator === "equals") return String(raw ?? "").trim() === String(value ?? "").trim();
    if (operator === "not_equals") {
      return String(raw ?? "").trim() !== String(value ?? "").trim();
    }
    return true;
  }
  if (t === "number" || t === "currency") {
    const dn = coerceDealNumber(raw);
    const vn = coerceDealNumber(value);
    if (vn == null) return false;
    if (dn == null) return false;
    if (operator === "equals") return dn === vn;
    if (operator === "greater_than") return dn > vn;
    if (operator === "less_than") return dn < vn;
    return true;
  }
  if (t === "date") {
    const dKey = normalizeDateKey(raw);
    const vKey = normalizeDateKey(value);
    if (!vKey) return false;
    if (!dKey) return false;
    if (operator === "equals") return dKey === vKey;
    if (operator === "before") return dKey < vKey;
    if (operator === "after") return dKey > vKey;
    return true;
  }
  if (t === "select") {
    const sv = String(raw ?? "").trim();
    const vv = String(value ?? "").trim();
    if (operator === "equals") return sv === vv;
    if (operator === "not_equals") return sv !== vv;
    return true;
  }
  if (t === "boolean") {
    let b =
      raw === true || raw === false
        ? raw
        : raw === "true" || raw === 1 || raw === "1"
          ? true
          : raw === "false" || raw === 0 || raw === "0"
            ? false
            : null;
    if (b === null) b = false;
    const want = value === true;
    if (operator === "equals") return b === want;
    return true;
  }
  return true;
}

/**
 * @param {object[]} deals
 * @param {{ field: string, operator: string, value: * }[]} filters
 * @param {object[]} customFieldDefs - definições (usar activas; inactivas ignoradas na completeza)
 */
export function applyCrmAdvancedFilters(deals, filters, customFieldDefs = []) {
  const defsByKey = new Map(
    (customFieldDefs || [])
      .filter((d) => d && d.key != null && d.active !== false)
      .map((d) => [d.key, d])
  );

  const rules = (filters || []).filter((f) => ruleIsComplete(f, defsByKey));
  if (!rules.length) return deals || [];

  const list = deals || [];
  return list.filter((deal) =>
    rules.every((row) => {
      const ck = getCustomKey(row.field);
      if (ck) {
        const def = defsByKey.get(ck);
        if (!def) return true;
        return Boolean(matchCustom(deal, def, row.operator, row.value));
      }
      return matchBuiltin(deal, row.field, row.operator, row.value);
    })
  );
}

export function countActiveAdvancedFilters(filters, customFieldDefs = []) {
  const defsByKey = new Map(
    (customFieldDefs || [])
      .filter((d) => d && d.key != null && d.active !== false)
      .map((d) => [d.key, d])
  );
  return (filters || []).filter((f) => ruleIsComplete(f, defsByKey)).length;
}

export { UNASSIGNED };
