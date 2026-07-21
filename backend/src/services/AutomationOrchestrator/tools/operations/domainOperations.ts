import { Op } from "sequelize";
import Contact from "../../../../models/Contact";
import Ticket from "../../../../models/Ticket";
import Tag from "../../../../models/Tag";
import Queue from "../../../../models/Queue";
import User from "../../../../models/User";
import TicketTag from "../../../../models/TicketTag";
import TicketNote from "../../../../models/TicketNote";
import {
  CONTACT_ALLOWED_UPDATE_FIELDS,
  ContactAllowedUpdateField
} from "../../../../config/automationOperationConstants";
import {
  defineOperation,
  OperationSnapshot
} from "./contracts/OperationContract";

function nowIso(): string {
  return new Date().toISOString();
}

function pickAllowedContactFields(
  input: Record<string, unknown>
): Partial<Record<ContactAllowedUpdateField, string | null>> {
  const out: Partial<Record<ContactAllowedUpdateField, string | null>> = {};
  for (const key of CONTACT_ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const v = input[key];
      if (v === null) out[key] = null;
      else if (v !== undefined) out[key] = String(v).slice(0, 2000);
    }
  }
  return out;
}

export const ContactUpdateAllowedFieldsOperation = defineOperation(
  {
    id: "contact.update_allowed_fields",
    name: "contact.update_allowed_fields",
    description: "Atualiza apenas campos autorizados do contato (name/email/notes).",
    risk: "low",
    sideEffect: "database_write",
    resourceTypes: ["contact"],
    supportsRollback: false,
    requiresConfirmation: false,
    requiredPermissions: ["aiTools.executeWrite"]
  },
  {
    validate: (_ctx, input) => {
      const contactId = Number(input.contactId);
      if (!Number.isFinite(contactId) || contactId < 1) {
        throw new Error("OPERATION_VALIDATION: contactId_required");
      }
      const fields = pickAllowedContactFields(
        (input.fields as Record<string, unknown>) || input
      );
      if (!Object.keys(fields).length) {
        throw new Error("OPERATION_VALIDATION: no_allowed_fields");
      }
      for (const key of Object.keys((input.fields as object) || input)) {
        if (
          [
            "contactId",
            "fields",
            "dryRun",
            "previewOnly",
            "confirmed",
            "execute"
          ].includes(key)
        ) {
          continue;
        }
        if (
          input.fields &&
          !CONTACT_ALLOWED_UPDATE_FIELDS.includes(key as ContactAllowedUpdateField)
        ) {
          throw new Error(`OPERATION_VALIDATION: field_not_allowed:${key}`);
        }
        if (
          !input.fields &&
          !CONTACT_ALLOWED_UPDATE_FIELDS.includes(key as ContactAllowedUpdateField)
        ) {
          // chaves extras no root (não em fields) são ignoradas se não forem allowlisted
          continue;
        }
      }
    },
    preview: async (ctx, input) => {
      const contactId = Number(input.contactId);
      const contact = await Contact.findOne({
        where: { id: contactId, companyId: ctx.toolCtx.companyId },
        attributes: ["id", "name", "email", "notes"]
      });
      if (!contact) {
        return {
          operationId: "contact.update_allowed_fields",
          summary: "contact_not_found",
          current: {},
          proposed: {},
          validations: [],
          warnings: [],
          affectedResources: [],
          blockers: ["contact_not_found"],
          dryRunCapable: true
        };
      }
      const fields = pickAllowedContactFields(
        (input.fields as Record<string, unknown>) || input
      );
      return {
        operationId: "contact.update_allowed_fields",
        summary: `update_contact:${contact.name}`,
        current: {
          name: contact.name,
          email: contact.email,
          notes: contact.notes ? String(contact.notes).slice(0, 200) : null
        },
        proposed: { [String(contact.id)]: fields, ...fields },
        validations: ["allowed_fields_only", "tenant_ok"],
        warnings: [],
        affectedResources: [
          { type: "contact", id: contact.id, label: contact.name }
        ],
        blockers: [],
        dryRunCapable: true
      };
    },
    captureBefore: async (ctx, input) => {
      const contact = await Contact.findOne({
        where: {
          id: Number(input.contactId),
          companyId: ctx.toolCtx.companyId
        },
        attributes: ["id", "name", "email", "notes"]
      });
      if (!contact) return [];
      return [
        {
          resourceType: "contact",
          resourceId: contact.id,
          fields: {
            name: contact.name,
            email: contact.email,
            notes: contact.notes
          },
          capturedAt: nowIso()
        }
      ];
    },
    execute: async (ctx, input) => {
      const fields = pickAllowedContactFields(
        (input.fields as Record<string, unknown>) || input
      );
      const { default: UpdateContactService } = await import(
        "../../../ContactServices/UpdateContactService"
      );
      const updated = await UpdateContactService({
        companyId: ctx.toolCtx.companyId,
        contactId: String(input.contactId),
        contactData: fields
      });
      const after: OperationSnapshot[] = [
        {
          resourceType: "contact",
          resourceId: updated.id,
          fields: {
            name: updated.name,
            email: updated.email,
            notes: updated.notes
          },
          capturedAt: nowIso()
        }
      ];
      return {
        data: {
          contactId: updated.id,
          updatedFields: Object.keys(fields)
        },
        afterSnapshots: after
      };
    }
  }
);

