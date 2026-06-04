import { Request, Response } from "express";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getWbot } from "../libs/wbot";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import GroupOpenConversationService from "../services/GroupServices/GroupOpenConversationService";
import ListGroupsInboxService from "../services/GroupServices/ListGroupsInboxService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { logger } from "../utils/logger";
import {
  assertUserCanAccessGroupContact,
  filterGroupRowsForUser,
  isGroupVisibilityPrivileged,
  loadAuthorizedQueueIdsByContact
} from "../helpers/groupVisibility";

const ADMIN_PREVIEW_MAX = 5;

function buildAdminPreview(
  participants: Array<{ admin?: string | null; isAdmin?: boolean; id?: string; notify?: string; name?: string }> | undefined
): string[] {
  if (!participants?.length) return [];
  const admins = participants.filter(
    p => p.admin === "admin" || p.admin === "superadmin" || p.isAdmin === true
  );
  return admins.slice(0, ADMIN_PREVIEW_MAX).map(p => {
    const jid = String(p.id || "");
    const short = jid.split("@")[0] || "";
    const label = (p.notify || p.name || short || "").trim();
    return (label || "Admin").slice(0, 48);
  });
}

function normalizeInviteCode(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  return s.replace(/^\/+/, "").split(/\s/)[0];
}

function normalizeDigitsToJid(input: string): string {
  const d = String(input).replace(/\D/g, "");
  if (!d) {
    throw new AppError("ERR_GROUP_INVALID_NUMBER", 400);
  }
  return `${d}@s.whatsapp.net`;
}

function normalizeGroupJid(groupId: string): string {
  const s = String(groupId || "").trim();
  if (!s) {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }
  if (s.includes("@g.us")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) {
    throw new AppError("ERR_GROUP_INVALID_GROUP_ID", 400);
  }
  return `${digits}@g.us`;
}

function countAdmins(participants: Array<{ admin?: string | null; isAdmin?: boolean }> | undefined): number {
  if (!participants?.length) return 0;
  return participants.filter(
    p => p.admin === "admin" || p.admin === "superadmin" || p.isAdmin === true
  ).length;
}

function mapGroupListEntry(id: string, meta: any) {
  const participants = meta?.participants;
  const count =
    Array.isArray(participants) ? participants.length : meta?.size ?? 0;
  return {
    id,
    name: meta?.subject ?? "",
    participantCount: count,
    adminCount: countAdmins(participants),
    adminPreview: buildAdminPreview(participants)
  };
}

