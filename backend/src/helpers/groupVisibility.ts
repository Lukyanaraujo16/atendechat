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

export function isGroupVisibilityPrivileged(actor: GroupAccessActor): boolean {
  return (
    actor.profile === "admin" ||
    actor.profile === "supervisor" ||
    actor.supportMode === true
  );
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

export async function assertUserCanAccessGroupContact(
  contact: Contact,
  actor: GroupAccessActor
): Promise<void> {
  if (!contact.isGroup) return;
  if (Number(contact.companyId) !== Number(actor.companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (isGroupVisibilityPrivileged(actor)) return;

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
