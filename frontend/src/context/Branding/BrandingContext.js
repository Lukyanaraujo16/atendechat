import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { openApi } from "../../services/api";
import { getApiUrl } from "../../config/backendUrl";
import { nomeEmpresa as packageName } from "../../../package.json";
import defaultLogo from "../../assets/logo.png";

function resolveStoredLogoUrl(raw) {
  const u = raw?.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return getApiUrl(u);
  return u;
}

const defaultBranding = {
  systemName: packageName || "Atendechat",
  loginLogoUrl: "",
  menuLogoUrl: "",
};

const BrandingContext = createContext({
  branding: defaultBranding,
  loading: true,
  error: null,
  refreshBranding: async () => {},
  /** URL final do logo login (API ou asset padrão) */
  resolveLoginLogo: () => defaultLogo,
  /** URL final do logo menu */
  resolveMenuLogo: () => defaultLogo,
});

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBranding = useCallback(async () => {
    try {
      const { data } = await openApi.get("/system-settings/branding");
      setBranding({
        systemName: data?.systemName || defaultBranding.systemName,
        loginLogoUrl: data?.loginLogoUrl ?? "",
        menuLogoUrl: data?.menuLogoUrl ?? "",
      });
      setError(null);
    } catch (e) {
      setError(e);
      setBranding(defaultBranding);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  useEffect(() => {
    const name = branding.systemName || defaultBranding.systemName;
    if (typeof document !== "undefined") {
      document.title = name;
    }
  }, [branding.systemName]);

  const resolveLoginLogo = useCallback(() => {
    return resolveStoredLogoUrl(branding.loginLogoUrl) || defaultLogo;
  }, [branding.loginLogoUrl]);

  const resolveMenuLogo = useCallback(() => {
    return resolveStoredLogoUrl(branding.menuLogoUrl) || defaultLogo;
  }, [branding.menuLogoUrl]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      error,
      refreshBranding: fetchBranding,
      resolveLoginLogo,
      resolveMenuLogo,
    }),
    [branding, loading, error, fetchBranding, resolveLoginLogo, resolveMenuLogo]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

export default BrandingContext;
