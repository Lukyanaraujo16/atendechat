/**
 * Monta o body do PUT /tickets/:id alinhado aos fluxos já usados na inbox e no menu rápido.
 * Não inventa regras novas — espelha Aceitar, Finalizar, Reabrir e retorno à fila.
 */

export function isKanbanDragTransitionBlocked(fromStatus, toStatus) {
  return fromStatus === "closed" && toStatus === "pending";
}

export function kanbanDragNeedsCloseConfirm(fromStatus, toStatus) {
  return toStatus === "closed" && fromStatus !== "closed";
}

export function buildKanbanStatusUpdateBody(ticket, targetStatus, authUser) {
  const current = ticket?.status;
  if (!ticket?.id || !targetStatus || current === targetStatus) {
    return null;
  }

  if (isKanbanDragTransitionBlocked(current, targetStatus)) {
    return null;
  }

  const queueId = ticket.queue?.id ?? ticket.queueId ?? null;
  const userId = authUser?.id ?? null;

  if (targetStatus === "closed") {
    return {
      status: "closed",
      userId,
      queueId,
      useIntegration: false,
      promptId: null,
      integrationId: null,
    };
  }

  if (current === "pending" && targetStatus === "open") {
    return { status: "open", userId };
  }

  if (current === "closed" && targetStatus === "open") {
    return { status: "open", userId, queueId };
  }

  if (targetStatus === "pending") {
    return { status: "pending", userId: null, queueId };
  }

  return { status: targetStatus };
}