export const AddContactTagOperation = defineOperation(
  {
    id: "add.contact.tag",
    name: "add.contact.tag",
    description: "Associa tag ao ticket mais recente do contato.",
    risk: "low",
    sideEffect: "database_write",
    resourceTypes: ["contact", "tag", "ticket"],
    supportsRollback: true,
    requiresConfirmation: false,
    requiredPermissions: ["aiTools.executeWrite"]
  },
  {
    validate: (_ctx, input) => {
      if (!Number(input.contactId) || !Number(input.tagId)) {
        throw new Error("OPERATION_VALIDATION: contactId_and_tagId_required");
      }
    },
    preview: async (ctx, input) => {
      const contactId = Number(input.contactId);
      const tagId = Number(input.tagId);
      const companyId = ctx.toolCtx.companyId;
      const [contact, tag, ticket] = await Promise.all([
        Contact.findOne({
          where: { id: contactId, companyId },
          attributes: ["id", "name"]
        }),
        Tag.findOne({
          where: { id: tagId, companyId },
          attributes: ["id", "name", "color"]
        }),
        Ticket.findOne({
          where: { contactId, companyId },
          order: [["updatedAt", "DESC"]],
          attributes: ["id"]
        })
      ]);
      const blockers: string[] = [];
      if (!contact) blockers.push("contact_not_found");
      if (!tag) blockers.push("tag_not_found");
      if (!ticket) blockers.push("no_ticket_for_contact");

      let already = false;
      if (ticket && tag) {
        const existing = await TicketTag.findOne({
          where: { ticketId: ticket.id, tagId: tag.id }
        });
        already = Boolean(existing);
      }

      return {
        operationId: "add.contact.tag",
        summary: already
          ? "tag_already_exists"
          : `add_tag:${tag?.name || tagId}`,
        current: { hasTag: already, ticketId: ticket?.id || null },
        proposed: {
          tagId,
          tagName: tag?.name,
          contactId,
          ticketId: ticket?.id
        },
        validations: ["tenant_ok"],
        warnings: already ? ["tag_already_exists"] : [],
        affectedResources: [
          ...(contact
            ? [{ type: "contact" as const, id: contact.id, label: contact.name }]
            : []),
          ...(tag
            ? [{ type: "tag" as const, id: tag.id, label: tag.name }]
            : []),
          ...(ticket ? [{ type: "ticket" as const, id: ticket.id }] : [])
        ],
        blockers,
        dryRunCapable: true
      };
    },
    captureBefore: async (ctx, input) => {
      const companyId = ctx.toolCtx.companyId;
      const contactId = Number(input.contactId);
      const tagId = Number(input.tagId);
      const ticket = await Ticket.findOne({
        where: { contactId, companyId },
        order: [["updatedAt", "DESC"]],
        attributes: ["id"]
      });
      const existing = ticket
        ? await TicketTag.findOne({
            where: { ticketId: ticket.id, tagId }
          })
        : null;
      return [
        {
          resourceType: "tag",
          resourceId: tagId,
          fields: {
            contactId,
            ticketId: ticket?.id || null,
            linked: Boolean(existing)
          },
          capturedAt: nowIso()
        }
      ];
    },
    detectConflict: async (_ctx, _input, before) => {
      if (before[0]?.fields?.linked === true) {
        return {
          code: "CONFLICT",
          type: "conflict",
          message: "tag_already_exists",
          retryable: false
        };
      }
      return null;
    },
    execute: async (ctx, input) => {
      const { default: AddTagToContactService } = await import(
        "../../../ContactServices/AddTagToContactService"
      );
      const row = await AddTagToContactService({
        companyId: ctx.toolCtx.companyId,
        contactId: Number(input.contactId),
        tagId: Number(input.tagId)
      });
      return {
        data: { ticketId: row.ticketId, tagId: row.tagId },
        afterSnapshots: [
          {
            resourceType: "tag",
            resourceId: row.tagId,
            fields: {
              contactId: Number(input.contactId),
              ticketId: row.ticketId,
              linked: true
            },
            capturedAt: nowIso()
          }
        ]
      };
    },
    rollback: async (ctx, input) => {
      const { default: RemoveTagFromContactService } = await import(
        "../../../ContactServices/RemoveTagFromContactService"
      );
      await RemoveTagFromContactService({
        companyId: ctx.toolCtx.companyId,
        contactId: Number(input.contactId),
        tagId: Number(input.tagId)
      });
    }
  }
);

