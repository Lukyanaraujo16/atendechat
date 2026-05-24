import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { FindOptions, Op } from "sequelize";
import {
  canViewAllCompanyContacts,
  applyContactVisibilityFilter,
  ContactAccessUser
} from "../../helpers/contactAccess";

export interface SearchContactParams {
  companyId: string | number;
  name?: string;
  /** Quando false, oculta grupos não liberados para usuários comuns. */
  includeHiddenGroups?: boolean;
  accessUser?: ContactAccessUser;
}

const SimpleListService = async ({
  name,
  companyId,
  includeHiddenGroups = true,
  accessUser
}: SearchContactParams): Promise<Contact[]> => {
  let options: FindOptions = {
    order: [
      ['name', 'ASC']
    ]
  }

  if (name) {
    options.where = {
      name: {
        [Op.like]: `%${name}%`
      }
    }
  }

  options.where = {
    ...options.where,
    companyId,
    ...(includeHiddenGroups
      ? {}
      : {
          [Op.or]: [
            { isGroup: false },
            { isGroup: true, groupVisible: true }
          ]
        })
  }

  if (accessUser && !canViewAllCompanyContacts(accessUser)) {
    options.where = await applyContactVisibilityFilter(
      options.where as Record<string, unknown>,
      Number(accessUser.id),
      Number(companyId)
    );
  }

  const contacts = await Contact.findAll(options);

  if (!contacts) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contacts;
};

export default SimpleListService;
