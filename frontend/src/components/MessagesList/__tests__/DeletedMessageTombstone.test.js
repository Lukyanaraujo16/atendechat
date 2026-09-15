/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import { i18n, changeLanguage } from "../../../translate/i18n";
import DeletedMessageTombstone from "../DeletedMessageTombstone";

describe("DeletedMessageTombstone", () => {
  afterEach(() => {
    changeLanguage("pt");
  });

  it("PT inbound: Mensagem apagada pelo contato", () => {
    changeLanguage("pt");
    const { getByTestId } = render(<DeletedMessageTombstone fromMe={false} />);
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada pelo contato"
    );
  });

  it("PT outbound: Mensagem apagada", () => {
    changeLanguage("pt");
    const { getByTestId } = render(<DeletedMessageTombstone fromMe />);
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada"
    );
    expect(getByTestId("deleted-message-tombstone").textContent).not.toContain(
      "pelo contato"
    );
  });

  it("EN: Deleted message / by the contact", () => {
    changeLanguage("en");
    const inbound = render(<DeletedMessageTombstone fromMe={false} />);
    expect(inbound.getByTestId("deleted-message-tombstone").textContent).toContain(
      "Message deleted by the contact"
    );
    inbound.unmount();
    const outbound = render(<DeletedMessageTombstone fromMe />);
    expect(outbound.getByTestId("deleted-message-tombstone").textContent).toContain(
      i18n.t("messagesList.messageDeleted")
    );
    expect(i18n.t("messagesList.messageDeleted")).toBe("Deleted message");
  });

  it("ES: Mensaje eliminado por el contacto", () => {
    changeLanguage("es");
    const { getByTestId } = render(<DeletedMessageTombstone fromMe={false} />);
    expect(i18n.t("messagesList.messageDeletedByContact")).toBe(
      "Mensaje eliminado por el contacto"
    );
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensaje eliminado por el contacto"
    );
  });
});
