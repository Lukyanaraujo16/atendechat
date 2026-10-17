import React from "react";
import { Redirect, useLocation } from "react-router-dom";

import MainContainer from "../../components/MainContainer";
import CompaniesManager from "../../components/CompaniesManager";
import PlatformPageHeader from "./PlatformPageHeader";

/**
 * Compatibilidade com links antigos: /saas/companies?focus=ID[&section=finance]
 * → página individual /saas/companies/ID/(financeiro|cadastro).
 */
export function legacyCompanyRedirectTarget(search) {
  const params = new URLSearchParams(search || "");
  const focus = params.get("focus");
  if (!focus) return null;
  const id = Number(focus);
  if (!Number.isInteger(id) || id <= 0) return null;
  const section = params.get("section");
  const tab = section === "finance" ? "financeiro" : "cadastro";
  return `/saas/companies/${id}/${tab}`;
}

/**
 * Gestão global de empresas (Super Admin): listagem. Cada empresa abre em
 * /saas/companies/:companyId/:tab (ver CompanyDetail).
 */
export default function PlatformCompanies() {
  const location = useLocation();
  const redirectTo = legacyCompanyRedirectTarget(location.search);
  if (redirectTo) {
    return <Redirect to={redirectTo} />;
  }
  return (
    <MainContainer>
      <PlatformPageHeader
        titleKey="platform.companies.title"
        subtitleKey="platform.companies.subtitle"
      />
      <CompaniesManager />
    </MainContainer>
  );
}
