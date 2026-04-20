import React, { useContext, useMemo } from "react";
import { Redirect, Switch, Route } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";
import ModuleTabsLayout from "../../layout/ModuleTabsLayout";
import { i18n } from "../../translate/i18n";

import PlatformDashboard from "./PlatformDashboard";
import PlatformCompanies from "./PlatformCompanies";
import PlatformBranding from "./PlatformBranding";
import PlatformSuperAdmins from "./PlatformSuperAdmins";
import PlatformMyAccount from "./PlatformMyAccount";
import PlatformFinance from "./PlatformFinance";
import PlatformBackup from "./PlatformBackup";
import PlatformPlans from "./PlatformPlans";
import PlatformHelps from "./PlatformHelps";
import PlatformInformativos from "./PlatformInformativos";
import BillingAutomationPage from "../BillingAutomation";

export default function PlatformModule() {
  const { user } = useContext(AuthContext);

  const tabs = useMemo(
    () => [
      { path: "/platform", label: i18n.t("platform.tabs.dashboard") },
      { path: "/platform/companies", label: i18n.t("platform.tabs.companies") },
      { path: "/platform/planos", label: i18n.t("platform.tabs.plans") },
      { path: "/platform/financeiro", label: i18n.t("platform.tabs.financial") },
      {
        path: "/platform/billing-automation",
        label: i18n.t("platform.tabs.billingAutomation"),
      },
      { path: "/platform/backup", label: i18n.t("platform.tabs.backup") },
      { path: "/platform/branding", label: i18n.t("platform.tabs.branding") },
      { path: "/platform/helps", label: i18n.t("platform.tabs.helps") },
      { path: "/platform/informativos", label: i18n.t("platform.tabs.announcements") },
      { path: "/platform/super-admins", label: i18n.t("platform.tabs.superAdmins") },
      { path: "/platform/account", label: i18n.t("platform.tabs.myAccount") },
    ],
    [i18n.language]
  );

  if (!user?.super) {
    return <Redirect to="/tickets" />;
  }

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route exact path="/platform" component={PlatformDashboard} />
        <Route exact path="/platform/companies" component={PlatformCompanies} />
        <Route exact path="/platform/super-admins" component={PlatformSuperAdmins} />
        <Route exact path="/platform/account" component={PlatformMyAccount} />
        <Route exact path="/platform/branding" component={PlatformBranding} />
        <Route exact path="/platform/planos" component={PlatformPlans} />
        <Route exact path="/platform/financeiro" component={PlatformFinance} />
        <Route exact path="/platform/billing-automation" component={BillingAutomationPage} />
        <Route exact path="/platform/backup" component={PlatformBackup} />
        <Route exact path="/platform/helps" component={PlatformHelps} />
        <Route exact path="/platform/informativos" component={PlatformInformativos} />
      </Switch>
    </ModuleTabsLayout>
  );
}
