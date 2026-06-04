import { Op, literal } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import {
  canUserAccessGroupContact,
  GroupAccessActor,
  isGroupVisibilityPrivileged,
  loadAuthorizedQueueIdsByContact,
  loadUserQueueIds
} from "../../helpers/groupVisibility";
import { canUserAccessTicketByWhatsapp } from "../../helpers/whatsappTicketVisibility";
import { ensureGroupContactDisplayName } from "../../helpers/groupContactName";

export type GroupsInboxAvailableItem = {
  type: "group";
  contactId: number;
  name: string;
  number: string;
  whatsappId: number | null;
  whatsappName: string | null;
  profilePicUrl: string | null;
  authorizedQueueIds: number[];
  hasTicket: false;
  updatedAt: string | null;
};

interface Request {
  companyId: number;
  actor: GroupAccessActor;
}

/**
 * Grupos autorizados para o utilizador que ainda não têm ticket open/pending.
 * A aba Atendimento → Grupos faz merge com GET /tickets?isGroup=true no frontend.
 */
const ListGroupsInboxService = async ({
  companyId,
  actor
}: Request): Promise<{ groups: GroupsInboxAvailableItem[] }> => {
  const privileged = isGroupVisibilityPrivileged(actor);
  const userQueueIds = privileged ? [] : await loadUserQueueIds(actor.id);

  const activeGroupTickets = await Ticket.findAll({
    where: {
      companyId,
      status: { [Op.in]: ["open", "pending"] },
      [Op.or]: [
        { isGroup: true },
        literal(`EXISTS (
          SELECT 1 FROM "Contacts" AS gc
          WHERE gc.id = "Ticket"."contactId"
            AND gc."companyId" = ${Number(companyId)}
            AND gc."isGroup" = true
        )`)
      ]
    },
    attributes: ["contactId"],
    raw: true
  });

  const excludedContactIds = [
    ...new Set(
      activeGroupTickets
        .map((t) => Number((t as { contactId?: number }).contactId))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  ];

  const contactWhere: Record<string, unknown> = {
    companyId,
    isGroup: true,
    groupVisible: true
  };

  if (excludedContactIds.length > 0) {
    contactWhere.id = { [Op.notIn]: excludedContactIds };
  }

  const contacts = await Contact.findAll({
    where: contactWhere,
    attributes: [
      "id",
      "name",
      "number",
      "profilePicUrl",
      "whatsappId",
      "updatedAt",
      "groupVisible",
      "isGroup"
    ],
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "ticketVisibility"],
        required: false
      }
    ],
    order: [["updatedAt", "DESC"]]
  });

  if (!contacts.length) {
    return { groups: [] };
  }

  const contactIds = contacts.map((c) => c.id);
  const authorizedMap = await loadAuthorizedQueueIdsByContact(
    contactIds,
    companyId
  );

  const groups: GroupsInboxAvailableItem[] = [];

  for (const contact of contacts) {
    const authorizedQueueIds = authorizedMap.get(contact.id) || [];

    if (
      !canUserAccessGroupContact(
        contact,
        authorizedQueueIds,
        userQueueIds,
        privileged
      )
    ) {
      continue;
    }

    const whatsapp = contact.whatsapp as Whatsapp | undefined;
    if (
      whatsapp?.id &&
      !canUserAccessTicketByWhatsapp(whatsapp.ticketVisibility, actor)
    ) {
      continue;
    }

    const displayName = await ensureGroupContactDisplayName(contact, {
      whatsappId: contact.whatsappId ?? whatsapp?.id ?? null
    });

    groups.push({
      type: "group",
      contactId: contact.id,
      name: displayName || contact.number || "",
      number: contact.number,
      whatsappId: contact.whatsappId ?? whatsapp?.id ?? null,
      whatsappName: whatsapp?.name ?? null,
      profilePicUrl: contact.profilePicUrl || null,
      authorizedQueueIds,
      hasTicket: false,
      updatedAt: contact.updatedAt
        ? new Date(contact.updatedAt).toISOString()
        : null
    });
  }

  return { groups };
};

export default ListGroupsInboxService;
