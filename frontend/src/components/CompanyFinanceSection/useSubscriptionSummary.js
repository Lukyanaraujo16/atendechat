import { useCallback, useEffect, useRef, useState } from "react";

import api from "../../services/api";
import { isNotFoundRoute } from "./financeFormat";

/**
 * Carrega a Central de assinatura (C3): GET /saas/companies/:companyId/subscription.
 * Nunca exibe toast: quem renderiza decide como mostrar `unavailable`/`error`.
 * Retorna { data, loading, unavailable, error, reload }.
 */
export default function useSubscriptionSummary(companyId, { enabled = true } = {}) {
  const [state, setState] = useState({
    data: null,
    loading: Boolean(enabled && companyId),
    unavailable: false,
    error: null,
  });
  const aliveRef = useRef(true);
  const seqRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || !companyId) return null;
    const seq = ++seqRef.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const { data } = await api.get(`/saas/companies/${companyId}/subscription`);
      if (aliveRef.current && seq === seqRef.current) {
        setState({ data: data || null, loading: false, unavailable: false, error: null });
      }
      return data || null;
    } catch (err) {
      if (aliveRef.current && seq === seqRef.current) {
        setState({
          data: null,
          loading: false,
          unavailable: isNotFoundRoute(err),
          error: isNotFoundRoute(err) ? null : err,
        });
      }
      return null;
    }
  }, [companyId, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
