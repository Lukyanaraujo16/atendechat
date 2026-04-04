import QueueIntegrations from "../../models/QueueIntegrations";
import AppError from "../../errors/AppError";

const ShowQueueIntegrationService = async (
  id: string | number,
  companyId: number
): Promise<QueueIntegrations> => {
  const integration = await QueueIntegrations.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!integration) {
    throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }

  return integration;
};

export default ShowQueueIntegrationService;
