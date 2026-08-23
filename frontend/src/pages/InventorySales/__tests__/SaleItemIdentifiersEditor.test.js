/**
 * @jest-environment jsdom
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { changeLanguage, i18n } from "../../../translate/i18n";
import SaleItemIdentifiersEditor from "../SaleItemIdentifiersEditor";
import SaleItemIdentifiersList from "../SaleItemIdentifiersList";

const theme = createTheme();

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("SaleItemIdentifiersEditor / List", () => {
  beforeEach(() => {
    changeLanguage("pt");
  });

  it("quantity 1 fica visível por padrão com um input e sem accordion", () => {
    const { getByTestId, queryByTestId, queryByLabelText } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={1}
        values={{}}
        onChange={() => {}}
      />
    );
    expect(getByTestId("sale-item-identifiers-21")).toBeTruthy();
    expect(getByTestId("sale-item-identifiers-title-21")).toBeTruthy();
    expect(queryByTestId("sale-item-identifiers-toggle-21")).toBeNull();
    const input = getByTestId("sale-item-identifier-input-21-1");
    expect(input.getAttribute("maxLength")).toBe("255");
    expect(input.getAttribute("placeholder")).toBe(
      i18n.t("inventorySales.sales.items.identifiers.hint")
    );
    expect(queryByTestId("sale-item-identifier-input-21-2")).toBeNull();
    expect(queryByLabelText("Unidade 1")).toBeNull();
  });

  it("quantity 3 mostra Unidade 1/2/3 sem clique", () => {
    const { getByTestId, getByLabelText, queryByTestId } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={3}
        values={{ 1: "SN-A123" }}
        onChange={() => {}}
      />
    );
    expect(queryByTestId("sale-item-identifiers-toggle-21")).toBeNull();
    expect(getByTestId("sale-item-identifier-input-21-1")).toBeTruthy();
    expect(getByTestId("sale-item-identifier-input-21-2")).toBeTruthy();
    expect(getByTestId("sale-item-identifier-input-21-3")).toBeTruthy();
    expect(getByLabelText("Unidade 1")).toBeTruthy();
    expect(getByLabelText("Unidade 2")).toBeTruthy();
    expect(getByLabelText("Unidade 3")).toBeTruthy();
  });

  it("quantity 8 mostra 8 slots inline e quantity 9 usa proteção de adicionar", () => {
    const { queryAllByTestId, queryByTestId, rerender } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={8}
        values={{}}
        onChange={() => {}}
      />
    );
    expect(queryAllByTestId(/sale-item-identifier-input-21-/).length).toBe(8);
    expect(queryByTestId("sale-item-identifier-add-21")).toBeNull();

    rerender(
      <ThemeProvider theme={theme}>
        <SaleItemIdentifiersEditor
          itemId={21}
          quantity={9}
          values={{}}
          extraPositions={[]}
          onChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(queryAllByTestId(/sale-item-identifier-input-21-/).length).toBe(0);
    expect(queryByTestId("sale-item-identifier-add-21")).toBeTruthy();
  });

  it("quantity 50 não renderiza centenas de inputs; usa adicionar identificação", () => {
    const onChange = jest.fn();
    const { queryAllByTestId, getByTestId, queryByTestId, rerender } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={50}
        values={{}}
        extraPositions={[]}
        onChange={onChange}
      />
    );
    expect(queryByTestId("sale-item-identifiers-toggle-21")).toBeNull();
    expect(queryAllByTestId(/sale-item-identifier-input-21-/).length).toBe(0);
    fireEvent.click(getByTestId("sale-item-identifier-add-21"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        extraPositions: [1],
        identifiersTouched: true,
      })
    );

    rerender(
      <ThemeProvider theme={theme}>
        <SaleItemIdentifiersEditor
          itemId={21}
          quantity={50}
          values={{ 1: "" }}
          extraPositions={[1]}
          onChange={onChange}
        />
      </ThemeProvider>
    );
    expect(queryAllByTestId(/sale-item-identifier-input-21-/).length).toBe(1);
  });

  it("quantity fracionária mostra aviso e nenhum input", () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <SaleItemIdentifiersEditor itemId={21} quantity={1.5} values={{}} />
    );
    expect(getByTestId("sale-item-identifiers-fractional-21").textContent).toBe(
      i18n.t("inventorySales.sales.items.identifiers.integerOnly")
    );
    expect(queryByTestId("sale-item-identifier-input-21-1")).toBeNull();
  });

  it("integer → fractional com identifiers entra em modo de resolução", () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={1.5}
        values={{ 1: "SN-A", 2: "SN-B" }}
        onChange={onChange}
      />
    );
    expect(
      getByTestId("sale-item-identifiers-fractional-resolve-21").textContent
    ).toBe(i18n.t("inventorySales.sales.items.identifiers.fractionalNeedsClear"));
    expect(getByTestId("sale-item-identifier-input-21-1").value).toBe("SN-A");
    expect(getByTestId("sale-item-identifier-input-21-2").value).toBe("SN-B");
    fireEvent.click(getByTestId("sale-item-identifier-remove-all-21"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        identifierValues: {},
        identifiersTouched: true,
      })
    );
    expect(queryByTestId("sale-item-identifier-add-21")).toBeNull();
  });

  it("identifiers preenchidos permanecem visíveis sem accordion", () => {
    const { getByTestId } = renderWithTheme(
      <SaleItemIdentifiersEditor
        itemId={21}
        quantity={1}
        values={{ 1: "SN-A123" }}
        onChange={() => {}}
      />
    );
    expect(getByTestId("sale-item-identifier-input-21-1").value).toBe("SN-A123");
  });

  it("16-17. completed/cancelled usam lista somente leitura", () => {
    const item = {
      id: 21,
      identifiers: [
        { position: 1, identifier: "SN-A123" },
        { position: 2, identifier: "SN-A124" },
      ],
    };
    const { getByTestId, queryByTestId } = renderWithTheme(
      <SaleItemIdentifiersList item={item} />
    );
    expect(getByTestId("sale-item-identifiers-readonly-21").textContent).toContain(
      "1. SN-A123"
    );
    expect(getByTestId("sale-item-identifiers-readonly-21").textContent).toContain(
      "2. SN-A124"
    );
    expect(queryByTestId("sale-item-identifier-input-21-1")).toBeNull();
  });

  it("18. drawer/detalhe não mostra seção vazia", () => {
    const { queryByTestId } = renderWithTheme(
      <SaleItemIdentifiersList item={{ id: 21, identifiers: [] }} />
    );
    expect(queryByTestId("sale-item-identifiers-readonly-21")).toBeNull();
  });

  it("i18n PT/EN/ES das chaves principais", () => {
    changeLanguage("en");
    expect(i18n.t("inventorySales.sales.items.identifiers.title")).toBe(
      "Unit identification"
    );
    changeLanguage("es");
    expect(i18n.t("inventorySales.sales.items.identifiers.title")).toBe(
      "Identificación de la unidad"
    );
    changeLanguage("pt");
    expect(i18n.t("inventorySales.sales.items.identifiers.title")).toBe(
      "Identificação da unidade"
    );
  });
});
