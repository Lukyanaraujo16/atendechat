import Contact from "../models/Contact";
import { getWbot } from "../libs/wbot";
import type { WASocket } from "@whiskeysockets/baileys";

export function groupJidFromDigits(digits: string): string {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  return d.includes("@g.us") ? d : `${d}@g.us`;
}

/** Nome ainda é placeholder (vazio ou igual ao number/JID). */
export function contactNeedsGroupNameResolution(
  contact: Pick<Contact, "name" | "number" | "isGroup">
): boolean {
  if (contact.isGroup !== true) return false;
  const num = String(contact.number || "").replace(/\D/g, "").trim();
  const name = String(contact.name || "").trim();
  if (!name) return true;
  if (!num) return false;
  const nameDigits = name.replace(/\D/g, "");
  if (name === num || nameDigits === num) return true;
  return false;
}

export async function fetchGroupSubjectFromWbot(
  wbot: WASocket,
  digits: string
): Promise<string | null> {
  const jid = groupJidFromDigits(digits);
  if (!jid) return null;
  try {
    const meta = await wbot.groupMetadata(jid);
    const subject = String(meta?.subject || "").trim();
    return subject || null;
  } catch {
    return null;
  }
}

/**
 * Garante Contact.name com subject do WhatsApp quando ainda é placeholder numérico.
 * Persiste no banco se encontrar subject; senão mantém number como fallback.
 */
export async function ensureGroupContactDisplayName(
  contact: Contact,
  options?: {
    wbot?: WASocket;
    whatsappId?: number | null;
    subjectHint?: string | null;
  }
): Promise<string> {
  const fallback = String(contact.number || "").trim();

  if (!contactNeedsGroupNameResolution(contact)) {
    return String(contact.name || fallback);
  }

  let subject = String(options?.subjectHint || "").trim();

  if (!subject && options?.wbot) {
    subject = (await fetchGroupSubjectFromWbot(options.wbot, contact.number)) || "";
  }

  if (!subject && options?.whatsappId) {
    try {
      const wbot = getWbot(Number(options.whatsappId));
      subject = (await fetchGroupSubjectFromWbot(wbot, contact.number)) || "";
    } catch {
      // sessão offline ou sem acesso ao grupo
    }
  }

  const displayName = subject || fallback;

  if (subject && subject !== contact.name) {
    await contact.update({ name: subject });
  }

  return displayName;
}
