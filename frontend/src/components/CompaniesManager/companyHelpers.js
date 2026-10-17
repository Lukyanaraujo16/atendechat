/**
 * Helpers partilhados entre a listagem de empresas (CompaniesManager) e a página individual
 * (pages/Platform/CompanyDetail). Extraídos sem alteração de comportamento.
 */
import moment from "moment-timezone";
import { isArray, has } from "lodash";
import { i18n } from "../../translate/i18n";
import {
  getCompanyEffectivePlanValue,
  formatBrlBrief,
} from "../../utils/companyPlanValue";
import {
  parseBrazilianCurrencyToNumber,
  formatPlanValueForInput,
} from "../../utils/brazilianCurrency";
import { mergeModulePermissions } from "../ModuleSettings/moduleSync";
import { maskCpfCnpj, maskCep, maskPhone, onlyDigits, validateDocument } from "../../helpers/brMasks";

export const REC_MONTHS = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/** Pré-visualização alinhada ao backend RenewCompanyDueDateService. */
export function previewRenewedDueDate(row) {
  if (!row) return null;
  const rec = String(row.recurrence || "").toUpperCase();
  const months = REC_MONTHS[rec];
  if (!months) return null;
  const tz =
    row.timezone && typeof row.timezone === "string"
      ? row.timezone
      : "America/Sao_Paulo";
  try {
    if (!moment.tz.zone(tz)) return null;
    const now = moment.tz(tz).startOf("day");
    let base = now;
    if (row.dueDate) {
      const due = moment.tz(row.dueDate, tz).startOf("day");
      if (due.isValid() && due.isSameOrAfter(now)) {
        base = due;
      }
    }
    return base.clone().add(months, "months").format("YYYY-MM-DD");
  } catch (e) {
    return null;
  }
}

/** Exibe GB no input (vírgula decimal). */
export function formatGbInputFromApi(gb) {
  if (gb == null || gb === "") return "";
  return String(gb).replace(".", ",");
}

export function companyStorageBarColor(percent, palette) {
  if (percent == null) return palette.primary.main;
  if (percent >= 100) return palette.error.main;
  if (percent >= 90) return palette.error.main;
  if (percent >= 80) return palette.warning.main;
  return palette.success.main;
}

export function companyStorageStatusLabel(alertLevel) {
  const lev = alertLevel && typeof alertLevel === "string" ? alertLevel : "ok";
  const key =
    lev === "attention"
      ? "storageStatusAttention"
      : lev === "critical"
        ? "storageStatusCritical"
        : lev === "exceeded"
          ? "storageStatusExceeded"
          : "storageStatusNormal";
  return i18n.t(`platform.companies.${key}`);
}

export function formatStorageBytesBrief(n) {
  const x = Number(n) || 0;
  if (x >= 1073741824) return `${(x / 1073741824).toFixed(2)} GB`;
  if (x >= 1048576) return `${(x / 1048576).toFixed(1)} MB`;
  if (x >= 1024) return `${(x / 1024).toFixed(1)} KB`;
  return `${x} B`;
}

/**
 * Contexto para automação futura (avisos / bloqueio por inadimplência / desbloqueio pós-renovação).
 * Buckets estáveis: expired | today | soon | ok | neutral — usar estes nomes em jobs e regras.
 */
export function getDueCategory(row) {
  if (!row?.dueDate || !moment(row.dueDate).isValid()) {
    return { category: "neutral", diff: null };
  }
  const dueDay = moment(row.dueDate).startOf("day");
  const today = moment().startOf("day");
  const diff = dueDay.diff(today, "days");
  if (diff < 0) return { category: "expired", diff };
  if (diff === 0) return { category: "today", diff };
  if (diff <= 3) return { category: "soon", diff };
  return { category: "ok", diff };
}

