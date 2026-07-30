/**
 * Hook — listagem comercial de agentes (Fase 2.9B).
 * agentRef permanece string; sem seleção implícita pelo primeiro item.
 */
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { listAiAgentProductAgents } from "../services/aiAgentProductApi";

function isForbidden(err) {
  return err?.response?.status === 403;
}

export default function useAiAgentProductAgents({ enabled = true } = {}) {
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId ?? null;
  const [state, setState] = useState({
    loading: Boolean(enabled),
    error: null,
    accessDenied: false,
    agents: [],
  });
  const mounted = useRef(true);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        agents: [],
      });
      return [];
    }

    const rid = ++requestId.current;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      accessDenied: false,
    }));

    try {
      const data = await listAiAgentProductAgents();
      if (!mounted.current || rid !== requestId.current) return data.agents;
      setState({
        loading: false,
        error: null,
        accessDenied: false,
        agents: data.agents,
      });
      return data.agents;
    } catch (err) {
      if (!mounted.current || rid !== requestId.current) return [];
      if (isForbidden(err)) {
        setState({
          loading: false,
          error: null,
          accessDenied: true,
          agents: [],
        });
        return [];
      }
      setState({
        loading: false,
        error: err,
        accessDenied: false,
        agents: [],
      });
      return [];
    }
  }, [enabled, companyId]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { ...state, reload, companyId };
}
