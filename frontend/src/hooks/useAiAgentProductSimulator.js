import { useState, useCallback, useEffect, useRef } from "react";
import {
  getAiAgentProductSimulator,
  createAiAgentProductSimulatorSession,
  getAiAgentProductSimulatorSession,
  sendAiAgentProductSimulatorMessage,
  endAiAgentProductSimulatorSession,
  reviewAiAgentProductSimulatorMessage,
} from "../services/aiAgentProductApi";

export function useAiAgentProductSimulator(companyId = null) {
  const [bootstrap, setBootstrap] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const tenantRef = useRef(companyId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearCache = useCallback(() => {
    if (!mountedRef.current) return;
    setBootstrap(null);
    setSession(null);
    setMessages([]);
    setError(null);
    setLoading(false);
    setBootLoading(true);
  }, []);

  useEffect(() => {
    if (tenantRef.current !== companyId) {
      tenantRef.current = companyId;
      clearCache();
    }
  }, [clearCache, companyId]);

  const loadBootstrap = useCallback(async () => {
    setBootLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductSimulator();
      if (!mountedRef.current) return data;
      setBootstrap(data);
      return data;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setBootLoading(false);
    }
  }, []);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const created = await createAiAgentProductSimulatorSession();
      const full = await getAiAgentProductSimulatorSession(created.ref);
      if (!mountedRef.current) return full;
      setSession(full);
      setMessages(full.messages || []);
      return full;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (sessionRef, content) => {
    setLoading(true);
    setError(null);
    try {
      const data = await sendAiAgentProductSimulatorMessage(sessionRef, content);
      if (!mountedRef.current) return data;
      setMessages((prev) => [
        ...prev,
        data.userMessage,
        data.assistantMessage,
      ]);
      setSession((prev) => ({ ...(prev || {}), ...(data.session || {}) }));
      return data;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const restartSession = useCallback(async (currentSession) => {
    setLoading(true);
    setError(null);
    try {
      if (currentSession?.ref && currentSession.status === "active") {
        await endAiAgentProductSimulatorSession(currentSession.ref);
      }
      const created = await createAiAgentProductSimulatorSession();
      const full = await getAiAgentProductSimulatorSession(created.ref);
      if (!mountedRef.current) return full;
      setSession(full);
      setMessages(full.messages || []);
      return full;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const reviewMessage = useCallback(async (messageRef, body) => {
    const data = await reviewAiAgentProductSimulatorMessage(messageRef, body);
    if (mountedRef.current) {
      setMessages((prev) =>
        prev.map((item) =>
          item.ref === messageRef ? { ...item, review: data } : item
        )
      );
    }
    return data;
  }, []);

  return {
    bootstrap,
    session,
    messages,
    loading,
    bootLoading,
    error,
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
