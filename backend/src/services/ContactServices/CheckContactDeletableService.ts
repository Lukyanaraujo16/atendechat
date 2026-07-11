import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

/** Código estável devolvido quando o contato não pode ser apagado por ter histórico. */
export const CONTACT_HISTORY_BLOCK_REASON = "HAS_TICKET_HISTORY";

/**
 * Retorna o motivo de bloqueio caso o contato possua histórico de atendimento
 * (tickets ou mensagens). Não faz distinção entre ticket aberto/fechado:
 * qualquer histórico bloqueia a exclusão física para preservar o registo.
 *
 * @returns o código do motivo (HAS_TICKET_HISTORY) ou `null` se elegível.
 */
export const getContactHistoryBlockReason = async (
  contactId: number,
  companyId: number
): Promise<string | null> => {
  const ticket = await Ticket.findOne({
    where: { contactId, companyId },
    attributes: ["id"]
  });
  if (ticket) {
    return CONTACT_HISTORY_BLOCK_REASON;
  }

  const message = await Message.findOne({
    where: { contactId, companyId },
    attributes: ["id"]
  });
  if (message) {
    return CONTACT_HISTORY_BLOCK_REASON;
  }

  return null;
};

/**
 * Lança AppError (409) quando o contato possui histórico de atendimento.
 * Usado na exclusão individual para impedir a remoção física com cascade.
 */
export const assertContactDeletable = async (
  contactId: number,
  companyId: number
): Promise<void> => {
  const reason = await getContactHistoryBlockReason(contactId, companyId);
  if (reason) {
    throw new AppError("ERR_CONTACT_HAS_HISTORY", 409);
  }
};
