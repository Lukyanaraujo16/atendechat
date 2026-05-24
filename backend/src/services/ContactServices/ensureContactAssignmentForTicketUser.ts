import CreateContactAssignmentService from "./CreateContactAssignmentService";
import { logger } from "../../utils/logger";

interface Request {
  contactId: number | null | undefined;
  userId: number | null | undefined;
  companyId: number;
  ticketStatus?: string | null;
  assignedByUserId?: number | null;
}

/**
 * Garante ContactAssignment idempotente quando o ticket tem atendente definido.
 * Não atribui em pending (piscina/fila/chatbot) — só open/closed/etc. com userId.
 */
const ensureContactAssignmentForTicketUser = async ({
  contactId,
  userId,
  companyId,
  ticketStatus,
  assignedByUserId
}: Request): Promise<void> => {
  const uid = Number(userId);
  const cid = Number(contactId);
  if (!Number.isFinite(uid) || uid <= 0 || !Number.isFinite(cid) || cid <= 0) {
    return;
  }

  const status = String(ticketStatus || "").toLowerCase();
  if (status === "pending") {
    return;
  }

  const actorId = Number(assignedByUserId ?? uid);
  const assignedBy = Number.isFinite(actorId) && actorId > 0 ? actorId : uid;

  try {
    await CreateContactAssignmentService({
      contactId: cid,
      userId: uid,
      companyId,
      assignedByUserId: assignedBy
    });
  } catch (err) {
    logger.warn(
      {
        err,
        contactId: cid,
        userId: uid,
        companyId,
        ticketStatus: status
      },
      "[ContactAssignment] falha ao garantir responsável do ticket"
    );
  }
};

export default ensureContactAssignmentForTicketUser;
