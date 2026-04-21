import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import SaaSRootLayout from "../layout/SaaSRootLayout";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import ForgetPassword from "../pages/ForgetPassWord/";
import PlatformModule from "../pages/Platform/PlatformModule";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import LoggedInRoutesContent from "./LoggedInRoutesContent";
import { LegacyPlatformRedirect } from "./saasRouteUtils";

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TicketsContextProvider>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route exact path="/forgetpsw" component={ForgetPassword} />
            <Route
              isPrivate
              path="/saas"
              render={() => (
                <WhatsAppsProvider>
                  <SaaSRootLayout>
                    <PlatformModule />
                  </SaaSRootLayout>
                </WhatsAppsProvider>
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
                  <LoggedInLayout>
                    <LoggedInRoutesContent />
                  </LoggedInLayout>
                </WhatsAppsProvider>
              )}
            />
          </Switch>
          <ToastContainer autoClose={3000} />
        </TicketsContextProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
