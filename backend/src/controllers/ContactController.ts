import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import BatchDeleteContactsService from "../services/ContactServices/BatchDeleteContactsService";
import GetContactService from "../services/ContactServices/GetContactService";
import ContactSummaryService from "../services/ContactServices/ContactSummaryService";
import AddTagToContactService from "../services/ContactServices/AddTagToContactService";
import RemoveTagFromContactService from "../services/ContactServices/RemoveTagFromContactService";
import Contact from "../models/Contact";
import ListContactGroupQueuesService from "../services/ContactServices/ListContactGroupQueuesService";
import UpdateContactGroupQueuesService from "../services/ContactServices/UpdateContactGroupQueuesService";
import { isGroupVisibilityPrivileged } from "../helpers/groupVisibility";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import SimpleListService, {
  SearchContactParams
} from "../services/ContactServices/SimpleListService";
import ContactCustomField from "../models/ContactCustomField";
import { logger } from "../utils/logger";
import ToggleDisableBotContactService from "../services/ContactServices/ToggleDisableBotContactService";
import AssignCreatorOnContactCreateService from "../services/ContactServices/AssignCreatorOnContactCreateService";
import ReplaceContactAssignmentsService from "../services/ContactServices/ReplaceContactAssignmentsService";
import {
  assertUserCanAccessContact,
  canManageContactAssignments
} from "../helpers/contactAccess";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  limit?: string;
  tagId?: string;
  labelId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  notes?: string | null;
  extraInfo?: ExtraInfo[];
  assigneeUserIds?: number[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, limit, tagId, labelId, dateFrom, dateTo } =
    req.query as IndexQuery;
  const { companyId, id, profile, supportMode } = req.user;

  const { contacts, count, hasMore, page, limit: pageLimit, totalPages } =
    await ListContactsService({
    searchParam,
    pageNumber,
    limit,
    companyId,
    tagId,
    labelId,
    dateFrom,
    dateTo,
    accessUser: {
      id,
      profile,
      supportMode,
      super: (req.user as { super?: boolean }).super
    }
  });

  return res.json({
    contacts,
    count,
    hasMore,
    page,
    limit: pageLimit,
    totalPages
  });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;

  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: creatorUserId } = req.user;
  const body = req.body as ContactData & { companyId?: number };
  const accessUser = {
    id: creatorUserId,
    profile: req.user.profile,
    supportMode: req.user.supportMode,
    super: (req.user as { super?: boolean }).super
  };
  const newContact: ContactData = {
    name: body.name,
    number: body.number,
    email: body.email,
    notes: body.notes,
    extraInfo: body.extraInfo,
    assigneeUserIds: body.assigneeUserIds
  };
  newContact.number = String(newContact.number || "").replace(/\D/g, "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  const contact = await createNewContact(
    newContact,
    Number(companyId),
    schema,
    Number(creatorUserId),
    accessUser
  );

  return res.status(200).json(contact);
};

export const storeUpload = async (req: Request, res: Response) : Promise<Response> => {

  const { companyId, id: creatorUserId } = req.user;
  const contacts = req.body;

  let errorBag = [];
  let contactAdded = [];

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string().required()
  });

  const promises = contacts.map(async contact => {

    const newContact : ContactData = {name: contact.Nome, number: contact.Telefone.replace(/\D/g, '')}

    try{

      const contact = await createUploadedContact(
        newContact,
        companyId,
        schema,
        Number(creatorUserId)
      )
      contactAdded.push( {contactName: contact.name, contactId: contact.id} );

    }catch(e){
      errorBag.push({contactName: contact.Nome, error: e || e.message});
    }
  });

  await Promise.all(promises);

  return res.status(200).json({newContacts: contactAdded, errorBag: errorBag});
}

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, id, profile, supportMode } = req.user;

  const contact = await ShowContactService(contactId, companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  return res.status(200).json(contact);
};

export const summary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, id, profile, supportMode } = req.user;

  await assertUserCanAccessContact(Number(contactId), companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  const data = await ContactSummaryService(Number(contactId), companyId);

  return res.status(200).json(data);
};

export const addTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { tagId } = req.body as { tagId?: number };
  const { companyId, id, profile, supportMode } = req.user;

  if (tagId === undefined || tagId === null) {
    throw new AppError("tagId é obrigatório", 400);
  }

  await assertUserCanAccessContact(Number(contactId), companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  await AddTagToContactService({
    contactId: Number(contactId),
    tagId: Number(tagId),
    companyId
  });

  return res.status(201).json({ ok: true });
};

