/**
 * Reconciliação exclusiva das colunas pending da inbox:
 * AGUARDANDO (waiting) × AUTO (chatbot).
 *
 * Fonte autoritativa: IDs retornados pelas duas APIs
 *   GET /tickets?status=pending&chatbot=false
 *   GET /tickets?status=pending&chatbot=true
 *
 * Proteção de socket/optimistic só vale quando o id ainda não apareceu
 * em NENHUMA das duas APIs. Nunca vence a classificação da coluna irmã.
 */

export function toTicketIdSet(ticketsOrIds) {
  const ids = new Set();
  if (ticketsOrIds instanceof Set) {
    ticketsOrIds.forEach((value) => {
      const id = Number(typeof value === "object" && value != null ? value.id : value);
      if (Number.isFinite(id)) ids.add(id);
    });
    return ids;
  }
  if (!Array.isArray(ticketsOrIds)) return ids;
  ticketsOrIds.forEach((value) => {
    const id = Number(typeof value === "object" && value != null ? value.id : value);
    if (Number.isFinite(id)) ids.add(id);
  });
  return ids;
}

export function collectProtectedPendingIds({
  recentSocketIds,
  recentOptimisticMoves,
  now = Date.now(),
  optimisticTtlMs = 2500,
} = {}) {
  const ids = toTicketIdSet(recentSocketIds);
  if (recentOptimisticMoves instanceof Map) {
    recentOptimisticMoves.forEach((entry, key) => {
      if (!entry || now - entry.at >= optimisticTtlMs) return;
      const id = Number(key);
      if (Number.isFinite(id)) ids.add(id);
    });
  }
  return ids;
}

function ticketByIdMap(...lists) {
  const map = new Map();
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((ticket) => {
      if (ticket == null || ticket.id == null) return;
      map.set(Number(ticket.id), ticket);
    });
  });
  return map;
}

function listFromIdSet(idSet, preferredLists, fallbackMap) {
  const result = [];
  const seen = new Set();
  preferredLists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((ticket) => {
      const id = Number(ticket?.id);
      if (!idSet.has(id) || seen.has(id)) return;
      seen.add(id);
      result.push(ticket);
    });
  });
  idSet.forEach((id) => {
    if (seen.has(id)) return;
    const ticket = fallbackMap.get(id);
    if (ticket) {
      seen.add(id);
      result.push(ticket);
    }
  });
  return result;
}

/**
 * Reconcilia waiting × AUTO.
 *
 * `waitingApiTickets` / `chatbotApiTickets`:
 *   - array (inclusive vazio) = esta coluna foi buscada nesta rodada
 *   - null/undefined = coluna não buscada; usa last*ApiIds + estado atual
 *
 * Prioridade:
 *   1. ID na API AUTO → só chatbot
 *   2. ID na API waiting → só waiting
 *   3. ID protegido ausente das duas APIs → permanece na coluna atual
 *   4. Nunca o mesmo id nas duas listas
 */
export function reconcilePendingInboxColumns({
  waitingPrev = [],
  chatbotPrev = [],
  waitingApiTickets,
  chatbotApiTickets,
  lastWaitingApiIds,
  lastChatbotApiIds,
  protectedIds,
  retainLocalWhenColumnApiEmpty = false,
} = {}) {
  const waitingKnown = Array.isArray(waitingApiTickets);
  const chatbotKnown = Array.isArray(chatbotApiTickets);
  const waitingPrevList = Array.isArray(waitingPrev) ? waitingPrev : [];
  const chatbotPrevList = Array.isArray(chatbotPrev) ? chatbotPrev : [];

  const waitingApiIds = waitingKnown
    ? toTicketIdSet(waitingApiTickets)
    : toTicketIdSet(lastWaitingApiIds);
  const chatbotApiIds = chatbotKnown
    ? toTicketIdSet(chatbotApiTickets)
    : toTicketIdSet(lastChatbotApiIds);
  const protectedSet = toTicketIdSet(protectedIds);

  const waitingPrevIds = toTicketIdSet(waitingPrevList);
  const chatbotPrevIds = toTicketIdSet(chatbotPrevList);

  const waitingOut = new Set();
  const chatbotOut = new Set();

  chatbotApiIds.forEach((id) => chatbotOut.add(id));
  waitingApiIds.forEach((id) => {
    if (!chatbotApiIds.has(id)) waitingOut.add(id);
  });

  waitingPrevIds.forEach((id) => {
    if (chatbotApiIds.has(id)) return;
    if (waitingApiIds.has(id)) return;
    if (!waitingKnown) {
      waitingOut.add(id);
      return;
    }
    if (protectedSet.has(id) && !chatbotApiIds.has(id) && !waitingApiIds.has(id)) {
      waitingOut.add(id);
      return;
    }
    if (
      retainLocalWhenColumnApiEmpty &&
      waitingApiIds.size === 0 &&
      !chatbotApiIds.has(id)
    ) {
      waitingOut.add(id);
    }
  });

  chatbotPrevIds.forEach((id) => {
    if (waitingApiIds.has(id) && !chatbotApiIds.has(id)) return;
    if (chatbotApiIds.has(id)) return;
    if (!chatbotKnown) {
      chatbotOut.add(id);
      return;
    }
    if (protectedSet.has(id) && !waitingApiIds.has(id) && !chatbotApiIds.has(id)) {
      chatbotOut.add(id);
      return;
    }
    if (
      retainLocalWhenColumnApiEmpty &&
      chatbotApiIds.size === 0 &&
      !waitingApiIds.has(id)
    ) {
      chatbotOut.add(id);
    }
  });

  chatbotApiIds.forEach((id) => waitingOut.delete(id));
  waitingApiIds.forEach((id) => {
    if (!chatbotApiIds.has(id)) chatbotOut.delete(id);
  });

  waitingOut.forEach((id) => {
    if (!chatbotOut.has(id)) return;
    if (chatbotApiIds.has(id)) {
      waitingOut.delete(id);
      return;
    }
    if (waitingApiIds.has(id)) {
      chatbotOut.delete(id);
      return;
    }
    chatbotOut.delete(id);
  });

  const byId = ticketByIdMap(
    waitingPrevList,
    chatbotPrevList,
    waitingKnown ? waitingApiTickets : [],
    chatbotKnown ? chatbotApiTickets : []
  );

  return {
    waiting: listFromIdSet(
      waitingOut,
      [waitingKnown ? waitingApiTickets : [], waitingPrevList, chatbotPrevList],
      byId
    ),
    chatbot: listFromIdSet(
      chatbotOut,
      [chatbotKnown ? chatbotApiTickets : [], chatbotPrevList, waitingPrevList],
      byId
    ),
    waitingApiIds,
    chatbotApiIds,
  };
}

export function pendingColumnIds(list) {
  return toTicketIdSet(list);
}

export function hasPendingColumnOverlap(waiting, chatbot) {
  const waitingIds = toTicketIdSet(waiting);
  const chatbotIds = toTicketIdSet(chatbot);
  for (const id of waitingIds) {
    if (chatbotIds.has(id)) return true;
  }
  return false;
}
