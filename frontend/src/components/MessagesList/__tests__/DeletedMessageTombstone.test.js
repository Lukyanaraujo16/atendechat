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

  it("PT: Mensagem apagada", () => {
    changeLanguage("pt");
    const { getByTestId } = render(<DeletedMessageTombstone />);
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensagem apagada"
    );
  });

  it("EN: Deleted message", () => {
    changeLanguage("en");
    const { getByTestId } = render(<DeletedMessageTombstone />);
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      i18n.t("messagesList.messageDeleted")
    );
    expect(i18n.t("messagesList.messageDeleted")).toBe("Deleted message");
  });

  it("ES: Mensaje eliminado", () => {
    changeLanguage("es");
    const { getByTestId } = render(<DeletedMessageTombstone />);
    expect(i18n.t("messagesList.messageDeleted")).toBe("Mensaje eliminado");
    expect(getByTestId("deleted-message-tombstone").textContent).toContain(
      "Mensaje eliminado"
    );
  });
});
