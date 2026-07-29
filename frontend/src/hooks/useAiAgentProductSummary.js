/**
 * Hook — Product API summary (Fases 2.1–2.2).
 * Não recalcula readiness. Invalida ao trocar companyId. 403 limpa dados.
 * applySummary atualiza a partir da resposta de comando (sem optimistic mode).
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { getAiAgentProductSummary } from "../services/aiAgentProductApi";
import { mapAiAgentProductSummary } from "../utils/aiAgentProductMapper";

function isForbidden(err) {
  return err?.response?.status === 403;
}

export default function useAiAgentProductSummary({ enabled = true } = {}) {
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId ?? null;
  const [state, setState] = useState({
    loading: Boolean(enabled),
    error: null,
    accessDenied: false,
    data: null,
  });
  const mounted = useRef(true);
  const requestId = useRef(0);

  const applySummary = useCallback((payload) => {
    if (!mounted.current) return;
    setState((prev) => ({
      ...prev,
      loading: false,
      error: null,
      accessDenied: false,
      data: mapAiAgentProductSummary(payload),
    }));
  }, []);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        data: null,
      });
      return;
    }

    const rid = ++requestId.current;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      accessDenied: false,
      data: null,
    }));

    try {
      const { data } = await getAiAgentProductSummary();
      if (!mounted.current || rid !== requestId.current) return;
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        data: mapAiAgentProductSummary(data),
      });
    } catch (err) {
      if (!mounted.current || rid !== requestId.current) return;
      if (isForbidden(err)) {
        setState({
          loading: false,
          error: null,
          accessDenied: true,
          data: null,
        });
        return;
      }
      setState({
        loading: false,
        error: err,
        accessDenied: false,
        data: null,
      });
    }
  }, [enabled, companyId]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { ...state, reload, applySummary, companyId };
}