/** Grupos autorizados sem ticket open/pending (aba Atendimento → Grupos). */
export const inbox = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, supportMode } = req.user;
  const actor = { id: req.user.id, profile, supportMode, companyId };
  const data = await ListGroupsInboxService({ companyId, actor });
  return res.status(200).json(data);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, supportMode } = req.user;

  await ShowWhatsAppService(whatsappId, companyId);

  try {
    const wbot = getWbot(Number(whatsappId));
    const data = await wbot.groupFetchAllParticipating();
    const rawGroups = Object.entries(data || {}).map(([jid, meta]) =>
      mapGroupListEntry(jid, meta)
    );

    const actor = { id: req.user.id, profile, supportMode, companyId };
    const privileged = isGroupVisibilityPrivileged(actor);

    const digitsByJid = new Map<string, string>();
    rawGroups.forEach(g => {
      const digits = String(g.id || "").replace(/\D/g, "");
      if (digits) digitsByJid.set(String(g.id), digits);
    });
    const digitsList = Array.from(new Set(Array.from(digitsByJid.values())));

    const contactRows =
      digitsList.length > 0
        ? await Contact.findAll({
            where: { companyId, isGroup: true, number: digitsList },
            attributes: ["id", "number", "groupVisible"]
          })
        : [];
    const byDigits = new Map<string, { id: number; groupVisible: boolean }>();
    contactRows.forEach(c => {
      byDigits.set(String(c.number), { id: c.id, groupVisible: Boolean((c as any).groupVisible) });
    });

    // Admin/supervisor: garante existência do contato para poder configurar visibilidade.
    if (privileged && digitsList.length > 0) {
      const wpp = await Whatsapp.findByPk(Number(whatsappId), {
        attributes: ["id", "companyId", "defaultGroupVisible"]
      });
      const defaultGroupVisible = Boolean((wpp as any)?.defaultGroupVisible);
      const missing = digitsList.filter(d => !byDigits.has(d));
      if (missing.length > 0) {
        const created = await Promise.all(
          missing.map(async d => {
            try {
              const row = await Contact.create({
                name: d,
                number: d,
                isGroup: true,
                groupVisible: defaultGroupVisible,
                companyId,
                whatsappId: Number(whatsappId)
              } as any);
              return row;
            } catch {
              return null;
            }
          })
        );
        created.filter(Boolean).forEach((c: any) => {
          byDigits.set(String(c.number), { id: c.id, groupVisible: Boolean(c.groupVisible) });
        });
      }
    }

    const contactIdsForAuth = [...byDigits.values()].map((c) => c.id);
    const authorizedMap = await loadAuthorizedQueueIdsByContact(
      contactIdsForAuth,
      companyId
    );

    const groupsMapped = rawGroups.map(g => {
      const digits = digitsByJid.get(String(g.id)) || "";
      const cfg = digits ? byDigits.get(digits) : undefined;
      const contactId = cfg?.id ?? null;
      const authorizedQueueIds = contactId
        ? authorizedMap.get(contactId) || []
        : [];
      return {
        ...g,
        contactId,
        groupVisible: cfg?.groupVisible ?? false,
        authorizedQueueIds
      };
    });

    const groups = await filterGroupRowsForUser(groupsMapped, actor);

    return res.status(200).json({ groups });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof Boom) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] list failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const create = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, name, participants } = req.body as {
    whatsappId?: number;
    name?: string;
    participants?: string[];
  };
  const { companyId } = req.user;

  if (!whatsappId || !name?.trim()) {
    throw new AppError("ERR_GROUP_CREATE_PARAMS", 400);
  }
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new AppError("ERR_GROUP_CREATE_PARTICIPANTS", 400);
  }

  await ShowWhatsAppService(whatsappId, companyId);

  const jids = participants.map(p => normalizeDigitsToJid(String(p)));

  try {
    const wbot = getWbot(Number(whatsappId));
    const meta = await wbot.groupCreate(name.trim(), jids);
    return res.status(200).json({
      id: meta.id,
      name: meta.subject,
      participantCount: meta.participants?.length ?? 0
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof Boom) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] create failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const join = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, inviteCode } = req.body as {
    whatsappId?: number;
    inviteCode?: string;
  };
  const { companyId } = req.user;

  if (!whatsappId) {
    throw new AppError("ERR_GROUP_WHATSAPP_REQUIRED", 400);
  }
  const code = normalizeInviteCode(String(inviteCode || ""));
  if (!code) {
    throw new AppError("ERR_GROUP_INVITE_CODE_REQUIRED", 400);
  }

  await ShowWhatsAppService(whatsappId, companyId);

  try {
    const wbot = getWbot(Number(whatsappId));
    const groupJid = await wbot.groupAcceptInvite(code);
    return res.status(200).json({ groupJid: groupJid ?? null });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof Boom) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] join failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const openConversation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, groupId } = req.body as {
    whatsappId?: number;
    groupId?: string;
  };
  const { companyId, profile, supportMode } = req.user;

  if (!whatsappId || !groupId) {
    throw new AppError("ERR_GROUP_OPEN_PARAMS", 400);
  }

  try {
    const actor = { id: req.user.id, profile, supportMode, companyId };
    const digits = String(groupId).includes("@g.us")
      ? String(groupId).replace(/\D/g, "")
      : String(groupId).replace(/\D/g, "");
    const groupContact = await Contact.findOne({
      where: { companyId, isGroup: true, number: digits }
    });
    if (!groupContact) {
      throw new AppError("ERR_GROUP_NOT_VISIBLE", 403);
    }
    await assertUserCanAccessGroupContact(groupContact, actor);

    const { uuid } = await GroupOpenConversationService({
      companyId,
      whatsappId: Number(whatsappId),
      groupId: String(groupId)
    });
    return res.status(200).json({ uuid });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] openConversation failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const leave = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, groupId } = req.body as {
    whatsappId?: number;
    groupId?: string;
  };
  const { companyId } = req.user;

  if (!whatsappId || !groupId) {
    throw new AppError("ERR_GROUP_LEAVE_PARAMS", 400);
  }

  await ShowWhatsAppService(whatsappId, companyId);

  const jid = normalizeGroupJid(String(groupId));

  try {
    const wbot = getWbot(Number(whatsappId));
    await wbot.groupLeave(jid);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err instanceof Boom) {
      return res.status(400).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] leave failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};
