import {
  GROUP_PARTICIPANT_PHONE_AVAILABLE,
  type NormalizedGroupParticipant
} from "../../helpers/groupParticipantFromMetadata";

const CSV_SEPARATOR = ";";
const UTF8_BOM = "\uFEFF";

export const EXPORT_STATUS_AVAILABLE = "Telefone disponível";
export const EXPORT_STATUS_UNAVAILABLE =
  "Telefone não disponibilizado pelo WhatsApp";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeCsvFormula(value: string): string {
  if (!value) return value;
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvCell(value: string | null | undefined): string {
  const text = neutralizeCsvFormula(String(value ?? ""));
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildGroupParticipantsCsv(
  participants: NormalizedGroupParticipant[]
): string {
  const header = ["Nome", "Telefone", "Status"];
  const rows = participants.map(participant => {
    const available =
      participant.status === GROUP_PARTICIPANT_PHONE_AVAILABLE &&
      Boolean(participant.phone);
    return [
      participant.displayName,
      available ? participant.phone : "",
      available ? EXPORT_STATUS_AVAILABLE : EXPORT_STATUS_UNAVAILABLE
    ];
  });

  const lines = [header, ...rows]
    .map(row => row.map(escapeCsvCell).join(CSV_SEPARATOR))
    .join("\r\n");

  return `${UTF8_BOM}${lines}`;
}

export function buildGroupParticipantsExportFilename(groupSubject: string): string {
  const slug = String(groupSubject || "grupo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .toLowerCase();
  const safe = slug || "grupo";
  const stamp = new Date().toISOString().slice(0, 10);
  return `participantes-${safe}-${stamp}.csv`;
}
