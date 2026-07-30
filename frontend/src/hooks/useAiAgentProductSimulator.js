import { useState, useCallback, useEffect, useRef } from "react";
import {
  getAiAgentProductSimulator,
  createAiAgentProductSimulatorSession,
  getAiAgentProductSimulatorSession,
  sendAiAgentProductSimulatorMessage,
  endAiAgentProductSimulatorSession,
  reviewAiAgentProductSimulatorMessage,
} from "../services/aiAgentProductApi";

/**
 * Product Simulator — agentRef obrigatório para isolamento (Fase 2.9C).
 * @param {string|number|null} companyId
 * @param {string|null} agentRef
 */
export function useAiAgentProductSimulator(companyId = null, agentRef = null) {
  const [bootstrap, setBootstrap] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const tenantRef = useRef(companyId);
  const agentRefKey = agentRef != null ? String(agentRef).trim() : "";
  const agentKeyRef = useRef(agentRefKey);
  const requestGen = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearCache = useCallback(() => {
    requestGen.current += 1;
    if (!mountedRef.current) return;
    setBootstrap(null);
    setSession(null);
    setMessages([]);
    setError(null);
    setLoading(false);
    setBootLoading(Boolean(agentRefKey));
  }, [agentRefKey]);

  useEffect(() => {
    if (tenantRef.current !== companyId) {
      tenantRef.current = companyId;
      clearCache();
    }
  }, [clearCache, companyId]);

  useEffect(() => {
    if (agentKeyRef.current !== agentRefKey) {
      agentKeyRef.current = agentRefKey;
      clearCache();
    }
  }, [agentRefKey, clearCache]);

  const loadBootstrap = useCallback(async () => {
    if (!agentRefKey) {
      setBootLoading(false);
      setBootstrap(null);
      setError("ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED");
      return null;
    }
    const gen = ++requestGen.current;
    setBootLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductSimulator(agentRefKey);
      if (!mountedRef.current || gen !== requestGen.current) return data;
      setBootstrap(data);
      return data;
    } catch (err) {
      if (mountedRef.current && gen === requestGen.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current && gen === requestGen.current) {
        setBootLoading(false);
      }
    }
  }, [agentRefKey]);

  const startSession = useCallback(async () => {
    if (!agentRefKey) {
      throw new Error("ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED");
    }
    const gen = requestGen.current;
    setLoading(true);
    setError(null);
    try {
      const created = await createAiAgentProductSimulatorSession(agentRefKey);
      const full = await getAiAgentProductSimulatorSession(
        created.ref,
        agentRefKey
      );
      if (!mountedRef.current || gen !== requestGen.current) return full;
      setSession(full);
      setMessages(full.messages || []);
      return full;
    } catch (err) {
      if (mountedRef.current && gen === requestGen.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current && gen === requestGen.current) {
        setLoading(false);
      }
    }
  }, [agentRefKey]);

  const sendMessage = useCallback(
    async (sessionRef, content) => {
      if (!agentRefKey) {
        throw new Error("ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED");
      }
      const gen = requestGen.current;
      setLoading(true);
      setError(null);
      try {
        const data = await sendAiAgentProductSimulatorMessage(
          sessionRef,
          content,
          agentRefKey
        );
        if (!mountedRef.current || gen !== requestGen.current) return data;
        setMessages((prev) => [
          ...prev,
          data.userMessage,
          data.assistantMessage,
        ]);
        setSession((prev) => ({ ...(prev || {}), ...(data.session || {}) }));
        return data;
      } catch (err) {
        if (mountedRef.current && gen === requestGen.current) {
          setError(err?.response?.data?.error || err?.message || "unknown");
        }
        throw err;
      } finally {
        if (mountedRef.current && gen === requestGen.current) {
          setLoading(false);
        }
      }
    },
    [agentRefKey]
  );

  const restartSession = useCallback(
    async (currentSession) => {
      if (!agentRefKey) {
        throw new Error("ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED");
      }
      const gen = requestGen.current;
      setLoading(true);
      setError(null);
      try {
        if (currentSession?.ref && currentSession.status === "active") {
          await endAiAgentProductSimulatorSession(
            currentSession.ref,
            agentRefKey
          );
        }
        const created = await createAiAgentProductSimulatorSession(agentRefKey);
        const full = await getAiAgentProductSimulatorSession(
          created.ref,
          agentRefKey
        );
        if (!mountedRef.current || gen !== requestGen.current) return full;
        setSession(full);
        setMessages(full.messages || []);
        return full;
      } catch (err) {
        if (mountedRef.current && gen === requestGen.current) {
          setError(err?.response?.data?.error || err?.message || "unknown");
        }
        throw err;
      } finally {
        if (mountedRef.current && gen === requestGen.current) {
          setLoading(false);
        }
      }
    },
    [agentRefKey]
  );

  const reviewMessage = useCallback(
    async (messageRef, body) => {
      if (!agentRefKey) {
        throw new Error("ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED");
      }
      const gen = requestGen.current;
      const data = await reviewAiAgentProductSimulatorMessage(
        messageRef,
        body,
        agentRefKey
      );
      if (mountedRef.current && gen === requestGen.current) {
        setMessages((prev) =>
          prev.map((item) =>
            item.ref === messageRef ? { ...item, review: data } : item
          )
        );
      }
      return data;
    },
    [agentRefKey]
  );

  return {
    bootstrap,
    session,
    messages,
    loading,
    bootLoading,
    error,
    agentRef: agentRefKey,
    loadBootstrap,
    startSession,
    sendMessage,
    restartSession,
    reviewMessage,
    setMessages,
    setSession,
    clearCache,
  };
}

export default useAiAgentProductSimulator;
