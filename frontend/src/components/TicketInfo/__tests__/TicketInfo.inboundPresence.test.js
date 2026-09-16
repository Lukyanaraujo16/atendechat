/**
 * @jest-environment jsdom
 */
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { MemoryRouter } from "react-router-dom";
import { changeLanguage, i18n } from "../../../translate/i18n";
import TicketInfo from "../index";

const mockIsMobile = jest.fn(() => false);

jest.mock("../../../hooks/useIsMobile", () => ({
  __esModule: true,
  default: () => mockIsMobile(),
}));

jest.mock("../../TicketAiAgentControls", () => () => null);
jest.mock("../../ContactLabelsBar", () => () => null);

const theme = createTheme();

function renderInfo(props = {}) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <TicketInfo
          contact={{ id: 1, name: "Maria Cliente", profilePicUrl: "" }}
          ticket={{ id: 77, user: { name: "Ana" } }}
          onClick={() => {}}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("TicketInfo inbound presence", () => {
  beforeEach(() => {
    changeLanguage("pt");
    mockIsMobile.mockReturnValue(false);
  });

  afterEach(() => {
    changeLanguage("pt");
  });

  it("Ticket liga o hook e TicketInfo usa i18n no subheader", () => {
    const ticketSrc = fs.readFileSync(
      path.join(__dirname, "../../Ticket/index.js"),
      "utf8"
    );
    const infoSrc = fs.readFileSync(
      path.join(__dirname, "../index.js"),
      "utf8"
    );
    expect(ticketSrc).toMatch(/useInboundTicketPresence/);
    expect(ticketSrc).toMatch(/inboundPresence=/);
    expect(ticketSrc).not.toMatch(/presence\.update/);
    expect(ticketSrc).not.toMatch(/evolution/i);
    expect(ticketSrc).not.toMatch(/setUnread/);
    expect(ticketSrc).not.toMatch(/lastMessage/);
    expect(infoSrc).toMatch(/messagesList\.header\.contactTyping/);
    expect(infoSrc).toMatch(/messagesList\.header\.contactRecording/);
    expect(infoSrc).toMatch(/data-testid="ticket-inbound-presence"/);
    expect(infoSrc).not.toMatch(/MessagesList/);
  });

  it("desktop composing mostra digitando via i18n e não substitui o nome", () => {
    mockIsMobile.mockReturnValue(false);
    renderInfo({ inboundPresence: "composing" });
    expect(screen.getByTestId("ticket-inbound-presence").textContent).toBe(
      i18n.t("messagesList.header.contactTyping")
    );
    expect(screen.getByText(/#77/)).toBeTruthy();
    expect(screen.queryByLabelText(i18n.t("ticketAdvanced.backToList"))).toBeNull();
  });

  it("mobile recording mostra gravando áudio via i18n", () => {
    mockIsMobile.mockReturnValue(true);
    renderInfo({ inboundPresence: "recording" });
    expect(screen.getByTestId("ticket-inbound-presence").textContent).toBe(
      i18n.t("messagesList.header.contactRecording")
    );
    expect(screen.getByLabelText(i18n.t("ticketAdvanced.backToList"))).toBeTruthy();
  });

  it("paused/ausente não renderiza indicador", () => {
    renderInfo({ inboundPresence: "paused" });
    expect(screen.queryByTestId("ticket-inbound-presence")).toBeNull();
  });

  it("i18n PT/EN/ES", () => {
    changeLanguage("pt");
    expect(i18n.t("messagesList.header.contactTyping")).toBe("digitando...");
    expect(i18n.t("messagesList.header.contactRecording")).toBe(
      "gravando áudio..."
    );
    changeLanguage("en");
    expect(i18n.t("messagesList.header.contactTyping")).toBe("typing...");
    expect(i18n.t("messagesList.header.contactRecording")).toBe(
      "recording audio..."
    );
    changeLanguage("es");
    expect(i18n.t("messagesList.header.contactTyping")).toBe("escribiendo...");
    expect(i18n.t("messagesList.header.contactRecording")).toBe(
      "grabando audio..."
    );
  });
});
