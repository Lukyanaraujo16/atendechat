import { FindOptions } from "sequelize/types";
import Queue from "../../models/Queue";
import InstagramAccount from "../../models/InstagramAccount";

interface Request {
  companyId: number;
}

const ListInstagramAccountsService = async ({
  companyId
}: Request): Promise<InstagramAccount[]> => {
  const options: FindOptions = {
    where: { companyId },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color"]
      }
    ],
    order: [["name", "ASC"]]
  };

  const accounts = await InstagramAccount.findAll(options);

  return accounts;
};

export default ListInstagramAccountsService;
