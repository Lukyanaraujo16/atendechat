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

export default function PlatformModule() {
  const { user } = useContext(AuthContext);

  const tabs = useMemo(
    () => [
      { path: "/platform", label: i18n.t("platform.tabs.dashboard") },
      { path: "/platform/companies", label: i18n.t("platform.tabs.companies") },
      { path: "/platform/super-admins", label: i18n.t("platform.tabs.superAdmins") },
      { path: "/platform/account", label: i18n.t("platform.tabs.myAccount") },
      { path: "/platform/branding", label: i18n.t("platform.tabs.branding") },
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
      </Switch>
    </ModuleTabsLayout>
  );
}
