import React from "react";
import { render, screen } from "@testing-library/react";
import AgentOsIf from "../../components/AgentOsIf";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import { i18n } from "../../translate/i18n";

describe("Fase 1.6 — AgentOsIf / banner", () => {
  it("oculta ação sem grant e mostra com grant", () => {
    const { rerender } = render(
      <AgentOsIf when={false}>
        <button type="button">Replay</button>
      </AgentOsIf>
    );
    expect(screen.queryByText("Replay")).toBeNull();

    rerender(
      <AgentOsIf when>
        <button type="button">Replay</button>
      </AgentOsIf>
    );
    expect(screen.getByText("Replay")).toBeTruthy();
  });

  it("banner somente leitura", () => {
    const { rerender } = render(<AgentOsReadOnlyBanner visible={false} />);
    expect(screen.queryByTestId("agentos-readonly-banner")).toBeNull();

    rerender(<AgentOsReadOnlyBanner visible />);
    expect(screen.getByTestId("agentos-readonly-banner")).toBeTruthy();
    expect(
      screen.getByText(i18n.t("technicalConsole.readOnly.banner"))
    ).toBeTruthy();
  });
});
