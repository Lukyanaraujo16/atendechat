import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from "date-fns";
import { enUS, ptBR, es } from "date-fns/locale";
import { i18n } from "../translate/i18n";

function pickLocale() {
  const lang = (i18n.language || "pt").split("-")[0];
  if (lang === "en") return enUS;
  if (lang === "es") return es;
  return ptBR;
}

/**
 * Tempo relativo curto: hoje com distância; ontem etiqueta; caso contrário data curta.
 */
export function formatNotificationTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = pickLocale();
  if (isToday(d)) {
    return formatDistanceToNow(d, { addSuffix: true, locale: loc });
  }
  if (isYesterday(d)) {
    return i18n.t("userNotificationCenter.yesterday");
  }
  return format(d, "P", { locale: loc });
}
