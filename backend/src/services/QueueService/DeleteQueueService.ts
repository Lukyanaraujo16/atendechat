import ShowQueueService from "./ShowQueueService";
import Ticket from "../../models/Ticket";
import UserQueue from "../../models/UserQueue";
import WhatsappQueue from "../../models/WhatsappQueue";
import QueueOption from "../../models/QueueOption";
import AppError from "../../errors/AppError";
import SetCompanyUnassignedTicketsQueueService, {
  emitUnassignedTicketsQueueChanged
} from "./SetCompanyUnassignedTicketsQueueService";
import { loadCompanyUnassignedTicketsQueueId } from "../../helpers/unassignedTicketsVisibility";
import sequelize from "../../database";

const DeleteQueueService = async (
  queueId: number | string,
  companyId: number
): Promise<void> => {
  const queue = await ShowQueueService(queueId, companyId);

  const qid = Number(queueId);

  const ticketsCount = await Ticket.count({
    where: { queueId: qid, companyId }
  });

  const usersCount = await UserQueue.count({
    where: { queueId: qid }
  });

  const whatsappLinks = await WhatsappQueue.count({
    where: { queueId: qid }
  });

  const optionsCount = await QueueOption.count({
    where: { queueId: qid }
  });

  if (
    ticketsCount > 0 ||
    usersCount > 0 ||
    whatsappLinks > 0 ||
    optionsCount > 0
  ) {
    throw new AppError(
      `Não é possível excluir: o setor está em uso (${ticketsCount} ticket(s), ${usersCount} usuário(s) vinculado(s), ${whatsappLinks} conexão(ões), ${optionsCount} opção(ões) de menu). Remova os vínculos antes.`,
      400
    );
  }

  const currentUnassigned = await loadCompanyUnassignedTicketsQueueId(
    companyId
  );
  const wasContingency = Number(currentUnassigned) === qid;

  await sequelize.transaction(async transaction => {
    if (wasContingency) {
      await SetCompanyUnassignedTicketsQueueService({
        companyId,
        queueId: null,
        transaction
      });
    }
    await queue.destroy({ transaction });
  });

  if (wasContingency) {
    await emitUnassignedTicketsQueueChanged(companyId, null);
  }
};

export default DeleteQueueService;
