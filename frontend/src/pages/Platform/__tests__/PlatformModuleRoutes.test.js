import React from "react";
import { MemoryRouter, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { AuthContext } from "../../../context/Auth/AuthContext";
import PlatformModule from "../PlatformModule";

jest.mock("../../../layout/SaaSModuleLayout", () => ({ children }) => <>{children}</>);
jest.mock("../PlatformWhatsappMonitor", () => {
  const { useParams } = require("react-router-dom");
  return () => <div>monitor:{useParams().tab || "default"}</div>;
});
[
  "../PlatformDashboard",
  "../PlatformCompanies",
  "../CompanyDetail",
  "../PlatformBranding",
  "../PlatformSuperAdmins",
  "../PlatformMyAccount",
  "../PlatformFinance",
  "../HistoricalReview",
  "../PlatformBackup",
  "../PlatformSystemTools",
  "../PlatformPlans",
  "../PlatformHelps",
  "../PlatformInformativos",
  "../PlatformSignupRequests",
  "../../BillingAutomation",
  "../PlatformPushSettings",
  "../PlatformEmailSettings",
].forEach((path) => jest.mock(path, () => () => null));

function renderAt(path) {
  let location;
  render(
    <AuthContext.Provider value={{ user: { id: 1, super: true, profile: "admin" } }}>
      <MemoryRouter initialEntries={[path]}>
        <PlatformModule />
        <Route
          path="*"
          render={(props) => {
            location = props.location;
            return null;
          }}
        />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return () => location;
}

describe("rotas do Monitoramento WhatsApp", () => {
  it("rota antiga /saas/evolution-monitor redireciona para a aba Evolution", () => {
    const loc = renderAt("/saas/evolution-monitor");
    expect(loc().pathname).toBe("/saas/whatsapp-monitor/evolution");
    expect(screen.getByText("monitor:evolution")).toBeInTheDocument();
  });

  it.each([
    ["/saas/whatsapp-monitor", "monitor:default"],
    ["/saas/whatsapp-monitor/baileys", "monitor:baileys"],
  ])("%s abre a central", (path, text) => {
    renderAt(path);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