/** Vencido → vermelho; hoje → laranja; 1–3 dias → amarelo; em dia → verde. */
export function getDueDisplayMeta(row, dateToClient) {
  const { category, diff } = getDueCategory(row);
  if (category === "neutral") {
    return {
      category,
      tone: "neutral",
      dateLabel: "—",
      shortLabel: "",
      recurrence: row?.recurrence || "",
      tooltip: i18n.t("platform.companies.dueTooltipNoDate"),
      dueClassKey: "dueDateNeutral",
    };
  }
  const dateLabel = dateToClient(row.dueDate);
  const fullDateLine = moment(row.dueDate).isValid()
    ? moment(row.dueDate).format("dddd, DD/MM/YYYY")
    : dateLabel;
  let dueClassKey;
  let shortLabel;
  let tooltip;
  if (category === "expired") {
    dueClassKey = "dueDateExpired";
    const days = Math.abs(diff);
    shortLabel = i18n.t("platform.companies.dueShortExpired", { days });
    tooltip = i18n.t("platform.companies.dueTooltipFullExpired", {
      date: dateLabel,
      longDate: fullDateLine,
      days,
    });
  } else if (category === "today") {
    dueClassKey = "dueDateToday";
    shortLabel = i18n.t("platform.companies.dueShortToday");
    tooltip = i18n.t("platform.companies.dueTooltipFullToday", {
      date: dateLabel,
      longDate: fullDateLine,
    });
  } else if (category === "soon") {
    dueClassKey = "dueDateSoon";
    shortLabel = i18n.t("platform.companies.dueShortSoon", { days: diff });
    tooltip = i18n.t("platform.companies.dueTooltipFullSoon", {
      date: dateLabel,
      longDate: fullDateLine,
      days: diff,
    });
  } else {
    dueClassKey = "dueDateOk";
    shortLabel = i18n.t("platform.companies.dueShortOk");
    tooltip = i18n.t("platform.companies.dueTooltipFullOk", {
      date: dateLabel,
      longDate: fullDateLine,
      days: diff,
    });
  }
  return {
    category,
    tone: category,
    dateLabel,
    shortLabel,
    recurrence: row.recurrence || "",
    tooltip,
    dueClassKey,
  };
}

export function planNameForSort(row) {
  return row?.planId != null && row?.plan?.name ? String(row.plan.name) : "";
}

