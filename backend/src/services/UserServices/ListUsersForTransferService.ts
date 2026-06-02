import { Sequelize, Op } from "sequelize";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  searchParam?: string;
  companyId: number;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

/**
 * Lista mínima de utilizadores da mesma empresa para transferência de tickets (sem team.users).
 */
const ListUsersForTransferService = async ({
  searchParam = "",
  companyId
}: Request): Promise<Response> => {
  const term = (searchParam ?? "").trim().toLowerCase();

  const whereCondition: {
    companyId: { [Op.eq]: number };
    [Op.or]?: unknown[];
  } = {
    companyId: { [Op.eq]: companyId }
  };

  if (term.length > 0) {
    whereCondition[Op.or] = [
      {
        "$User.name$": Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("User.name")),
          "LIKE",
          `%${term}%`
        )
      },
      { email: { [Op.like]: `%${term}%` } }
    ];
  }

  const limit = 20;
  const { count, rows: users } = await User.findAndCountAll({
    where: whereCondition,
    attributes: ["id", "name", "email", "profile", "online"],
    limit,
    order: [["name", "ASC"]],
    distinct: true,
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] }
    ]
  });

  return {
    users,
    count,
    hasMore: count > users.length
  };
};

export default ListUsersForTransferService;
