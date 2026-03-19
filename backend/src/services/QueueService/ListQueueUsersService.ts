import User from "../../models/User";
import Queue from "../../models/Queue";
import AppError from "../../errors/AppError";

interface Request {
  queueId: number | string;
  companyId: number;
}

const ListQueueUsersService = async ({
  queueId,
  companyId
}: Request): Promise<User[]> => {
  const queue = await Queue.findByPk(queueId);

  if (!queue) {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }

  if (queue.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const users = await User.findAll({
    attributes: ["id", "name", "email", "profile"],
    include: [
      {
        model: Queue,
        as: "queues",
        where: { id: queueId },
        attributes: ["id", "name", "color"],
        through: { attributes: [] }
      }
    ],
    order: [["name", "ASC"]]
  });

  return users;
};

export default ListQueueUsersService;
