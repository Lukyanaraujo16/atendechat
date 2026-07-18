import { Op, fn, col } from "sequelize";
import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import UserQueue from "../../models/UserQueue";
import { loadCompanyUnassignedTicketsQueueId } from "../../helpers/unassignedTicketsVisibility";

interface Request {
  companyId: number;
}

const ListQueuesService = async ({
  companyId
}: Request): Promise<any[]> => {
  const queues = await Queue.findAll({
    where: {
      companyId
    },
    order: [
      ["orderQueue", "ASC"],
      ["name", "ASC"]
    ]
  });

  const unassignedTicketsQueueId =
    await loadCompanyUnassignedTicketsQueueId(companyId);

  const ids = queues.map(q => q.id);
  const ticketMap = new Map<number, number>();
  const userMap = new Map<number, number>();

  if (ids.length) {
    const ticketAgg = await Ticket.findAll({
      attributes: [
        "queueId",
        [fn("COUNT", col("Ticket.id")), "cnt"]
      ],
      where: {
        companyId,
        queueId: { [Op.in]: ids }
      },
      group: ["queueId"],
      raw: true
    });

    for (const row of ticketAgg as any[]) {
      if (row.queueId != null) {
        ticketMap.set(row.queueId, Number(row.cnt ?? 0));
      }
    }

    const userAgg = await UserQueue.findAll({
      attributes: [
        "queueId",
        [fn("COUNT", col("UserQueue.userId")), "cnt"]
      ],
      where: { queueId: { [Op.in]: ids } },
      group: ["queueId"],
      raw: true
    });

    for (const row of userAgg as any[]) {
      userMap.set(row.queueId, Number(row.cnt ?? 0));
    }
  }

  return queues.map(q => {
    const plain = q.toJSON();
    return {
      ...plain,
      ticketsCount: ticketMap.get(q.id) || 0,
      usersCount: userMap.get(q.id) || 0,
      isUnassignedTicketsQueue:
        unassignedTicketsQueueId != null &&
        Number(unassignedTicketsQueueId) === Number(q.id),
      unassignedTicketsQueueId
    };
  });
};

export default ListQueuesService;
