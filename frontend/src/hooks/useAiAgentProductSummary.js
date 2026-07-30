/**
 * Hook — Product API summary (Fases 2.1–2.9B).
 * Com agentRef: summary do agente. Sem agentRef: compat 0/1 agente.
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { getAiAgentProductSummary } from "../services/aiAgentProductApi";
import { mapAiAgentProductSummary } from "../utils/aiAgentProductMapper";

function isForbidden(err) {
  return err?.response?.status === 403;
}

function isNotFound(err) {
  return err?.response?.status === 404;
}

export default function useAiAgentProductSummary({
  enabled = true,
  agentRef = null,
} = {}) {
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId ?? null;
  const agentRefKey = agentRef != null ? String(agentRef).trim() : "";
  const [state, setState] = useState({
    loading: Boolean(enabled),
    error: null,
    accessDenied: false,
    notFound: false,
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
      notFound: false,
      data: mapAiAgentProductSummary(payload, {
        agentRef: agentRefKey || undefined,
      }),
    }));
  }, [agentRefKey]);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        notFound: false,
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
      notFound: false,
      data: null,
    }));

    try {
      const { data } = await getAiAgentProductSummary(
        agentRefKey || undefined
      );
      if (!mounted.current || rid !== requestId.current) return;
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        notFound: false,
        data: mapAiAgentProductSummary(data, {
          agentRef: agentRefKey || undefined,
        }),
      });
    } catch (err) {
      if (!mounted.current || rid !== requestId.current) return;
      if (isForbidden(err)) {
        setState({
          loading: false,
          error: null,
          accessDenied: true,
          notFound: false,
          data: null,
        });
        return;
      }
      if (isNotFound(err)) {
        setState({
          loading: false,
          error: null,
          accessDenied: false,
          notFound: true,
          data: null,
        });
        return;
      }
      setState({
        loading: false,
        error: err,
        accessDenied: false,
        notFound: false,
        data: null,
      });
    }
  }, [enabled, companyId, agentRefKey]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { ...state, reload, applySummary, companyId, agentRef: agentRefKey };
}
