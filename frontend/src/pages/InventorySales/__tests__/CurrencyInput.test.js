import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import CurrencyInput, {
  centsToReais,
  formatCentsAsBRL,
  parseCurrencyKeyToCents,
  reaisToCents,
} from "../CurrencyInput";

describe("CurrencyInput helpers", () => {
  it("converte reais ↔ centavos", () => {
    expect(reaisToCents(1)).toBe(100);
    expect(reaisToCents(10.5)).toBe(1050);
    expect(centsToReais(10000)).toBe(100);
  });

  it("formata BRL e processa teclas", () => {
    expect(formatCentsAsBRL(1)).toMatch(/0,01/);
    expect(parseCurrencyKeyToCents(0, "1")).toBe(1);
    expect(parseCurrencyKeyToCents(1, "0")).toBe(10);
    expect(parseCurrencyKeyToCents(100, "Backspace")).toBe(10);
  });
});

describe("CurrencyInput", () => {
  it("digita centavos sem vírgula", () => {
    const onChange = jest.fn();
    render(
      <CurrencyInput value={0} onChange={onChange} data-testid="money" />
    );
    const input = screen.getByTestId("money");
    fireEvent.keyDown(input, { key: "1" });
    expect(onChange).toHaveBeenLastCalledWith(0.01);
    fireEvent.keyDown(input, { key: "0" });
    expect(onChange).toHaveBeenLastCalledWith(0.1);
    fireEvent.keyDown(input, { key: "0" });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("backspace reduz centavos", () => {
    const onChange = jest.fn();
    render(
      <CurrencyInput value={1} onChange={onChange} data-testid="money" />
    );
    fireEvent.keyDown(screen.getByTestId("money"), { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith(0.1);
  });
});
