import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import {
  assertUserCanAccessGroupContact,
  filterGroupRowsForUser,
  isGroupVisibilityPrivileged,
  loadAuthorizedQueueIdsByContact,
  type GroupAccessActor
} from "../../helpers/groupVisibility";
import {
  contactNeedsGroupNameResolution,
  createFetchRemoteSubjectFromProvider,
  ensureGroupContactDisplayName
} from "../../helpers/groupContactName";
import { toPublicGroupListEntry } from "../../modules/whatsapp/groups/groupAdminPreview";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

const ListParticipatingGroupsService = async ({
  whatsappId,
  companyId,
  actor
}: {
  whatsappId: number;
  companyId: number;
  actor: GroupAccessActor;
}): Promise<{ groups: Array<Record<string, unknown>> }> => {
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);

  const summaries = await provider.listParticipatingGroups();
  const rawGroups = summaries.map(toPublicGroupListEntry);

  const privileged = isGroupVisibilityPrivileged(actor);

  const digitsByJid = new Map<string, string>();
  rawGroups.forEach(g => {
    const digits = String(g.id || "").replace(/\D/g, "");
    if (digits) digitsByJid.set(String(g.id), digits);
  });
  const digitsList = Array.from(new Set(Array.from(digitsByJid.values())));

  const subjectByDigits = new Map<string, string>();
  rawGroups.forEach(g => {
    const digits = digitsByJid.get(String(g.id)) || "";
    const subject = String(g.name || "").trim();
    if (digits && subject) subjectByDigits.set(digits, subject);
  });

  const fetchRemoteSubject = createFetchRemoteSubjectFromProvider(provider);

  const contactRows =
    digitsList.length > 0
      ? await Contact.findAll({
          where: { companyId, isGroup: true, number: digitsList },
          attributes: [
            "id",
            "name",
            "number",
            "groupVisible",
            "whatsappId",
            "isGroup"
          ]
        })
      : [];
  const byDigits = new Map<string, { id: number; groupVisible: boolean }>();
  /* eslint-disable no-restricted-syntax, no-await-in-loop */
  for (const c of contactRows) {
    if (contactNeedsGroupNameResolution(c)) {
      const subjectHint = subjectByDigits.get(String(c.number));
      await ensureGroupContactDisplayName(c, {
        subjectHint,
        fetchRemoteSubject
      });
    }
    byDigits.set(String(c.number), {
      id: c.id,
      groupVisible: Boolean((c as { groupVisible?: boolean }).groupVisible)
    });
  }
  /* eslint-enable no-restricted-syntax, no-await-in-loop */

  if (privileged && digitsList.length > 0) {
    const wpp = await Whatsapp.findByPk(Number(whatsappId), {
      attributes: ["id", "companyId", "defaultGroupVisible"]
    });
    const defaultGroupVisible = Boolean(
      (wpp as { defaultGroupVisible?: boolean } | null)?.defaultGroupVisible
    );
    const missing = digitsList.filter(d => !byDigits.has(d));
    if (missing.length > 0) {
      const created = await Promise.all(
        missing.map(async d => {
          try {
            const displayName = subjectByDigits.get(d) || d;
            const row = await Contact.create({
              name: displayName,
              number: d,
              isGroup: true,
              groupVisible: defaultGroupVisible,
              companyId,
              whatsappId: Number(whatsappId)
            } as never);
            return row;
          } catch {
            return null;
          }
        })
      );
      created.filter(Boolean).forEach(c => {
        if (!c) return;
        byDigits.set(String(c.number), {
          id: c.id,
          groupVisible: Boolean((c as { groupVisible?: boolean }).groupVisible)
        });
      });
    }
  }

  const contactIdsForAuth = [...byDigits.values()].map(c => c.id);
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
  return { groups };
};

export async function assertGroupContactAccessibleForOpen(input: {
  companyId: number;
  groupId: string;
  actor: GroupAccessActor;
}): Promise<void> {
  const digits = String(input.groupId).replace(/\D/g, "");
  const groupContact = await Contact.findOne({
    where: { companyId: input.companyId, isGroup: true, number: digits }
  });
  if (!groupContact) {
    throw new AppError("ERR_GROUP_NOT_VISIBLE", 403);
  }
  await assertUserCanAccessGroupContact(groupContact, input.actor);
}

export default ListParticipatingGroupsService;
