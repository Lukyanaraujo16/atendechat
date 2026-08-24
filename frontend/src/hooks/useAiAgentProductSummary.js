/**
 * Hook — Product API summary (Fases 2.1–2.9B / 2.21C).
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

function isArchived(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  return code === "ERR_AI_AGENT_PRODUCT_ARCHIVED";
}

const idleState = {
  loading: false,
  error: null,
  accessDenied: false,
  notFound: false,
  archived: false,
  data: null,
};

export default function useAiAgentProductSummary({
  enabled = true,
  agentRef = null,
} = {}) {
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId ?? null;
  const agentRefKey = agentRef != null ? String(agentRef).trim() : "";
  const [state, setState] = useState({
    ...idleState,
    loading: Boolean(enabled),
  });
  const mounted = useRef(true);
  const requestId = useRef(0);

  const applySummary = useCallback((payload) => {
    if (!mounted.current) return;
    if (agentRefKey && payload?.agent) {
      const incoming =
        payload.agent.agentRef != null
          ? String(payload.agent.agentRef)
          : payload.agent.id != null
            ? String(payload.agent.id)
            : "";
      if (incoming && incoming !== agentRefKey) return;
    }
    setState((prev) => ({
      ...prev,
      ...idleState,
      data: mapAiAgentProductSummary(payload, {
        agentRef: agentRefKey || undefined,
      }),
    }));
  }, [agentRefKey]);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({ ...idleState });
      return;
    }

    const rid = ++requestId.current;
    setState((prev) => ({
      ...prev,
      ...idleState,
      loading: true,
    }));

    try {
      const { data } = await getAiAgentProductSummary(
        agentRefKey || undefined
      );
      if (!mounted.current || rid !== requestId.current) return;
      setState({
        ...idleState,
        data: mapAiAgentProductSummary(data, {
          agentRef: agentRefKey || undefined,
        }),
      });
    } catch (err) {
      if (!mounted.current || rid !== requestId.current) return;
      if (isForbidden(err)) {
        setState({ ...idleState, accessDenied: true });
        return;
      }
      if (isArchived(err)) {
        setState({ ...idleState, notFound: true, archived: true });
        return;
      }
      if (isNotFound(err)) {
        setState({ ...idleState, notFound: true });
        return;
      }
      setState({ ...idleState, error: err });
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
