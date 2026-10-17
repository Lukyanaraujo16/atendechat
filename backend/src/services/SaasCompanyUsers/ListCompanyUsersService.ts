import { Op, Sequelize } from "sequelize";
import User from "../../models/User";
import {
  PUBLIC_USER_ATTRIBUTES,
  PublicCompanyUser,
  assertCompanyExists,
  serializeCompanyUser
} from "./companyUserHelpers";

interface Request {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
}

interface Response {
  users: PublicCompanyUser[];
  count: number;
  hasMore: boolean;
}

export const COMPANY_USERS_PAGE_SIZE = 20;

/** Escapa curingas do LIKE para busca literal. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, ch => `\\${ch}`);
}

const ListCompanyUsersService = async ({
  companyId,
  searchParam = "",
  pageNumber = 1
}: Request): Promise<Response> => {
  await assertCompanyExists(companyId);

  const term = String(searchParam ?? "").trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(String(pageNumber), 10) || 1);
  const limit = COMPANY_USERS_PAGE_SIZE;
  const offset = limit * (page - 1);

  const where: any = { companyId };
  if (term) {
    const like = `%${escapeLike(term)}%`;
    where[Op.or] = [
      Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("name")), {
        [Op.like]: like
      }),
      Sequelize.where(Sequelize.fn("LOWER", Sequelize.col("email")), {
        [Op.like]: like
      })
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: PUBLIC_USER_ATTRIBUTES,
    limit,
    offset,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  return {
    users: rows.map(serializeCompanyUser),
    count,
    hasMore: count > offset + rows.length
  };
};

export default ListCompanyUsersService;
