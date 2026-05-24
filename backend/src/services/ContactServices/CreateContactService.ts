import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import {
  canViewAllCompanyContacts,
  ContactAccessUser,
  getVisibleContactIdsForUser
} from "../../helpers/contactAccess";
import CreateContactAssignmentService from "./CreateContactAssignmentService";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ExtraInfo[];
  accessUser?: ContactAccessUser;
  creatorUserId?: number;
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  companyId,
  extraInfo = [],
  accessUser,
  creatorUserId
}: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number, companyId }
  });

  if (numberExists) {
    const privileged =
      accessUser && canViewAllCompanyContacts(accessUser);

    if (
      !privileged &&
      accessUser &&
      creatorUserId &&
      Number.isFinite(creatorUserId)
    ) {
      const visibleIds = await getVisibleContactIdsForUser(
        creatorUserId,
        companyId
      );

      if (visibleIds.includes(numberExists.id)) {
        throw new AppError("ERR_DUPLICATED_CONTACT");
      }

      await CreateContactAssignmentService({
        contactId: numberExists.id,
        userId: creatorUserId,
        companyId,
        assignedByUserId: creatorUserId
      });

      const updates: Partial<Contact> = {};
      const trimmedName = String(name || "").trim();
      if (trimmedName && trimmedName !== numberExists.name) {
        updates.name = trimmedName;
      }
      if (email !== undefined && email !== numberExists.email) {
        updates.email = email;
      }
      if (Object.keys(updates).length) {
        await numberExists.update(updates);
      }

      const reloaded = await Contact.findByPk(numberExists.id, {
        include: ["extraInfo"]
      });
      return reloaded ?? numberExists;
    }

    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number,
      email,
      extraInfo,
      companyId
    },
    {
      include: ["extraInfo"]
    }
  );

  return contact;
};

export default CreateContactService;
