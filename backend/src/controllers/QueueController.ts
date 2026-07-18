import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueService from "../services/QueueService/CreateQueueService";
import DeleteQueueService from "../services/QueueService/DeleteQueueService";
import ListQueuesService from "../services/QueueService/ListQueuesService";
import ListQueueUsersService from "../services/QueueService/ListQueueUsersService";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import UpdateQueueService from "../services/QueueService/UpdateQueueService";
import { loadCompanyUnassignedTicketsQueueId } from "../helpers/unassignedTicketsVisibility";
import { isNil } from "lodash";

type QueueFilter = {
  companyId: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId: userCompanyId } = req.user;
  const { companyId: queryCompanyId } = req.query as unknown as QueueFilter;
  let companyId = userCompanyId;

  if (!isNil(queryCompanyId)) {
    companyId = +queryCompanyId;
  }

  const queues = await ListQueuesService({ companyId });

  return res.status(200).json(queues);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    orderQueue,
    integrationId,
    promptId,
    chatbotDisabled,
    receiveUnassignedTickets
  } =
    req.body;
  const { companyId } = req.user;

  const queue = await CreateQueueService({
    name,
    color,
    greetingMessage,
    companyId,
    outOfHoursMessage,
    schedules,
    chatbotDisabled: Boolean(chatbotDisabled),
    orderQueue: orderQueue === "" ? null : orderQueue,
    integrationId: integrationId === "" ? null : integrationId,
    promptId: promptId === "" ? null : promptId,
    ...(receiveUnassignedTickets !== undefined
      ? { receiveUnassignedTickets: Boolean(receiveUnassignedTickets) }
      : {})
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "update",
    queue
  });

  return res.status(200).json(queue);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  const queue = await ShowQueueService(queueId, companyId);
  const unassignedTicketsQueueId =
    await loadCompanyUnassignedTicketsQueueId(companyId);
  const isUnassignedTicketsQueue =
    unassignedTicketsQueueId != null &&
    Number(unassignedTicketsQueueId) === Number(queue.id);

  return res.status(200).json({
    ...queue.toJSON(),
    isUnassignedTicketsQueue,
    receiveUnassignedTickets: isUnassignedTicketsQueue,
    unassignedTicketsQueueId
  });
};

export const listUsers = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  const users = await ListQueueUsersService({ queueId, companyId });

  return res.status(200).json(users);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;
  const {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    orderQueue,
    integrationId,
    promptId,
    chatbotDisabled,
    receiveUnassignedTickets
  } =
    req.body;
  const queue = await UpdateQueueService(queueId, {
    name,
    color,
    greetingMessage,
    outOfHoursMessage,
    schedules,
    ...(chatbotDisabled !== undefined ? { chatbotDisabled: Boolean(chatbotDisabled) } : {}),
    orderQueue: orderQueue === "" ? null : orderQueue,
    integrationId: integrationId === "" ? null : integrationId,
    promptId: promptId === "" ? null : promptId,
    ...(receiveUnassignedTickets !== undefined
      ? { receiveUnassignedTickets: Boolean(receiveUnassignedTickets) }
      : {})
  }, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "update",
    queue
  });

  return res.status(201).json(queue);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { companyId } = req.user;

  await DeleteQueueService(queueId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-queue`, {
    action: "delete",
    queueId: +queueId
  });

  return res.status(200).send();
};