/** Ordenação: vencidos → hoje → próximos → em dia → sem data; desempate por dias e nome. */
export function comparePriorityDue(a, b) {
  const ca = getDueCategory(a);
  const cb = getDueCategory(b);
  const rank = (c) => {
    if (c.category === "expired") return 0;
    if (c.category === "today") return 1;
    if (c.category === "soon") return 2;
    if (c.category === "ok") return 3;
    return 4;
  };
  const ra = rank(ca);
  const rb = rank(cb);
  if (ra !== rb) return ra - rb;
  if (ca.category === "expired" && cb.category === "expired") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  if (ca.category === "soon" && cb.category === "soon") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  if (ca.category === "ok" && cb.category === "ok") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  const blockRank = (x) => (x.status === false ? 0 : 1);
  if (blockRank(a) !== blockRank(b)) return blockRank(a) - blockRank(b);
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

export function buildBillingReminderMessage(row, dateToClientFn) {
  const name = row?.name || i18n.t("platform.companies.billingMessageFallbackName");
  let dateStr = i18n.t("platform.companies.billingMessageNoDue");
  if (row?.dueDate && moment(row.dueDate).isValid()) {
    dateStr = dateToClientFn(row.dueDate);
  }
  const plan =
    row?.planId != null && row?.plan?.name
      ? row.plan.name
      : i18n.t("platform.companies.billingMessageNoPlan");
  const amount = formatBrlBrief(getCompanyEffectivePlanValue(row));
  return i18n.t("platform.companies.billingMessageTemplate", {
    name,
    date: dateStr,
    plan,
    amount,
  });
}

export function formatPlanValueDiscrete(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

export function digitsForWhatsApp(phone) {
  if (!phone || typeof phone !== "string") return "";
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d : "";
}

export function getFinanceStateLabel(category) {
  switch (category) {
    case "expired":
      return i18n.t("platform.companies.financeStateOverdue");
    case "today":
      return i18n.t("platform.companies.financeStateToday");
    case "soon":
      return i18n.t("platform.companies.financeStateSoon");
    case "ok":
      return i18n.t("platform.companies.financeStateOk");
    default:
      return i18n.t("platform.companies.financeStateNoDue");
  }
}

export function dueDateSortKey(row) {
  if (!row?.dueDate || !moment(row.dueDate).isValid()) return Number.POSITIVE_INFINITY;
  return moment(row.dueDate).startOf("day").valueOf();
}

export function compareByDueDateAsc(a, b) {
  const ka = dueDateSortKey(a);
  const kb = dueDateSortKey(b);
  if (ka !== kb) return ka - kb;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

export function compareByStatusBlockedFirst(a, b) {
  const ra = a.status === false ? 0 : 1;
  const rb = b.status === false ? 0 : 1;
  if (ra !== rb) return ra - rb;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

export function formatCompanyLogEntry(log, dateToClient, datetimeToClient) {
  const meta =
    log?.metadata && typeof log.metadata === "object" ? log.metadata : {};
  const actionKey = `platform.companies.companyLogActions.${log.action}`;
  let title = i18n.t(actionKey);
  if (title === actionKey) {
    title = log.action || "—";
  }
  let detail = "";
  switch (log.action) {
    case "renew":
      detail = i18n.t("platform.companies.logDetailRenew", {
        from: meta.previousDueDate ? dateToClient(meta.previousDueDate) : "—",
        to: meta.newDueDate ? dateToClient(meta.newDueDate) : "—",
      });
      break;
    case "block":
      detail = i18n.t("platform.companies.logDetailBlock");
      break;
    case "unblock":
      detail = i18n.t("platform.companies.logDetailUnblock");
      break;
    case "delete":
      detail = i18n.t("platform.companies.logDetailDelete", {
        name: meta.name != null ? String(meta.name) : "—",
      });
      break;
    case "warning_before_due":
      detail = i18n.t("platform.companies.logDetailWarningBefore", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysUntilDue != null ? String(meta.daysUntilDue) : "—",
      });
      break;
    case "warning_after_due":
      detail = i18n.t("platform.companies.logDetailWarningAfter", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysLate != null ? String(meta.daysLate) : "—",
      });
      break;
    case "auto_block":
      detail = i18n.t("platform.companies.logDetailAutoBlock", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysLate != null ? String(meta.daysLate) : "—",
      });
      break;
    case "auto_unblock_after_renew":
      detail = i18n.t("platform.companies.logDetailAutoUnblockAfterRenew", {
        from: meta.previousDueDate ? dateToClient(meta.previousDueDate) : "—",
        to: meta.newDueDate ? dateToClient(meta.newDueDate) : "—",
      });
      break;
    case "contracted_value_change":
      detail = i18n.t("platform.companies.logDetailContractedValueChange", {
        from:
          meta.previousValue != null
            ? formatPlanValueDiscrete(meta.previousValue)
            : i18n.t("platform.companies.contractedFallbackDefault"),
        to:
          meta.newValue != null
            ? formatPlanValueDiscrete(meta.newValue)
            : i18n.t("platform.companies.contractedFallbackDefault"),
        planBase: formatPlanValueDiscrete(meta.planValue ?? 0),
      });
      break;
    case "plan_change":
      detail = i18n.t("platform.companies.logDetailPlanChange", {
        from:
          meta.previousPlanId != null && meta.previousPlanId !== ""
            ? String(meta.previousPlanId)
            : "—",
        to:
          meta.newPlanId != null && meta.newPlanId !== ""
            ? String(meta.newPlanId)
            : "—",
      });
      break;
    default:
      detail = "";
  }
  const isAutomated = meta.kind === "automated";
  const actor =
    log.user && (log.user.name || log.user.email)
      ? i18n.t("platform.companies.logActor", {
          name: log.user.name || log.user.email,
        })
      : isAutomated
        ? i18n.t("platform.companies.logActorSystem")
        : "";
  let whatsappLine = "";
  if (meta.whatsapp && typeof meta.whatsapp === "object" && meta.whatsapp.channel === "whatsapp") {
    const w = meta.whatsapp;
    if (w.sent === true) {
      whatsappLine = i18n.t("platform.companies.logWhatsappSent", {
        last4: w.destinationLast4 != null ? String(w.destinationLast4) : "—",
      });
    } else if (w.attempted === true || w.error || w.skippedReason) {
      whatsappLine = i18n.t("platform.companies.logWhatsappNotSent", {
        reason: String(w.error || w.skippedReason || "—"),
      });
    }
  }
  const parts = [detail, actor, whatsappLine].filter(Boolean);
  return {
    whenLabel: datetimeToClient(log.createdAt),
    title,
    subtitle: parts.length ? parts.join(" · ") : "",
  };
}

export function campaignsLabelForRow(row) {
  if (has(row, "settings") && isArray(row.settings) && row.settings.length > 0) {
    const setting = row.settings.find((s) => s.key === "campaignsEnabled");
    if (setting) {
      return setting.value === "true"
        ? i18n.t("settings.company.form.enabled")
        : i18n.t("settings.company.form.disabled");
    }
  }
  return i18n.t("settings.company.form.disabled");
}

/* ------------------------------------------------------------------ */
/* Conversão empresa (API) ⇄ valores de formulário                     */
/* ------------------------------------------------------------------ */

/** Campos de cadastro (Fase 8.4) — todos opcionais / nullable no backend. */
export const COMPANY_REGISTRATION_FIELDS = [
  "tradeName",
  "legalName",
  "document",
  "addressZipCode",
  "addressStreet",
  "addressNumber",
  "addressComplement",
  "addressNeighborhood",
  "addressCity",
  "addressState",
];

/**
 * Converte o valor "GB" ou "R$" digitado (vírgula decimal) em número.
 * Retorna { ok: true, value: number|null } ou { ok: false }.
 */
export function parseOptionalDecimalInput(raw, parser) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  const n = parser(trimmed);
  if (n === null || Number.isNaN(n)) return { ok: false };
  return { ok: true, value: n };
}

