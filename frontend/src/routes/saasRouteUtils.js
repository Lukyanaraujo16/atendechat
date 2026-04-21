import React from "react";
import { Redirect } from "react-router-dom";

/** Redireciona URLs antigas /platform/* para /saas/* (rotas canónicas do módulo Super Admin). */
export function legacyPlatformPathToSaas(pathname) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const exact = {
    "/platform": "/saas",
    "/platform/companies": "/saas/companies",
    "/platform/planos": "/saas/plans",
    "/platform/financeiro": "/saas/finance",
    "/platform/billing-automation": "/saas/billing-automation",
    "/platform/backup": "/saas/backup",
    "/platform/branding": "/saas/branding",
    "/platform/helps": "/saas/helps",
    "/platform/informativos": "/saas/announcements",
    "/platform/super-admins": "/saas/admins",
    "/platform/account": "/saas/account",
  };
  if (exact[normalized]) {
    return exact[normalized];
  }
  if (normalized.startsWith("/platform")) {
    const rest = normalized.replace(/^\/platform/, "") || "/";
    return rest === "/" ? "/saas" : `/saas${rest}`;
  }
  return "/saas";
}

export function LegacyPlatformRedirect({ location }) {
  return (
    <Redirect
      to={{
        pathname: legacyPlatformPathToSaas(location.pathname),
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}
