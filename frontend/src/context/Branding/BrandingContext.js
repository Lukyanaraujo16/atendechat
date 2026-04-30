import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "@material-ui/core/styles";
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

function defaultAppleTouchAbsoluteHref() {
  if (typeof window === "undefined") return "/android-chrome-192x192.png";
  const base = process.env.PUBLIC_URL || "";
  return `${window.location.origin}${base}/android-chrome-192x192.png`;
}

function guessIconMime(absHref) {
  const pure = String(absHref).split("?")[0].toLowerCase();
  if (pure.endsWith(".svg")) return "image/svg+xml";
  if (pure.endsWith(".png")) return "image/png";
  if (pure.endsWith(".ico")) return "image/x-icon";
  if (pure.endsWith(".jpg") || pure.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

function removeAllTabIconLinks() {
  document
    .querySelectorAll(
      'link[rel="mask-icon"],link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"]'
    )
    .forEach((el) => el.remove());
}

function appendIconLink(rel, href, mime) {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);
  if (mime && rel === "icon") link.setAttribute("type", mime);
  document.head.appendChild(link);
}

/**
 * Alinha ao branding-bootstrap.js: favicon de Branding ganha da aba; senão repõe o fallback PWA do index.html.
 */
function applyTabIconsFromBranding(faviconUrlRaw, assetRevision) {
  if (typeof document === "undefined") return;
  const rev =
    assetRevision != null && String(assetRevision).trim() !== "" ? String(assetRevision) : "0";
  const customRaw = String(faviconUrlRaw || "").trim();
  removeAllTabIconLinks();
  if (customRaw) {
    const fav = resolveStoredLogoUrl(customRaw);
    if (!fav) return;
    const sep = fav.includes("?") ? "&" : "?";
    const href = `${fav}${sep}v=${encodeURIComponent(rev)}`;
    const ty = guessIconMime(fav);
    ["icon", "shortcut icon", "apple-touch-icon"].forEach((rel) => appendIconLink(rel, href, ty));
    return;
  }
  const icon = defaultFaviconAbsoluteHref();
  const apple = defaultAppleTouchAbsoluteHref();
  const iconTy = guessIconMime(icon);
  appendIconLink("icon", icon, iconTy);
  appendIconLink("shortcut icon", icon, iconTy);
  appendIconLink("apple-touch-icon", apple, "image/png");
}

/** Estado base quando não há bootstrap nem API (sem nome de marca embutido). */
const emptyBranding = {
  systemName: "",
  loginLogoUrl: "",
  loginLogoDarkUrl: "",
  menuLogoUrl: "",
  menuLogoDarkUrl: "",
  faviconUrl: "",
  publicWhatsAppNumber: "",
  publicWhatsAppMessage: "",
  assetRevision: "0"
};

function readBootstrapBranding() {
  if (typeof window === "undefined" || !window.__BOOTSTRAP_BRANDING__) {
    return null;
  }
  const w = window.__BOOTSTRAP_BRANDING__;
  return {
    systemName: w.systemName != null ? String(w.systemName) : "",
    loginLogoUrl: w.loginLogoUrl != null ? String(w.loginLogoUrl) : "",
    loginLogoDarkUrl: w.loginLogoDarkUrl != null ? String(w.loginLogoDarkUrl) : "",
    menuLogoUrl: w.menuLogoUrl != null ? String(w.menuLogoUrl) : "",
    menuLogoDarkUrl: w.menuLogoDarkUrl != null ? String(w.menuLogoDarkUrl) : "",
    faviconUrl: w.faviconUrl != null ? String(w.faviconUrl) : "",
    publicWhatsAppNumber: w.publicWhatsAppNumber != null ? String(w.publicWhatsAppNumber) : "",
    publicWhatsAppMessage: w.publicWhatsAppMessage != null ? String(w.publicWhatsAppMessage) : "",
    assetRevision: w.assetRevision != null ? String(w.assetRevision) : "0"
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
  const theme = useTheme();
  const isDarkMode = theme.palette.type === "dark";
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
        loginLogoDarkUrl: data?.loginLogoDarkUrl ?? "",
        menuLogoUrl: data?.menuLogoUrl ?? "",
        menuLogoDarkUrl: data?.menuLogoDarkUrl ?? "",
        faviconUrl: data?.faviconUrl ?? "",
        publicWhatsAppNumber: data?.publicWhatsAppNumber ?? "",
        publicWhatsAppMessage: data?.publicWhatsAppMessage ?? "",
        assetRevision:
          data?.assetRevision != null && String(data.assetRevision).trim() !== ""
            ? String(data.assetRevision)
            : "0"
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
    const light = resolveStoredLogoUrl(branding.loginLogoUrl);
    const dark = resolveStoredLogoUrl(branding.loginLogoDarkUrl);
    if (isDarkMode && dark) return dark;
    return light || defaultLogo;
  }, [branding.loginLogoUrl, branding.loginLogoDarkUrl, isDarkMode]);

  const resolveMenuLogo = useCallback(() => {
    const light = resolveStoredLogoUrl(branding.menuLogoUrl);
    const dark = resolveStoredLogoUrl(branding.menuLogoDarkUrl);
    if (isDarkMode && dark) return dark;
    return light || defaultLogo;
  }, [branding.menuLogoUrl, branding.menuLogoDarkUrl, isDarkMode]);

  const resolveFavicon = useCallback(() => {
    const raw = resolveStoredLogoUrl(branding.faviconUrl);
    const fallback = defaultFaviconAbsoluteHref();
    const base = raw || fallback;
    if (!raw) return base;
    const rev = branding.assetRevision || "0";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}v=${encodeURIComponent(rev)}`;
  }, [branding.faviconUrl, branding.assetRevision]);

  useEffect(() => {
    applyTabIconsFromBranding(branding.faviconUrl, branding.assetRevision);
  }, [branding.faviconUrl, branding.assetRevision]);

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
