import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { openApi } from "../../services/api";
import { getApiUrl } from "../../config/backendUrl";
import defaultLogo from "../../assets/logo.png";

function resolveStoredLogoUrl(raw) {
  const u = raw?.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return getApiUrl(u);
  return u;
}

function defaultFaviconAbsoluteHref() {
  if (typeof window === "undefined") return "/favicon.ico";
  const base = process.env.PUBLIC_URL || "";
  return `${window.location.origin}${base}/favicon.ico`;
}

/** Estado base quando não há bootstrap nem API (sem nome de marca embutido). */
const emptyBranding = {
  systemName: "",
  loginLogoUrl: "",
  menuLogoUrl: "",
  faviconUrl: "",
  publicWhatsAppNumber: "",
  publicWhatsAppMessage: ""
};

function readBootstrapBranding() {
  if (typeof window === "undefined" || !window.__BOOTSTRAP_BRANDING__) {
    return null;
  }
  const w = window.__BOOTSTRAP_BRANDING__;
  return {
    systemName: w.systemName != null ? String(w.systemName) : "",
    loginLogoUrl: w.loginLogoUrl != null ? String(w.loginLogoUrl) : "",
    menuLogoUrl: w.menuLogoUrl != null ? String(w.menuLogoUrl) : "",
    faviconUrl: w.faviconUrl != null ? String(w.faviconUrl) : "",
    publicWhatsAppNumber: w.publicWhatsAppNumber != null ? String(w.publicWhatsAppNumber) : "",
    publicWhatsAppMessage: w.publicWhatsAppMessage != null ? String(w.publicWhatsAppMessage) : ""
  };
}

const BrandingContext = createContext({
  branding: emptyBranding,
  loading: true,
  error: null,
  refreshBranding: async () => {},
  resolveLoginLogo: () => defaultLogo,
  resolveMenuLogo: () => defaultLogo,
  resolveFavicon: () => defaultFaviconAbsoluteHref()
});

export function BrandingProvider({ children }) {
  const [bootstrapSnapshot] = useState(() => readBootstrapBranding());
  const [branding, setBranding] = useState(() =>
    bootstrapSnapshot ? { ...emptyBranding, ...bootstrapSnapshot } : emptyBranding
  );
  const [loading, setLoading] = useState(() => !bootstrapSnapshot);
  const [error, setError] = useState(null);

  const fetchBranding = useCallback(async () => {
    try {
      const { data } = await openApi.get("/system-settings/branding");
      setBranding({
        systemName: data?.systemName != null ? String(data.systemName) : "",
        loginLogoUrl: data?.loginLogoUrl ?? "",
        menuLogoUrl: data?.menuLogoUrl ?? "",
        faviconUrl: data?.faviconUrl ?? "",
        publicWhatsAppNumber: data?.publicWhatsAppNumber ?? "",
        publicWhatsAppMessage: data?.publicWhatsAppMessage ?? ""
      });
      setError(null);
    } catch (e) {
      setError(e);
      if (!bootstrapSnapshot) {
        setBranding(emptyBranding);
      }
    } finally {
      setLoading(false);
    }
  }, [bootstrapSnapshot]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  useEffect(() => {
    const name = (branding.systemName || "").trim();
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

  const resolveFavicon = useCallback(() => {
    return resolveStoredLogoUrl(branding.faviconUrl) || defaultFaviconAbsoluteHref();
  }, [branding.faviconUrl]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const href = resolveFavicon();
    ["icon", "shortcut icon"].forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", href);
    });
  }, [resolveFavicon]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      error,
      refreshBranding: fetchBranding,
      resolveLoginLogo,
      resolveMenuLogo,
      resolveFavicon
    }),
    [branding, loading, error, fetchBranding, resolveLoginLogo, resolveMenuLogo, resolveFavicon]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

export default BrandingContext;