export const RemoveContactTagOperation = defineOperation(
  {
    id: "remove.contact.tag",
    name: "remove.contact.tag",
    description: "Remove tag de todos os tickets do contato.",
    risk: "low",
    sideEffect: "database_write",
    resourceTypes: ["contact", "tag"],
    supportsRollback: false,
    requiresConfirmation: false,
    requiredPermissions: ["aiTools.executeWrite"]
  },
  {
    validate: (_ctx, input) => {
      if (!Number(input.contactId) || !Number(input.tagId)) {
        throw new Error("OPERATION_VALIDATION: contactId_and_tagId_required");
      }
    },
    preview: async (ctx, input) => {
      const companyId = ctx.toolCtx.companyId;
      const contactId = Number(input.contactId);
      const tagId = Number(input.tagId);
      const [contact, tag, tickets] = await Promise.all([
        Contact.findOne({
          where: { id: contactId, companyId },
          attributes: ["id", "name"]
        }),
        Tag.findOne({
          where: { id: tagId, companyId },
          attributes: ["id", "name"]
        }),
        Ticket.findAll({
          where: { contactId, companyId },
          attributes: ["id"]
        })
      ]);
      const blockers: string[] = [];
      if (!contact) blockers.push("contact_not_found");
      if (!tag) blockers.push("tag_not_found");
      if (!tickets.length) blockers.push("no_ticket_for_contact");

      let linked = 0;
      if (tickets.length && tag) {
        linked = await TicketTag.count({
          where: {
            tagId,
            ticketId: { [Op.in]: tickets.map(t => t.id) }
          }
        });
      }
      if (!blockers.length && linked === 0) {
        blockers.push("tag_not_found_on_contact");
      }

      return {
        operationId: "remove.contact.tag",
        summary: `remove_tag:${tag?.name || tagId}`,
        current: { linkedCount: linked },
        proposed: { tagId, contactId, removeFromTickets: tickets.length },
        validations: ["tenant_ok"],
        warnings: [],
        affectedResources: [
          ...(contact
            ? [{ type: "contact" as const, id: contact.id, label: contact.name }]
            : []),
          ...(tag
            ? [{ type: "tag" as const, id: tag.id, label: tag.name }]
            : [])
        ],
        blockers,
        dryRunCapable: true
      };
    },
    captureBefore: async (ctx, input) => {
      const companyId = ctx.toolCtx.companyId;
      const contactId = Number(input.contactId);
      const tagId = Number(input.tagId);
      const tickets = await Ticket.findAll({
        where: { contactId, companyId },
        attributes: ["id"]
      });
      const linked = tickets.length
        ? await TicketTag.count({
            where: {
              tagId,
              ticketId: { [Op.in]: tickets.map(t => t.id) }
            }
          })
        : 0;
      return [
        {
          resourceType: "tag",
          resourceId: tagId,
          fields: { contactId, linkedCount: linked },
          capturedAt: nowIso()
        }
      ];
    },
    execute: async (ctx, input) => {
      const { default: RemoveTagFromContactService } = await import(
        "../../../ContactServices/RemoveTagFromContactService"
      );
      await RemoveTagFromContactService({
        companyId: ctx.toolCtx.companyId,
        contactId: Number(input.contactId),
        tagId: Number(input.tagId)
      });
      return {
        data: {
          contactId: Number(input.contactId),
          tagId: Number(input.tagId),
          removed: true
        },
        afterSnapshots: [
          {
            resourceType: "tag",
            resourceId: Number(input.tagId),
            fields: {
              contactId: Number(input.contactId),
              linkedCount: 0
            },
            capturedAt: nowIso()
          }
        ]
      };
    }
  }
);

