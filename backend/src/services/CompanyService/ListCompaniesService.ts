import { Sequelize, Op } from "sequelize";
import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface Request {
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  companies: Company[];
  count: number;
  hasMore: boolean;
}

const ListCompaniesService = async ({
  searchParam = "",
  pageNumber = "1",
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
    const limit = 20;
    const offset = limit * (+pageNumber - 1);
    

  const { count, rows: companies } = await Company.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]],
    include: [
      {
        model: Plan,
        attributes: ["id", "name", "storageLimitGb"],
        required: false
      }
    ]
  });
  
  const hasMore = count > offset + companies.length;

  return {
    companies,
    count,
    hasMore,
  };
};

export default ListCompaniesService;
