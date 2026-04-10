import { Op } from "sequelize";
import User from "../../models/User";
import Company from "../../models/Company";

type Params = {
  query: string;
  limit?: number;
};

/**
 * Pesquisa global de utilizadores (apenas super admin). Para promover ou localizar contas.
 */
const SearchUsersPlatformService = async ({
  query,
  limit = 25
}: Params): Promise<User[]> => {
  const q = (query || "").trim();
  if (q.length < 2) {
    return [];
  }

  const like = `%${q}%`;

  const users = await User.findAll({
    where: {
      [Op.or]: [{ email: { [Op.like]: like } }, { name: { [Op.like]: like } }]
    },
    attributes: [
      "id",
      "name",
      "email",
      "profile",
      "super",
      "online",
      "companyId",
      "createdAt"
    ],
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["name", "ASC"]],
    limit: Math.min(Math.max(limit, 1), 50)
  });

  return users;
};

export default SearchUsersPlatformService;
