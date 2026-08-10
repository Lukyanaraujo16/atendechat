/**
 * Guards estruturais da conversa mobile (composer/header/input).
 */
import fs from "fs";
import path from "path";

const root = path.join(__dirname, "../..");

describe("ticket conversation mobile layout guards", () => {
  it("composer usa classe safe-area condicional e input ≥16px no mobile", () => {
    const inputSrc = fs.readFileSync(
      path.join(root, "components/MessageInputCustom/index.js"),
      "utf8"
    );
    expect(inputSrc).toContain("shc-ticket-composer-safe");
    expect(inputSrc).toMatch(/fontSize:\s*16/);
    // Não deve haver paddingBottom com safe-area no Ticket footer (evitar duplicar)
    const ticketSrc = fs.readFileSync(
      path.join(root, "components/Ticket/index.js"),
      "utf8"
    );
    expect(ticketSrc).not.toMatch(
      /messageInputFooter:[\s\S]*paddingBottom:\s*[\"']env\(safe-area-inset-bottom/
    );
  });

  it("TicketHeader mobile não usa flexWrap wrap", () => {
    const src = fs.readFileSync(
      path.join(root, "components/TicketHeader/index.js"),
      "utf8"
    );
    expect(src).toMatch(/flexWrap:\s*[\"']nowrap[\"']/);
    expect(src).not.toMatch(/down\([\"']md[\"']\)[\s\S]*flexWrap:\s*[\"']wrap[\"']/);
  });

  it("MessagesList evita scrollIntoView agressivo no documento", () => {
    const src = fs.readFileSync(
      path.join(root, "components/MessagesList/index.js"),
      "utf8"
    );
    expect(src).toContain('getElementById("messagesList")');
    expect(src).toContain("list.scrollTop = list.scrollHeight");
    expect(src).not.toMatch(/scrollIntoView\(\{\}\)/);
  });

  it("TicketAdvanced ativa useMobileVisualViewport na conversa", () => {
    const src = fs.readFileSync(
      path.join(root, "pages/TicketsAdvanced/index.js"),
      "utf8"
    );
    expect(src).toContain("useMobileVisualViewport");
    expect(src).toContain("enabled: conversationOpen");
  });

  it("CSS mobileViewport tem regras de conversa/teclado", () => {
    const css = fs.readFileSync(
      path.join(root, "styles/mobileViewport.css"),
      "utf8"
    );
    expect(css).toContain("shc-ticket-conversation-mobile");
    expect(css).toContain("shc-ticket-keyboard-open");
    expect(css).toContain("--app-vv-height");
    expect(css).toContain("shc-ticket-composer-safe");
  });
});