export const TicketTransferOperation = defineOperation(
  {
    id: "ticket.transfer",
    name: "ticket.transfer",
    description: "Transfere ticket para fila e/ou responsável via UpdateTicketService.",
    risk: "medium",
    sideEffect: "database_write",
    resourceTypes: ["ticket", "queue", "user"],
    supportsRollback: false,
    requiresConfirmation: true,
    requiredPermissions: ["aiTools.executeWrite"]
  },
  {
    validate: (_ctx, input) => {
      if (!Number(input.ticketId)) {
        throw new Error("OPERATION_VALIDATION: ticketId_required");
      }
      if (input.queueId == null && input.userId == null) {
        throw new Error("OPERATION_VALIDATION: queueId_or_userId_required");
      }
    },
    preview: async (ctx, input) => {
      const companyId = ctx.toolCtx.companyId;
      const ticketId = Number(input.ticketId);
      const ticket = await Ticket.findOne({
        where: { id: ticketId, companyId },
        attributes: ["id", "status", "queueId", "userId"],
        include: [
          { model: Queue, as: "queue", attributes: ["id", "name"], required: false },
          { model: User, as: "user", attributes: ["id", "name"], required: false }
        ]
      });
      if (!ticket) {
        return {
          operationId: "ticket.transfer",
          summary: "ticket_not_found",
          current: {},
          proposed: {},
          validations: [],
          warnings: [],
          affectedResources: [],
          blockers: ["ticket_not_found"],
          dryRunCapable: true
        };
      }

      const plain = ticket as Ticket & {
        queue?: Queue | null;
        user?: User | null;
      };
      const destQueueId =
        input.queueId != null ? Number(input.queueId) : undefined;
      const destUserId =
        input.userId != null ? Number(input.userId) : undefined;

      const blockers: string[] = [];
      let destQueueName: string | null = null;
      let destUserName: string | null = null;

      if (destQueueId != null) {
        const q = await Queue.findOne({
          where: { id: destQueueId, companyId },
          attributes: ["id", "name"]
        });
        if (!q) blockers.push("queue_not_found");
        else destQueueName = q.name;
      }
      if (destUserId != null) {
        const u = await User.findOne({
          where: { id: destUserId, companyId },
          attributes: ["id", "name"]
        });
        if (!u) blockers.push("user_not_found");
        else destUserName = u.name;
      }

      const sameQueue =
        destQueueId != null && Number(ticket.queueId) === destQueueId;
      const sameUser =
        destUserId != null && Number(ticket.userId) === destUserId;
      if (
        (destQueueId == null || sameQueue) &&
        (destUserId == null || sameUser)
      ) {
        blockers.push("already_transferred");
      }

      return {
        operationId: "ticket.transfer",
        summary: `transfer_ticket:${ticketId}`,
        current: {
          status: ticket.status,
          queueId: ticket.queueId,
          queueName: plain.queue?.name || null,
          userId: ticket.userId,
          userName: plain.user?.name || null
        },
        proposed: {
          [String(ticketId)]: {
            queueId: destQueueId ?? ticket.queueId,
            userId: destUserId !== undefined ? destUserId : ticket.userId,
            status: "pending"
          },
          queueName: destQueueName,
          userName: destUserName
        },
        validations: ["tenant_ok", "transfer_to_pending"],
        warnings: ["requires_confirmation"],
        affectedResources: [
          { type: "ticket", id: ticket.id },
          ...(destQueueId != null
            ? [{ type: "queue" as const, id: destQueueId, label: destQueueName || undefined }]
            : []),
          ...(destUserId != null
            ? [{ type: "user" as const, id: destUserId, label: destUserName || undefined }]
            : [])
        ],
        blockers,
        dryRunCapable: true
      };
    },
    captureBefore: async (ctx, input) => {
      const ticket = await Ticket.findOne({
        where: {
          id: Number(input.ticketId),
          companyId: ctx.toolCtx.companyId
        },
        attributes: ["id", "status", "queueId", "userId"]
      });
      if (!ticket) return [];
      return [
        {
          resourceType: "ticket",
          resourceId: ticket.id,
          fields: {
            status: ticket.status,
            queueId: ticket.queueId,
            userId: ticket.userId
          },
          capturedAt: nowIso()
        }
      ];
    },
    detectConflict: async (ctx, input, before) => {
      const ticket = await Ticket.findOne({
        where: {
          id: Number(input.ticketId),
          companyId: ctx.toolCtx.companyId
        },
        attributes: ["id", "status", "queueId", "userId", "updatedAt"]
      });
      if (!ticket) {
        return {
          code: "NOT_FOUND",
          type: "not_found",
          message: "ticket_not_found",
          retryable: false
        };
      }
      const b = before[0]?.fields;
      if (
        b &&
        (String(b.queueId) !== String(ticket.queueId) ||
          String(b.userId) !== String(ticket.userId) ||
          String(b.status) !== String(ticket.status))
      ) {
        return {
          code: "CONFLICT",
          type: "conflict",
          message: "resource_changed",
          retryable: true
        };
      }
      return null;
    },
    execute: async (ctx, input) => {
      const ticketData: {
        queueId?: number | null;
        userId?: number | null;
        status?: string;
      } = { status: "pending" };
      if (input.queueId !== undefined) ticketData.queueId = Number(input.queueId);
      if (input.userId !== undefined) {
        ticketData.userId =
          input.userId === null ? null : Number(input.userId);
      }

      const { default: UpdateTicketService } = await import(
        "../../../TicketServices/UpdateTicketService"
      );
      const { ticket } = await UpdateTicketService({
        ticketId: Number(input.ticketId),
        companyId: ctx.toolCtx.companyId,
        ticketData,
        actionUserId:
          ctx.toolCtx.userId != null ? String(ctx.toolCtx.userId) : null
      });

      return {
        data: {
          ticketId: ticket.id,
          status: ticket.status,
          queueId: ticket.queueId,
          userId: ticket.userId
        },
        afterSnapshots: [
          {
            resourceType: "ticket",
            resourceId: ticket.id,
            fields: {
              status: ticket.status,
              queueId: ticket.queueId,
              userId: ticket.userId
            },
            capturedAt: nowIso()
          }
        ]
      };
    }
  }
);

