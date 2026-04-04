import QueueIntegrations from "../../models/QueueIntegrations";
import AppError from "../../errors/AppError";

const DeleteQueueIntegrationService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const row = await QueueIntegrations.findOne({
    where: { id, companyId }
  });

  if (!row) {
    throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }

  await row.destroy();
};

export default DeleteQueueIntegrationService;
