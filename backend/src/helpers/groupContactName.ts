import Contact from "../models/Contact";
import type { WhatsAppGroupsProvider } from "../modules/whatsapp/groups/WhatsAppGroupsProvider";

export function groupJidFromDigits(digits: string): string {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  return d.includes("@g.us") ? d : `${d}@g.us`;
}

export function createFetchRemoteSubjectFromProvider(
  provider: WhatsAppGroupsProvider
): (digits: string) => Promise<string | null> {
  return async (digits: string): Promise<string | null> => {
    const jid = groupJidFromDigits(digits);
    if (!jid) return null;
    try {
      const meta = await provider.getGroupMetadata(jid);
      const subject = String(meta.subject || "").trim();
      return subject || null;
    } catch {
      return null;
    }
  };
}

/** Nome ainda é placeholder (vazio ou igual ao number/JID). */
export function contactNeedsGroupNameResolution(
  contact: Pick<Contact, "name" | "number" | "isGroup">
): boolean {
  if (contact.isGroup !== true) return false;
  const num = String(contact.number || "")
    .replace(/\D/g, "")
    .trim();
  const name = String(contact.name || "").trim();
  if (!name) return true;
  if (!num) return false;
  const nameDigits = name.replace(/\D/g, "");
  if (name === num || nameDigits === num) return true;
  return false;
}

/**
 * Garante Contact.name com subject quando ainda é placeholder numérico.
 * Resolução remota só via callback — nunca getWbot escondido (Evolution-safe).
 */
export async function ensureGroupContactDisplayName(
  contact: Contact,
  options?: {
    subjectHint?: string | null;
    fetchRemoteSubject?: (digits: string) => Promise<string | null>;
  }
): Promise<string> {
  const fallback = String(contact.number || "").trim();

  if (!contactNeedsGroupNameResolution(contact)) {
    return String(contact.name || fallback);
  }

  let subject = String(options?.subjectHint || "").trim();

  if (!subject && options?.fetchRemoteSubject) {
    try {
      subject =
        (await options.fetchRemoteSubject(String(contact.number || ""))) || "";
    } catch {
      subject = "";
    }
  }

  const displayName = subject || fallback;

  if (subject && subject !== contact.name) {
    await contact.update({ name: subject });
  }

  return displayName;
}
