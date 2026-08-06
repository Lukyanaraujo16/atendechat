import React from "react";
import { BrowserRouter, Switch, Route as RouterRoute } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import SaaSRootLayout from "../layout/SaaSRootLayout";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import ForgetPassword from "../pages/ForgetPassWord/";
import PlatformModule from "../pages/Platform/PlatformModule";
import { AuthProvider } from "../context/Auth/AuthContext";
import { PwaInstallProvider } from "../context/PwaInstall/PwaInstallContext";
import OneSignalIntegration from "../components/OneSignalIntegration";
import PwaInstallExperience from "../components/PwaInstallExperience";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import LoggedInRoutesContent from "./LoggedInRoutesContent";
import { LegacyPlatformRedirect } from "./saasRouteUtils";
import TenantAppShell from "./TenantAppShell";
import { PlanFlagsProvider } from "../hooks/usePlanFlags";
import { PUBLIC_LEGAL_ROUTES } from "./publicLegalRoutes";

/**
 * PwaInstallProvider fica acima de SaaSRootLayout e LoggedInLayout
 * (via TenantAppShell) para não duplicar listeners entre shells.
 * Push opt-in banner: tenant + SaaS (mesmo OneSignal / External ID).
 */
const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OneSignalIntegration />
        <PwaInstallProvider>
          <TicketsContextProvider>
            <Switch>
              {PUBLIC_LEGAL_ROUTES.map(({ path, component }) => (
                <RouterRoute key={path} exact path={path} component={component} />
              ))}
              <Route exact path="/login" component={Login} />
              <Route exact path="/signup" component={Signup} />
              <Route exact path="/forgetpsw" component={ForgetPassword} />
              <Route
                isPrivate
                path="/saas"
                render={() => (
                  <PlanFlagsProvider>
                    <WhatsAppsProvider>
                      <SaaSRootLayout>
                        <PlatformModule />
                      </SaaSRootLayout>
                    </WhatsAppsProvider>
                  </PlanFlagsProvider>
                )}
              />
              <Route
                isPrivate
                path="/platform"
                render={(props) => (
                  <WhatsAppsProvider>
                    <LegacyPlatformRedirect {...props} />
                  </WhatsAppsProvider>
                )}
              />
              <Route
                isPrivate
                render={() => (
                  <WhatsAppsProvider>
                    <TenantAppShell>
                      <LoggedInRoutesContent />
                    </TenantAppShell>
                  </WhatsAppsProvider>
                )}
              />
            </Switch>
            <PwaInstallExperience />
            <ToastContainer
              autoClose={3000}
              limit={4}
              newestOnTop
              pauseOnFocusLoss={false}
              closeOnClick
              draggable={false}
            />
          </TicketsContextProvider>
        </PwaInstallProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