export const InternalNoteCreateOperation = defineOperation(
  {
    id: "internal.note.create",
    name: "internal.note.create",
    description: "Cria nota interna em ticket.",
    risk: "low",
    sideEffect: "database_write",
    resourceTypes: ["ticket", "note"],
    supportsRollback: true,
    requiresConfirmation: false,
    requiredPermissions: ["aiTools.executeWrite"],
    transactionRequired: false
  },
  {
    validate: (_ctx, input) => {
      if (!Number(input.ticketId)) {
        throw new Error("OPERATION_VALIDATION: ticketId_required");
      }
      const note = String(input.note || "").trim();
      if (note.length < 3) {
        throw new Error("OPERATION_VALIDATION: note_too_short");
      }
    },
    preview: async (ctx, input) => {
      const ticket = await Ticket.findOne({
        where: {
          id: Number(input.ticketId),
          companyId: ctx.toolCtx.companyId
        },
        attributes: ["id", "contactId", "status"]
      });
      if (!ticket) {
        return {
          operationId: "internal.note.create",
          summary: "ticket_not_found",
          current: {},
          proposed: {},
          validations: [],
          warnings: [],
          affectedResources: [],
          blockers: ["ticket_not_found"],
          dryRunCapable: true
        };
      }
      const note = String(input.note || "").trim().slice(0, 2000);
      return {
        operationId: "internal.note.create",
        summary: `create_note:ticket_${ticket.id}`,
        current: { ticketId: ticket.id, status: ticket.status },
        proposed: {
          ticketId: ticket.id,
          contactId: ticket.contactId,
          notePreview: note.slice(0, 120)
        },
        validations: ["tenant_ok", "note_min_length"],
        warnings: [],
        affectedResources: [
          { type: "ticket", id: ticket.id },
          { type: "note", id: "new" }
        ],
        blockers: [],
        dryRunCapable: true
      };
    },
    captureBefore: async (ctx, input) => {
      const count = await TicketNote.count({
        where: { ticketId: Number(input.ticketId) }
      });
      return [
        {
          resourceType: "note",
          resourceId: `ticket:${input.ticketId}`,
          fields: { noteCount: count },
          capturedAt: nowIso()
        }
      ];
    },
    execute: async (ctx, input) => {
      const ticket = await Ticket.findOne({
        where: {
          id: Number(input.ticketId),
          companyId: ctx.toolCtx.companyId
        },
        attributes: ["id", "contactId"]
      });
      if (!ticket) {
        throw new Error("OPERATION_NOT_FOUND: ticket_not_found");
      }
      const userId = ctx.toolCtx.userId;
      if (userId == null) {
        throw new Error("OPERATION_VALIDATION: userId_required");
      }
      const { default: CreateTicketNoteService } = await import(
        "../../../TicketNoteService/CreateTicketNoteService"
      );
      const note = await CreateTicketNoteService({
        note: String(input.note).trim().slice(0, 2000),
        ticketId: ticket.id,
        contactId: ticket.contactId,
        userId
      });
      const count = await TicketNote.count({
        where: { ticketId: ticket.id }
      });
      return {
        data: { noteId: note.id, ticketId: ticket.id },
        afterSnapshots: [
          {
            resourceType: "note",
            resourceId: note.id,
            fields: { noteCount: count, created: true },
            capturedAt: nowIso()
          }
        ]
      };
    },
    rollback: async (_ctx, _input, before) => {
      // Best-effort: não destrói notas sem id; rollback marcado unsupported se sem noteId
      void before;
    }
  }
);

export const WRITE_OPERATIONS = [
  ContactUpdateAllowedFieldsOperation,
  AddContactTagOperation,
  RemoveContactTagOperation,
  TicketTransferOperation,
  InternalNoteCreateOperation
];
