import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import {
  CEP_LOOKUP_DEBOUNCE_MS,
  VIACEP_TIMEOUT_MS,
  fetchViaCep,
  formatCepDisplay,
  sanitizeCepDigits,
} from "../utils/cepLookup";

/**
 * Lookup ViaCEP com debounce, AbortController, timeout, cache em sessão e proteção stale.
 *
 * Não consulta no mount — só quando `lookup(rawCep)` é chamado com 8 dígitos.
 */
export default function useCepLookup({
  enabled = true,
  debounceMs = CEP_LOOKUP_DEBOUNCE_MS,
  timeoutMs = VIACEP_TIMEOUT_MS,
  onSuccess,
} = {}) {
  const [status, setStatus] = useState("idle");
  const mountedRef = useRef(true);
  const seqRef = useRef(0);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const cacheRef = useRef(new Map());
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const resetStatus = useCallback(() => {
    if (mountedRef.current) setStatus("idle");
  }, []);

  const cancel = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore
      }
      abortRef.current = null;
    }
    seqRef.current += 1;
  }, []);

  const runLookup = useCallback(
    async (digits, sequence) => {
      if (!enabled) return;

      const cached = cacheRef.current.get(digits);
      if (cached) {
        if (!mountedRef.current || sequence !== seqRef.current) return;
        setStatus(cached.status);
        if (cached.status === "success" && cached.address && onSuccessRef.current) {
          onSuccessRef.current(cached.address, digits);
        }
        return;
      }

      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {
          // ignore
        }
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (mountedRef.current) setStatus("loading");

      try {
        const result = await fetchViaCep(digits, {
          timeoutMs,
          signal: controller.signal,
          httpGet: (url, cfg) => axios.get(url, cfg),
        });

        if (!mountedRef.current || sequence !== seqRef.current) return;

        if (result.status === "success") {
          cacheRef.current.set(digits, {
            status: "success",
            address: result.address,
          });
          setStatus("success");
          if (onSuccessRef.current) {
            onSuccessRef.current(result.address, digits);
          }
          return;
        }

        if (result.status === "not_found") {
          cacheRef.current.set(digits, { status: "not_found", address: null });
          setStatus("not_found");
          return;
        }

        setStatus("error");
      } catch (err) {
        if (!mountedRef.current || sequence !== seqRef.current) return;
        if (
          axios.isCancel?.(err) ||
          err?.code === "ERR_CANCELED" ||
          err?.name === "CanceledError" ||
          err?.name === "AbortError"
        ) {
          return;
        }
        setStatus("error");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [enabled, timeoutMs]
  );

  const lookup = useCallback(
    (rawCep) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const digits = sanitizeCepDigits(rawCep);
      if (!enabled || digits.length !== 8) {
        // CEP incompleto: cancela pendente e volta idle (sem erro enquanto digita).
        cancel();
        if (mountedRef.current && digits.length < 8) {
          setStatus("idle");
        }
        return formatCepDisplay(rawCep);
      }

      const sequence = ++seqRef.current;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runLookup(digits, sequence);
      }, debounceMs);

      return formatCepDisplay(digits);
    },
    [cancel, debounceMs, enabled, runLookup]
  );

  return {
    status,
    lookup,
    cancel,
    resetStatus,
    formatCepDisplay,
    sanitizeCepDigits,
  };
}

export function cepLookupHelperText(status, t) {
  if (status === "loading") {
    return t("cepLookup.loading");
  }
  if (status === "not_found") {
    return t("cepLookup.notFound");
  }
  if (status === "error" || status === "invalid") {
    return t("cepLookup.error");
  }
  return undefined;
}
