/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import LocationPreview from "../index";

const MAPS_URL =
  "https://maps.google.com/maps?q=-20.370664596557617%2C-40.34754943847656&z=17&hl=pt-BR";

describe("LocationPreview", () => {
  let openSpy;

  beforeEach(() => {
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("clique em Visualizar abre URL absoluta em nova aba", () => {
    const { getByTestId } = render(
      <LocationPreview image={null} link={MAPS_URL} description={null} />
    );
    fireEvent.click(getByTestId("chat-location-open"));
    expect(openSpy).toHaveBeenCalledWith(
      MAPS_URL,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("coordenadas relativas nunca abrem /tickets/{coords}", () => {
    const { getByTestId } = render(
      <LocationPreview
        image={null}
        link="-20.370664596557617, -40.34754943847656"
        description={null}
      />
    );
    const button = getByTestId("chat-location-open");
    expect(button.disabled || button.getAttribute("disabled") !== null).toBe(
      true
    );
    fireEvent.click(button);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("entrada inválida não navega", () => {
    const { getByTestId } = render(
      <LocationPreview image={null} link="file:///etc/passwd" description={null} />
    );
    fireEvent.click(getByTestId("chat-location-open"));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("ausência de thumbnail ainda renderiza o card", () => {
    const { getByTestId, queryByAltText } = render(
      <LocationPreview image={null} link={MAPS_URL} description={null} />
    );
    expect(getByTestId("chat-location-preview")).toBeTruthy();
    expect(queryByAltText("loc")).toBeNull();
  });
});
