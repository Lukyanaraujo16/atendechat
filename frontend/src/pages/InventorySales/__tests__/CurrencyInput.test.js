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

  it("formata milhares e centavos (R$ 7.200,50)", () => {
    const onChange = jest.fn();
    render(
      <CurrencyInput
        allowEmpty
        value={null}
        onChange={onChange}
        data-testid="money"
      />
    );
    const input = screen.getByTestId("money");
    for (const d of "720050") {
      fireEvent.keyDown(input, { key: d });
    }
    expect(onChange).toHaveBeenLastCalledWith(7200.5);
    expect(input.value).toMatch(/7\.200,50/);
  });

  it("allowEmpty limpa o campo", () => {
    const onChange = jest.fn();
    render(
      <CurrencyInput
        allowEmpty
        value={0.01}
        onChange={onChange}
        data-testid="money"
      />
    );
    const input = screen.getByTestId("money");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
