import { Op, literal, WhereOptions } from "sequelize";
import Contact from "../models/Contact";
import ContactQueueVisibility from "../models/ContactQueueVisibility";
import Queue from "../models/Queue";
import User from "../models/User";
import AppError from "../errors/AppError";

export type GroupAccessActor = {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
  companyId: number;
};

/** JWT/JSON podem enviar supportMode como boolean, 1 ou "true". */
export function isTruthySupportMode(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isGroupVisibilityPrivileged(actor: GroupAccessActor): boolean {
  return (
    actor.profile === "admin" ||
    actor.profile === "supervisor" ||
    isTruthySupportMode(actor.supportMode as unknown)
  );
}

async function resolveContactCompanyId(contact: Contact): Promise<number | null> {
  const raw = contact.companyId;
  if (raw != null && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  if (!contact.id) return null;
  const row = await Contact.findByPk(contact.id, {
    attributes: ["companyId"]
  });
  if (row?.companyId == null || !Number.isFinite(Number(row.companyId))) {
    return null;
  }
  return Number(row.companyId);
}

export async function loadUserQueueIds(userId: string | number): Promise<number[]> {
  const user = await User.findByPk(userId, {
    attributes: ["id"],
    include: [{ model: Queue, as: "queues", attributes: ["id"] }]
  });
  if (!user?.queues?.length) return [];
  return user.queues.map((q) => q.id);
}

export async function loadAuthorizedQueueIdsByContact(
  contactIds: number[],
  companyId: number
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  const unique = [...new Set(contactIds.filter((id) => Number.isFinite(id)))];
  if (!unique.length) return map;

  const rows = await ContactQueueVisibility.findAll({
    where: { companyId, contactId: { [Op.in]: unique } },
    attributes: ["contactId", "queueId"]
  });

  for (const row of rows) {
    const cid = row.contactId;
    const list = map.get(cid) || [];
    list.push(row.queueId);
    map.set(cid, list);
  }
  return map;
}

export async function loadAuthorizedQueuesForContact(
  contactId: number,
  companyId: number
): Promise<Queue[]> {
  const rows = await ContactQueueVisibility.findAll({
    where: { companyId, contactId },
    include: [
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color", "companyId"]
      }
    ]
  });
  return rows
    .map((r) => r.queue)
    .filter((q): q is Queue => Boolean(q) && q.companyId === companyId);
}

/**
 * Regra de compatibilidade:
 * - groupVisible=false → bloqueado (não privilegiado)
 * - groupVisible=true sem filas vinculadas → permitido
 * - groupVisible=true com filas → interseção com filas do utilizador
 */
export function canUserAccessGroupContact(
  contact: Pick<Contact, "isGroup" | "groupVisible">,
  authorizedQueueIds: number[],
  userQueueIds: number[],
  privileged: boolean
): boolean {
  if (privileged) return true;
  if (!contact.isGroup) return true;
  if (contact.groupVisible !== true) return false;
  if (!authorizedQueueIds.length) return true;
  const userSet = new Set(userQueueIds);
  return authorizedQueueIds.some((qid) => userSet.has(qid));
}

/** Mesma regra da UI de gestão de grupos: admin, supervisor ou modo suporte. */
export function assertCanManageGroupParticipants(actor: GroupAccessActor): void {
  if (!isGroupVisibilityPrivileged(actor)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}

/**
 * Fail-closed para preview/export/import: sem Contact do grupo, perfil
 * não privilegiado não acessa JID arbitrário da sessão.
 */
export async function assertGroupParticipantsVisibility(actor: GroupAccessActor, groupContact: Contact | null): Promise<void> {
  if (isGroupVisibilityPrivileged(actor)) {
    if (groupContact) {
      await assertUserCanAccessGroupContact(groupContact, actor);
    }
    return;
  }

  if (!groupContact) {
    throw new AppError("ERR_GROUP_NOT_VISIBLE", 403);
  }

  await assertUserCanAccessGroupContact(groupContact, actor);
}

export async function assertUserCanAccessGroupContact(
  contact: Contact,
  actor: GroupAccessActor
): Promise<void> {
  if (!contact.isGroup) return;

  /** Admin/supervisor/suporte: sem filtro de setor (companyId do contact pode vir ausente no include). */
  if (isGroupVisibilityPrivileged(actor)) {
    return;
  }

  const contactCompanyId = await resolveContactCompanyId(contact);
  if (
    contactCompanyId == null ||
    Number(contactCompanyId) !== Number(actor.companyId)
  ) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const authorized = await loadAuthorizedQueueIdsByContact(
    [contact.id],
    actor.companyId
  );
  const userQueueIds = await loadUserQueueIds(actor.id);

  if (
    !canUserAccessGroupContact(
      contact,
      authorized.get(contact.id) || [],
      userQueueIds,
      false
    )
  ) {
    throw new AppError("ERR_GROUP_NOT_VISIBLE", 403);
  }
}

/**
 * Filtro Sequelize no include Contact (listagens de tickets / contatos).
 */
export function buildGroupContactVisibilityWhere(
  actor: GroupAccessActor,
  userQueueIds: number[]
): WhereOptions {
  if (isGroupVisibilityPrivileged(actor)) {
    return {};
  }

  const uid = Number(actor.id);
  const queueList =
    userQueueIds.length > 0
      ? userQueueIds.join(",")
      : "-1";

  const unrestrictedOrAllowed = literal(`(
    "contact"."isGroup" = false
    OR (
      "contact"."isGroup" = true
      AND "contact"."groupVisible" = true
      AND (
        NOT EXISTS (
          SELECT 1 FROM "ContactQueueVisibility" AS cqv
          WHERE cqv."contactId" = "contact"."id"
            AND cqv."companyId" = ${Number(actor.companyId)}
        )
        OR EXISTS (
          SELECT 1 FROM "ContactQueueVisibility" AS cqv
          WHERE cqv."contactId" = "contact"."id"
            AND cqv."companyId" = ${Number(actor.companyId)}
            AND cqv."queueId" IN (${queueList})
        )
      )
    )
  )`);

  return unrestrictedOrAllowed;
}

export async function filterGroupRowsForUser<T extends {
  contactId?: number | null;
  groupVisible?: boolean;
}>(
  rows: T[],
  actor: GroupAccessActor
): Promise<T[]> {
  if (isGroupVisibilityPrivileged(actor)) return rows;

  const contactIds = rows
    .map((r) => r.contactId)
    .filter((id): id is number => id != null && Number.isFinite(Number(id)))
    .map(Number);

  const authorizedMap = await loadAuthorizedQueueIdsByContact(
    contactIds,
    actor.companyId
  );
  const userQueueIds = await loadUserQueueIds(actor.id);

  return rows.filter((row) => {
    if (row.groupVisible !== true) return false;
    const cid = row.contactId;
    if (!cid) return false;
    const authorized = authorizedMap.get(cid) || [];
    return canUserAccessGroupContact(
      { isGroup: true, groupVisible: true } as Contact,
      authorized,
      userQueueIds,
      false
    );
  });
}