/** Empresa (GET /companies/:id) → valores iniciais do formulário. */
export function companyToFormValues(company) {
  const c = company || {};
  const str = (v) => (v === undefined || v === null ? "" : String(v));
  let dueDate = "";
  if (typeof c.dueDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(c.dueDate)) {
    // Datas de domínio vêm como YYYY-MM-DD (ou ISO): não converter de fuso para não “voltar” um dia.
    dueDate = c.dueDate.slice(0, 10);
  } else if (c.dueDate && moment(c.dueDate).isValid()) {
    dueDate = moment(c.dueDate).format("YYYY-MM-DD");
  }
  let campaignsEnabled = false;
  const setting = (Array.isArray(c.settings) ? c.settings : []).find(
    (s) => s && typeof s.key === "string" && s.key.indexOf("campaignsEnabled") > -1
  );
  if (setting) campaignsEnabled = setting.value === "true" || setting.value === "enabled";
  return {
    name: str(c.name),
    email: str(c.email),
    phone: c.phone ? maskPhone(c.phone) : "",
    tradeName: str(c.tradeName),
    legalName: str(c.legalName),
    document: c.document ? maskCpfCnpj(c.document) : "",
    addressZipCode: c.addressZipCode ? maskCep(c.addressZipCode) : "",
    addressStreet: str(c.addressStreet),
    addressNumber: str(c.addressNumber),
    addressComplement: str(c.addressComplement),
    addressNeighborhood: str(c.addressNeighborhood),
    addressCity: str(c.addressCity),
    addressState: str(c.addressState).toUpperCase(),
    planId: c.planId != null ? c.planId : "",
    status: c.status === false ? false : true,
    campaignsEnabled,
    dueDate,
    recurrence: str(c.recurrence),
    timezone: c.timezone || "America/Sao_Paulo",
    contractedPlanValueStr:
      c.contractedPlanValue != null && c.contractedPlanValue !== ""
        ? formatPlanValueForInput(c.contractedPlanValue)
        : "",
    storageLimitGbStr: formatGbInputFromApi(c.storageLimitGb),
    storageUsedFormatted: c.storageUsedFormatted ?? null,
    storageLimitFormatted: c.storageLimitFormatted ?? null,
    modulePermissions: mergeModulePermissions(c.modulePermissions),
    businessSegment: c.businessSegment || "general",
    crmVisibilityMode: c.crmVisibilityMode || "all",
  };
}

