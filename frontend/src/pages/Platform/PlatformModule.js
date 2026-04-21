import React, { useContext } from "react";
import { Redirect, Switch, Route } from "react-router-dom";

import { AuthContext } from "../../context/Auth/AuthContext";
import SaaSModuleLayout from "../../layout/SaaSModuleLayout";

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

/**
 * Módulo de gestão SaaS (Super Admin). Navegação lateral em /saas/* — sem tabs horizontais.
 */
export default function PlatformModule() {
  const { user } = useContext(AuthContext);

  if (!user?.super) {
    return <Redirect to="/tickets" />;
  }

  return (
    <SaaSModuleLayout>
      <Switch>
        <Route exact path="/saas" component={PlatformDashboard} />
        <Route exact path="/saas/companies" component={PlatformCompanies} />
        <Route exact path="/saas/admins" component={PlatformSuperAdmins} />
        <Route exact path="/saas/account" component={PlatformMyAccount} />
        <Route exact path="/saas/branding" component={PlatformBranding} />
        <Route exact path="/saas/plans" component={PlatformPlans} />
        <Route exact path="/saas/finance" component={PlatformFinance} />
        <Route exact path="/saas/billing-automation" component={BillingAutomationPage} />
        <Route exact path="/saas/backup" component={PlatformBackup} />
        <Route exact path="/saas/helps" component={PlatformHelps} />
        <Route exact path="/saas/announcements" component={PlatformInformativos} />
        <Route render={() => <Redirect to="/saas" />} />
      </Switch>
    </SaaSModuleLayout>
  );
}
