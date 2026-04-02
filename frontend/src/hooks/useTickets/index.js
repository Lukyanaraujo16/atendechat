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
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  isGroup,
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchTickets = async () => {
      try {
        const { data } = await api.get("/tickets", {
          params: {
            searchParam,
            pageNumber,
            tags,
            users,
            status,
            date,
            updatedAt,
            showAll,
            queueIds,
            withUnreadMessages,
            isGroup,
          },
        });
        if (cancelled) return;
        setTickets(Array.isArray(data.tickets) ? data.tickets : []);
        setHasMore(data.hasMore);
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
    searchParam,
    tags,
    users,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
    isGroup,
  ]);

  return { tickets, loading, hasMore };
};

export default useTickets;
