import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";

/**
 * Busca tickets na API. Sem debounce aqui: debounce de busca fica no componente
 * (ex.: TicketsManagerTabs) para não atrasar troca de abas/filtros.
 * Cancela respostas obsoletas quando os parâmetros mudam antes do fim da requisição.
 */
const useTickets = ({
  searchParam,
  tags,
  contactLabels,
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  isGroup,
  chatbot,
  countOnly,
  /** Quando false, não busca (ex.: inbox inativa na guia principal). */
  enabled = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(0);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    if (!countOnly) {
      setTickets([]);
    }

    const fetchTickets = async () => {
      try {
        const params = { pageNumber };
        const trimmedSearch =
          searchParam != null && String(searchParam).trim() !== ""
            ? String(searchParam).trim()
            : "";
        if (trimmedSearch) params.searchParam = trimmedSearch;
        if (status) params.status = status;
        if (date) params.date = date;
        if (updatedAt) params.updatedAt = updatedAt;
        if (showAll != null && showAll !== "") params.showAll = showAll;
        if (withUnreadMessages) params.withUnreadMessages = withUnreadMessages;
        if (isGroup) params.isGroup = isGroup;
        if (chatbot === "true" || chatbot === "false") params.chatbot = chatbot;
        if (countOnly) params.countOnly = true;
        if (queueIds != null && queueIds !== "") params.queueIds = queueIds;
        if (tags != null && tags !== "" && tags !== "[]") params.tags = tags;
        if (
          contactLabels != null &&
          contactLabels !== "" &&
          contactLabels !== "[]"
        ) {
          params.contactLabels = contactLabels;
        }
        if (users != null && users !== "" && users !== "[]") params.users = users;

        const { data } = await api.get("/tickets", { params });
        if (cancelled) return;
        setCount(typeof data.count === "number" ? data.count : 0);
        if (!countOnly) {
          setTickets(Array.isArray(data.tickets) ? data.tickets : []);
          setHasMore(Boolean(data.hasMore));
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        toastError(err);
      }
    };

    fetchTickets();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    searchParam,
    tags,
    contactLabels,
    users,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
    isGroup,
    chatbot,
    countOnly,
  ]);

  return { tickets, loading, hasMore, count };
};

export default useTickets;