const trimOrNull = (v) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

const NORMALIZERS = {
  name: (v) => String(v ?? "").trim(),
  email: (v) => String(v ?? "").trim(),
  phone: (v) => String(v ?? "").trim(),
  document: (v) => onlyDigits(v) || null,
  addressZipCode: (v) => onlyDigits(v) || null,
  addressState: (v) => String(v ?? "").trim().toUpperCase() || null,
  tradeName: trimOrNull,
  legalName: trimOrNull,
  addressStreet: trimOrNull,
  addressNumber: trimOrNull,
  addressComplement: trimOrNull,
  addressNeighborhood: trimOrNull,
  addressCity: trimOrNull,
};

/** Campos somente leitura do formulário (nunca enviados). */
const READ_ONLY_FORM_KEYS = ["storageUsedFormatted", "storageLimitFormatted"];

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Valores do formulário → payload do PUT/POST /companies.
 * - `initialValues`: quando informado, envia apenas campos alterados (não sobrescreve dados
 *   alterados por outras ações, como renovação, e mantém cadastros antigos salváveis).
 * - `isSuper`: só Super Admin envia valor contratado e limite de armazenamento.
 * Retorna { ok: true, payload } ou { ok: false, field, message }.
 */
export function buildCompanyPayload(values, { initialValues = null, isSuper = false } = {}) {
  const changed = (key) => !initialValues || !sameValue(values[key], initialValues[key]);
  const payload = {};

  Object.keys(values).forEach((key) => {
    if (READ_ONLY_FORM_KEYS.includes(key)) return;
    if (key === "contractedPlanValueStr" || key === "storageLimitGbStr") return;
    if (!changed(key)) return;
    payload[key] = values[key];
  });

  if (isSuper && changed("contractedPlanValueStr")) {
    const r = parseOptionalDecimalInput(values.contractedPlanValueStr, parseBrazilianCurrencyToNumber);
    if (!r.ok) {
      return {
        ok: false,
        field: "contractedPlanValueStr",
        message: i18n.t("settings.company.form.contractedPlanValueInvalid"),
      };
    }
    payload.contractedPlanValue = r.value;
  }
  if (isSuper && changed("storageLimitGbStr")) {
    const r = parseOptionalDecimalInput(values.storageLimitGbStr, parseBrazilianCurrencyToNumber);
    if (!r.ok) {
      return {
        ok: false,
        field: "storageLimitGbStr",
        message: i18n.t("platform.companies.storageLimitInvalid"),
      };
    }
    payload.storageLimitGb = r.value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
    if (payload.dueDate === "" || !moment(payload.dueDate).isValid()) payload.dueDate = null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "planId") && payload.planId === "") {
    payload.planId = null;
  }

  // Normalização dos campos de cadastro (Fase 8.4): documento e CEP só dígitos, vazio → null.
  // Campos cuja forma normalizada não mudou (ex.: só espaços) não são enviados.
  Object.keys(payload).forEach((key) => {
    if (!NORMALIZERS[key]) return;
    const next = NORMALIZERS[key](payload[key]);
    if (initialValues && sameValue(next, NORMALIZERS[key](initialValues[key]))) {
      delete payload[key];
      return;
    }
    payload[key] = next;
    if (key === "document") {
      payload.documentType = next ? validateDocument(next).type : null;
    }
  });

  return { ok: true, payload };
}
