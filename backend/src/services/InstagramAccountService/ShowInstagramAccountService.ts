import { FindOptions } from "sequelize/types";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import InstagramAccount from "../../models/InstagramAccount";

const ShowInstagramAccountService = async (
  id: string | number,
  companyId: number
): Promise<InstagramAccount> => {
  const findOptions: FindOptions = {
    where: { id, companyId },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  };

  const account = await InstagramAccount.findOne(findOptions);

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  return account;
};

export default ShowInstagramAccountService;
