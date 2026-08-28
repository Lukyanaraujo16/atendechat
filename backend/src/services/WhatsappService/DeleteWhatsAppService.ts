import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { isEvolutionConnection } from "../../modules/whatsapp/connectionProvider";
import { deleteEvolutionRemoteInstanceBestEffort } from "../../modules/whatsapp/providers/evolution/lifecycle/deleteEvolutionRemoteInstance";

/**
 * Remove conexão StreamHub.
 * Evolution: best-effort DELETE instance remota antes do destroy local.
 * Falha remota não impede remoção local.
 */
const DeleteWhatsAppService = async (
  id: string,
  companyId: number
): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id, companyId }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (isEvolutionConnection(whatsapp)) {
    await deleteEvolutionRemoteInstanceBestEffort(whatsapp.id);
  }

  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
