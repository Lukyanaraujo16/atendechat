import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { assertContactDeletable } from "./CheckContactDeletableService";

const DeleteContactService = async (
  id: string,
  companyId?: number
): Promise<void> => {
  const contact = await Contact.findOne({
    where: { id }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (companyId != null && contact.companyId !== companyId) {
    throw new AppError("Não é possível acessar registro de outra empresa", 403);
  }

  // Bloqueia exclusão física quando há histórico (tickets/mensagens) que seria
  // apagado em cascade, preservando o registo de atendimento.
  await assertContactDeletable(contact.id, contact.companyId);

  await contact.destroy();
};

export default DeleteContactService;
