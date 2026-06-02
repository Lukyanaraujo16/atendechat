import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { FindOptions, Op } from "sequelize";
import {
  canViewAllCompanyContacts,
  applyContactVisibilityFilter,
  ContactAccessUser
} from "../../helpers/contactAccess";
import {
  buildGroupContactVisibilityWhere,
  loadUserQueueIds
} from "../../helpers/groupVisibility";

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

  const baseWhere = { ...options.where, companyId };

  if (includeHiddenGroups || !accessUser) {
    options.where = baseWhere;
  } else if (canViewAllCompanyContacts(accessUser)) {
    options.where = baseWhere;
  } else {
    const actor = {
      id: accessUser.id,
      profile: accessUser.profile,
      supportMode: accessUser.supportMode,
      companyId: Number(companyId)
    };
    const userQueueIds = await loadUserQueueIds(accessUser.id);
    options.where = {
      [Op.and]: [baseWhere, buildGroupContactVisibilityWhere(actor, userQueueIds)]
    };
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
