import moment from "moment-timezone";

export const DEFAULT_SAAS_TIMEZONE = "America/Sao_Paulo";

/**
 * Offset da sessão do Sequelize (`timezone` em config/database.ts). Datas de vencimento são gravadas como
 * "YYYY-MM-DD" em colunas timestamptz e o Postgres as interpreta como meia-noite NESTE offset — por isso
 * a leitura de volta para data de domínio usa o mesmo offset, não o fuso da empresa (senão empresas a
 * oeste de Brasília perderiam 1 dia a cada leitura/renovação).
 */
export const DB_STORAGE_UTC_OFFSET = "-03:00";

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveSaasTimezone(timezone?: string | null): string {
  const tz = timezone?.trim();
  return tz && moment.tz.zone(tz) ? tz : DEFAULT_SAAS_TIMEZONE;
}

/**
 * Normaliza uma data de vencimento para o formato de domínio `YYYY-MM-DD`.
 *
 * `Companies.dueDate` é `timestamptz`: o driver `pg` devolve um `Date` em runtime, apesar de o
 * model declarar `string`. Faturas legadas guardam ISO com offset ("2026-10-01T00:00:00-03:00").
 * Valores com horário (Date/ISO) são convertidos no offset de armazenamento do banco
 * (`DB_STORAGE_UTC_OFFSET`), o mesmo usado na gravação — o calendário gravado é preservado para
 * empresas de qualquer fuso. `timezone` é mantido por compatibilidade de assinatura; o fuso da
 * empresa vale para "hoje" (`todayDomainDate`), não para reinterpretar datas gravadas.
 * Aceita Date, ISO, `YYYY-MM-DD` ou vazio (→ null). Valor inválido → null.
 */
export function toDomainDate(
  value: Date | string | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  timezone?: string | null
): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return moment(value).utcOffset(DB_STORAGE_UTC_OFFSET).format("YYYY-MM-DD");
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (DOMAIN_DATE_RE.test(raw)) {
    return moment(raw, "YYYY-MM-DD", true).isValid() ? raw : null;
  }

  // ISO sem offset: data/hora "de parede" — a data é a que está escrita.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const local = moment(raw, moment.ISO_8601, true);
    return local.isValid() ? local.format("YYYY-MM-DD") : null;
  }

  const parsed = moment.parseZone(raw, moment.ISO_8601);
  if (!parsed.isValid()) return null;
  return parsed.utcOffset(DB_STORAGE_UTC_OFFSET).format("YYYY-MM-DD");
}

/**
 * Dia, no fuso da empresa, em que um INSTANTE real aconteceu (createdAt, paidAt confirmado pelo gateway…).
 * Diferente de `toDomainDate`, que lê datas de calendário GRAVADAS (vencimentos) no offset de armazenamento.
 */
export function instantToDomainDate(
  value: Date | string | null | undefined,
  timezone?: string | null
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const tz = resolveSaasTimezone(timezone);
  const m = value instanceof Date ? moment(value) : moment(String(value), moment.ISO_8601);
  if (!m.isValid()) return null;
  return m.tz(tz).format("YYYY-MM-DD");
}

/** Hoje (início do dia) no fuso da empresa, em `YYYY-MM-DD`. */
export function todayDomainDate(timezone?: string | null): string {
  return moment.tz(resolveSaasTimezone(timezone)).format("YYYY-MM-DD");
}
