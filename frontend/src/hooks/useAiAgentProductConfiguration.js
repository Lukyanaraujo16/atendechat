import { useState, useCallback, useRef } from "react";
import {
  getAiAgentProductConfiguration,
  getAiAgentProductConfigurationOptions,
} from "../services/aiAgentProductApi";

export function useAiAgentProductConfiguration() {
  const [configuration, setConfiguration] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfiguration();
      if (mountedRef.current) {
        setConfiguration(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfigurationOptions();
      if (mountedRef.current) {
        setOptions(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.error || err?.message || "unknown");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  return {
    configuration,
    options,
    loading,
    error,
    loadConfiguration,
    loadOptions,
  };
}
