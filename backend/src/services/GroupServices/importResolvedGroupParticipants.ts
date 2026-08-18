import AppError from "../../errors/AppError";
import {
  uniqueResolvedPhones,
  type NormalizedGroupParticipant
} from "../../helpers/groupParticipantFromMetadata";

/** Limite explícito por request (teto de participantes de um grupo WhatsApp). */
export const GROUP_IMPORT_MAX_NEW_CONTACTS = 1024;

/** Concorrência limitada para não saturar o banco nem a conexão. */
export const GROUP_IMPORT_CONCURRENCY = 5;

export type GroupImportParticipantsResult = {
  imported: number;
  skippedExisting: number;
  skippedNoPhone: number;
  failed: number;
  skippedLimit: number;
  importableCount: number;
};

type CreateGroupParticipantContact = (params: {
  name: string;
  number: string;
  companyId: number;
  creatorUserId?: number;
}) => Promise<unknown>;

export function isDuplicateContactError(err: unknown): boolean {
  if (err instanceof AppError && err.message === "ERR_DUPLICATED_CONTACT") {
    return true;
  }
  if (!err || typeof err !== "object") return false;
  const anyErr = err as {
    name?: string;
    parent?: { code?: string };
    original?: { code?: string };
  };
  if (anyErr.name === "SequelizeUniqueConstraintError") return true;
  const code = anyErr.parent?.code || anyErr.original?.code;
  return code === "ER_DUP_ENTRY" || code === "23505";
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  const n = Math.min(Math.max(1, concurrency), items.length);

  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  };

  await Promise.all(Array.from({ length: n }, () => run()));
}

export async function importResolvedGroupParticipants({
  companyId,
  userId,
  participants,
  existingPhones,
  createContact,
  concurrency = GROUP_IMPORT_CONCURRENCY,
  maxNewContacts = GROUP_IMPORT_MAX_NEW_CONTACTS
}: {
  companyId: number;
  userId: number;
  participants: NormalizedGroupParticipant[];
  existingPhones: Set<string>;
  createContact: CreateGroupParticipantContact;
  concurrency?: number;
  maxNewContacts?: number;
}): Promise<GroupImportParticipantsResult> {
  const skippedNoPhone = participants.filter(p => !p.phone).length;
  const uniquePhones = uniqueResolvedPhones(participants);
  const nameByPhone = new Map<string, string>();

  for (const participant of participants) {
    if (!participant.phone) continue;
    if (!nameByPhone.has(participant.phone) && participant.displayName) {
      nameByPhone.set(participant.phone, participant.displayName);
    }
  }

  const alreadyKnown = uniquePhones.filter(phone => existingPhones.has(phone));
  const newPhones = uniquePhones.filter(phone => !existingPhones.has(phone));
  const toCreate = newPhones.slice(0, maxNewContacts);
  const skippedLimit = newPhones.length - toCreate.length;

  let imported = 0;
  let skippedExisting = alreadyKnown.length;
  let failed = 0;

  await runWithConcurrency(toCreate, concurrency, async phone => {
    const name = nameByPhone.get(phone) || phone;
    try {
      await createContact({
        name,
        number: phone,
        companyId,
        creatorUserId: userId
      });
      existingPhones.add(phone);
      imported += 1;
    } catch (err) {
      if (isDuplicateContactError(err)) {
        existingPhones.add(phone);
        skippedExisting += 1;
        return;
      }
      failed += 1;
    }
  });

  return {
    imported,
    skippedExisting,
    skippedNoPhone,
    failed,
    skippedLimit,
    importableCount: imported
  };
}
