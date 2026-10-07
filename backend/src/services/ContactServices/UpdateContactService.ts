import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import {
  CONTACT_ADDRESS_ATTRIBUTE_NAMES,
  pickContactAddressFields
} from "../../helpers/contactAddressFields";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  notes?: string | null;
  extraInfo?: ExtraInfo[];
  postalCode?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
}

interface Request {
  contactData: ContactData;
  contactId: string;
  companyId: number;
}

const UpdateContactService = async ({
  contactData,
  contactId,
  companyId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo, notes } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "companyId",
      "profilePicUrl",
      "notes",
      ...CONTACT_ADDRESS_ATTRIBUTE_NAMES
    ],
    include: ["extraInfo"]
  });

  if (contact?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async (info: any) => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  const address = pickContactAddressFields(
    contactData as unknown as Record<string, unknown>
  );

  const payload: Partial<Contact> = {};
  if (name !== undefined) payload.name = name;
  if (number !== undefined) payload.number = number;
  if (email !== undefined) payload.email = email;
  if (notes !== undefined) payload.notes = notes ?? null;
  Object.assign(payload, address);

  await contact.update(payload);

  await contact.reload({
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "profilePicUrl",
      "notes",
      ...CONTACT_ADDRESS_ATTRIBUTE_NAMES
    ],
    include: ["extraInfo"]
  });

  return contact;
};

export default UpdateContactService;
