/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import SharedContactPreview from "../index";

const FULL_VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "FN:Maria Silva",
  "TEL:+5527999999999",
  "END:VCARD",
].join("\n");

describe("SharedContactPreview", () => {
  it("contactMessage não exibe texto bruto de vCard", () => {
    const { getByTestId, queryByText, getByText } = render(
      <SharedContactPreview body={FULL_VCARD} />
    );
    expect(getByTestId("chat-shared-contact")).toBeTruthy();
    expect(getByText("Maria Silva")).toBeTruthy();
    expect(getByText("+5527999999999")).toBeTruthy();
    expect(queryByText(/BEGIN:VCARD/i)).toBeNull();
    expect(queryByText(/END:VCARD/i)).toBeNull();
  });

  it("vcard incompleto usa fallback seguro", () => {
    const { getByText, queryByText } = render(
      <SharedContactPreview body={"BEGIN:VCARD\nEND:VCARD"} />
    );
    expect(getByText("Contato")).toBeTruthy();
    expect(queryByText(/BEGIN:VCARD/i)).toBeNull();
  });
});