export const removeTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId, tagId } = req.params;
  const { companyId, id, profile, supportMode } = req.user;

  await assertUserCanAccessContact(Number(contactId), companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  await RemoveTagFromContactService({
    contactId: Number(contactId),
    tagId: Number(tagId),
    companyId
  });

  return res.status(200).json({ ok: true });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { companyId, id, profile, supportMode } = req.user;
  const { contactId } = req.params;

  await assertUserCanAccessContact(Number(contactId), companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  const normalizedIncoming = contactData.number
    ? contactData.number.replace(/\D/g, "")
    : "";

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    ),
    notes: Yup.string().nullable()
  });

  const existing = await Contact.findOne({
    where: { id: contactId, companyId },
    attributes: ["id", "number", "companyId"]
  });

  if (!existing) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const payloadForValidation = {
    ...contactData,
    number: normalizedIncoming || existing.number.replace(/\D/g, "")
  };

  try {
    await schema.validate(payloadForValidation);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const normalizedExisting = existing.number.replace(/\D/g, "");
  const normalizedNew = (normalizedIncoming || normalizedExisting).replace(
    /\D/g,
    ""
  );

  let finalNumber = normalizedNew;

  if (normalizedNew !== normalizedExisting) {
    await CheckIsValidContact(normalizedNew, companyId);
    const validNumber = await CheckContactNumber(normalizedNew, companyId);
    finalNumber = validNumber.jid.replace(/\D/g, "");
  }

  await UpdateContactService({
    contactData: {
      ...contactData,
      number: finalNumber,
      notes: contactData.notes
    },
    contactId,
    companyId
  });

  const contact = await emitContactWithAssignments(
    Number(contactId),
    companyId,
    "update"
  );

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, id, profile, supportMode } = req.user;

  await ShowContactService(contactId, companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  await DeleteContactService(contactId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};

const MAX_BULK_DELETE = 200;

export const bulkRemove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id, profile, supportMode } = req.user;
  const contactIds = req.body?.contactIds;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  if (contactIds.length > MAX_BULK_DELETE) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const ids = contactIds
    .map((rawId: unknown) => Number(rawId))
    .filter((rawId: number) => Number.isFinite(rawId) && rawId > 0);

  if (!ids.length) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  const result = await BatchDeleteContactsService(ids, companyId, {
    id,
    profile,
    supportMode,
    super: (req.user as { super?: boolean }).super
  });

  return res.status(200).json(result);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId, profile, supportMode, id } = req.user;

  const privileged =
    profile === "admin" || profile === "supervisor" || supportMode === true;

  const contacts = await SimpleListService({
    name,
    companyId,
    includeHiddenGroups: privileged,
    accessUser: {
      id,
      profile,
      supportMode,
      super: (req.user as { super?: boolean }).super
    }
  });

  return res.json(contacts);
};

const WHATSAPP_SOFT_FAIL_CODES = new Set([
  "ERR_WAPP_CHECK_CONTACT",
  "ERR_WAPP_INVALID_CONTACT",
  "ERR_CHECK_NUMBER",
  "invalidNumber"
]);

/** Na criação manual, falha de WhatsApp não deve impedir salvar o contato. */
const normalizeContactNumberForCreate = async (
  rawNumber: string,
  companyId: number
): Promise<string> => {
  const number = String(rawNumber || "").replace(/\D/g, "");
  if (!number) {
    throw new AppError("Invalid number format. Only numbers is allowed.");
  }

  try {
    await CheckIsValidContact(number, companyId);
    const validNumber = await CheckContactNumber(number, companyId);
    if (!validNumber?.jid) {
      throw new AppError("Não foi possível localizar o número informado no Whatsapp");
    }
    return validNumber.jid.replace(/\D/g, "");
  } catch (err: unknown) {
    const message =
      err instanceof AppError
        ? String(err.message)
        : err instanceof Error
          ? err.message
          : String(err);
    const lower = message.toLowerCase();
    const softFail =
      WHATSAPP_SOFT_FAIL_CODES.has(message) ||
      lower.includes("whatsapp") ||
      lower.includes("wbot") ||
      lower.includes("connection") ||
      lower.includes("socket");

    if (softFail) {
      logger.warn(
        { companyId, number, message },
        "[Contact] criando contato sem validação WhatsApp"
      );
      return number;
    }
    throw err;
  }
};

