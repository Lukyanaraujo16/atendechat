import { useState, useCallback, useEffect, useRef } from "react";
import {
  getAiAgentProductConfiguration,
  getAiAgentProductConfigurationOptions,
  postAiAgentProductConfiguration,
  postAiAgentProductConfigurationPreview,
  putAiAgentProductConfiguration,
  putAiAgentProductConnections,
} from "../services/aiAgentProductApi";

export function useAiAgentProductConfiguration(
  companyId = null,
  agentRef = null
) {
  const [configuration, setConfiguration] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const tenantRef = useRef(companyId);
  const agentRefKey = agentRef != null ? String(agentRef).trim() : "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearCache = useCallback(() => {
    if (!mountedRef.current) return;
    setConfiguration(null);
    setOptions(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tenantRef.current !== companyId) {
      tenantRef.current = companyId;
      clearCache();
    }
  }, [clearCache, companyId]);

  const errorValue = (err) =>
    err?.response?.data?.error || err?.message || "unknown";

  const applyMutationResult = useCallback((result) => {
    if (!mountedRef.current || !result) return result;
    setConfiguration((current) => ({
      ...(current || {}),
      agentScope:
        result.agentScope ||
        current?.agentScope ||
        (result.configuration ? { type: "single", count: 1 } : null),
      agentRef:
        result.agentRef != null
          ? String(result.agentRef)
          : current?.agentRef || agentRefKey || null,
      configuration:
        result.configuration !== undefined
          ? result.configuration
          : current?.configuration || null,
      summary:
        result.summary !== undefined ? result.summary : current?.summary || null,
      editableWhileActive:
        result.editableWhileActive !== undefined
          ? result.editableWhileActive
          : current?.editableWhileActive,
    }));
    return result;
  }, [agentRefKey]);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfiguration(
        agentRefKey || undefined
      );
      if (mountedRef.current) {
        setConfiguration(data);
      }
      return data;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [agentRefKey]);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfigurationOptions(
        agentRefKey || undefined
      );
      if (mountedRef.current) {
        setOptions(data);
      }
      return data;
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [agentRefKey]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configurationData, optionsData] = await Promise.all([
        getAiAgentProductConfiguration(agentRefKey || undefined),
        getAiAgentProductConfigurationOptions(agentRefKey || undefined),
      ]);
      if (mountedRef.current) {
        setConfiguration(configurationData);
        setOptions(optionsData);
      }
      return { configuration: configurationData, options: optionsData };
    } catch (err) {
      if (mountedRef.current) setError(errorValue(err));
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [agentRefKey]);

  const mutate = useCallback(
    async (operation) => {
      setLoading(true);
      setError(null);
      try {
        const result = await operation();
        return applyMutationResult(result);
      } catch (err) {
        if (mountedRef.current) setError(errorValue(err));
        throw err;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [applyMutationResult]
  );

  const create = useCallback(
    (payload) => mutate(() => postAiAgentProductConfiguration(payload)),
    [mutate]
  );

  const update = useCallback(
    (payload) =>
      mutate(() =>
        putAiAgentProductConfiguration(payload, agentRefKey || undefined)
      ),
    [mutate, agentRefKey]
  );

  const updateConnections = useCallback(
    (payload) =>
      mutate(() =>
        putAiAgentProductConnections(payload, agentRefKey || undefined)
      ),
    [mutate, agentRefKey]
  );

  const preview = useCallback(
    (payload) => postAiAgentProductConfigurationPreview(payload),
    []
  );

  return {
    configuration,
    options,
    loading,
    error,
    loadConfiguration,
    loadOptions,
    loadAll,
    create,
    update,
    updateConnections,
    preview,
    clearCache,
    applyMutationResult,
    agentRef: agentRefKey,
  };
}