const emitContactWithAssignments = async (
  contactId: number,
  companyId: number,
  action: "create" | "update"
) => {
  const contact = await ShowContactService(contactId, companyId);
  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action,
    contact
  });
  return contact;
};

const normalizeAssigneeUserIds = (raw?: number[]): number[] =>
  [...new Set((raw || []).map((id) => Number(id)).filter((id) => id > 0))];

const createNewContact = async (
  newContact: ContactData,
  companyId: number,
  schema: any,
  creatorUserId: number,
  accessUser?: {
    id?: number | string;
    profile?: string;
    supportMode?: boolean;
    super?: boolean;
  }
) => {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (!Number.isFinite(creatorUserId) || creatorUserId <= 0) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  newContact.number = await normalizeContactNumberForCreate(
    newContact.number,
    companyId
  );

  const privileged = canManageContactAssignments(accessUser || {});
  const assigneeUserIds = normalizeAssigneeUserIds(newContact.assigneeUserIds);

  if (privileged && !assigneeUserIds.length) {
    throw new AppError("ERR_CONTACT_REQUIRES_ASSIGNEE", 400);
  }

  const contact = await CreateContactService({
    ...newContact,
    companyId,
    accessUser,
    creatorUserId
  });

  if (privileged) {
    await ReplaceContactAssignmentsService({
      contactId: contact.id,
      companyId,
      userIds: assigneeUserIds,
      assignedByUserId: creatorUserId
    });
  } else {
    try {
      await AssignCreatorOnContactCreateService({
        contactId: contact.id,
        companyId,
        creatorUserId
      });
    } catch (assignErr) {
      logger.error(
        { assignErr, contactId: contact.id, creatorUserId, companyId },
        "[Contact] falha ao atribuir criador — contato já criado"
      );
      throw assignErr;
    }
  }

  return emitContactWithAssignments(contact.id, companyId, "create");
};

const createUploadedContact = async (
  newContact: ContactData,
  companyId: number,
  schema: any,
  creatorUserId: number
) => {
  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  newContact.number = newContact.number.replace(/\D/g, "");
  const contact = await CreateContactService({
    ...newContact,
    companyId
  });

  await AssignCreatorOnContactCreateService({
    contactId: contact.id,
    companyId,
    creatorUserId
  });

  return emitContactWithAssignments(contact.id, companyId, "create");
};

export const toggleDisableBot = async (req: Request, res: Response): Promise<Response> => {
  var { contactId } = req.params;
  const { companyId } = req.user;
  const contact = await ToggleDisableBotContactService({ contactId });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const updateChatbotForContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, profile, supportMode } = req.user;

  if (profile !== "admin" && profile !== "supervisor" && supportMode !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    chatbotDisabled: Yup.boolean().required()
  });

  const { chatbotDisabled } = await schema.validate(req.body, {
    abortEarly: false
  });

  const contactRow = await Contact.findByPk(contactId);
  if (!contactRow) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }
  if (contactRow.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  await contactRow.update({ chatbotDisabled });

  const contact = await ShowContactService(contactId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const getGroupQueuesForContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, profile, supportMode } = req.user;

  if (!isGroupVisibilityPrivileged({ id: req.user.id, profile, supportMode, companyId })) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const data = await ListContactGroupQueuesService(Number(contactId), companyId);
  return res.status(200).json(data);
};

export const updateGroupQueuesForContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, profile, supportMode } = req.user;

  if (!isGroupVisibilityPrivileged({ id: req.user.id, profile, supportMode, companyId })) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    queueIds: Yup.array().of(Yup.number().integer().positive()).required()
  });
  const { queueIds } = await schema.validate(req.body, { abortEarly: false });

  const result = await UpdateContactGroupQueuesService({
    contactId: Number(contactId),
    companyId,
    queueIds: queueIds as number[]
  });

  const contact = await ShowContactService(contactId, companyId);
  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(result);
};

export const updateGroupVisibilityForContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId, profile, supportMode } = req.user;

  if (profile !== "admin" && profile !== "supervisor" && supportMode !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const schema = Yup.object().shape({
    groupVisible: Yup.boolean().required()
  });

  const { groupVisible } = await schema.validate(req.body, { abortEarly: false });

  const contactRow = await Contact.findByPk(contactId);
  if (!contactRow) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }
  if (contactRow.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (contactRow.isGroup !== true) {
    throw new AppError("ERR_CONTACT_NOT_GROUP", 400);
  }

  await contactRow.update({ groupVisible: Boolean(groupVisible) });

  const contact = await ShowContactService(contactId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};
