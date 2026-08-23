/**
 * @jest-environment jsdom
 */
import { changeLanguage, i18n } from "../../../translate/i18n";
import {
  IDENTIFIER_MAX_LEN,
  buildCreateIdentifiersField,
  buildUpdateIdentifiersField,
  findDuplicateIdentifier,
  findExceedingFilledPositions,
  identifierValuesFromItem,
  identifiersFromSaleItem,
  isFractionalIdentifierResolution,
  isWholeQuantity,
  nextAvailablePosition,
  toPayloadIdentifiers,
  usesInlineIdentifierSlots,
  validateIdentifiersForSubmit,
  visibleIdentifierPositions,
} from "../saleItemIdentifiers";

describe("saleItemIdentifiers", () => {
  beforeEach(() => {
    changeLanguage("pt");
  });

  it("1. quantity 1 sem identifier não gera payload", () => {
    expect(
      buildCreateIdentifiersField({ quantity: 1, values: { 1: "" } })
    ).toEqual({ include: false });
    expect(visibleIdentifierPositions({ quantity: 1, values: {} })).toEqual([1]);
  });

  it("2. quantity 1 com identifier envia position 1", () => {
    expect(
      buildCreateIdentifiersField({
        quantity: 1,
        values: { 1: "SN-A123" },
      })
    ).toEqual({
      include: true,
      identifiers: [{ position: 1, identifier: "SN-A123" }],
    });
  });

  it("3. quantity 3 parcial envia só posições preenchidas", () => {
    expect(
      toPayloadIdentifiers({ 1: "SN-A123", 2: "  ", 3: "" })
    ).toEqual([{ position: 1, identifier: "SN-A123" }]);
    expect(
      visibleIdentifierPositions({
        quantity: 3,
        values: { 1: "SN-A123" },
      })
    ).toEqual([1, 2, 3]);
  });

  it("4. quantity 3 completo envia as três unidades", () => {
    expect(
      toPayloadIdentifiers({
        1: "SN-A123",
        2: "SN-A124",
        3: "SN-A125",
      })
    ).toEqual([
      { position: 1, identifier: "SN-A123" },
      { position: 2, identifier: "SN-A124" },
      { position: 3, identifier: "SN-A125" },
    ]);
  });

  it("5. aumento de quantity preserva valores existentes", () => {
    const values = { 1: "A", 2: "B" };
    expect(
      visibleIdentifierPositions({ quantity: 4, values })
    ).toEqual([1, 2, 3, 4]);
    expect(toPayloadIdentifiers(values)).toEqual([
      { position: 1, identifier: "A" },
      { position: 2, identifier: "B" },
    ]);
  });

  it("6. redução com excedente preenchido bloqueia", () => {
    const values = { 1: "A", 2: "B", 3: "C" };
    expect(findExceedingFilledPositions(values, 2)).toEqual([3]);
    expect(
      validateIdentifiersForSubmit({ quantity: 2, values })
    ).toEqual({ ok: false, code: "reduceQuantity", position: 3 });
    expect(
      i18n.t("inventorySales.sales.items.identifiers.reduceQuantity", {
        position: 3,
      })
    ).toBe("Remova a identificação da unidade 3 antes de reduzir a quantidade.");
  });

  it("7. redução com excedente vazio permite", () => {
    const values = { 1: "A", 2: "B", 3: "", 4: "  " };
    expect(findExceedingFilledPositions(values, 2)).toEqual([]);
    expect(validateIdentifiersForSubmit({ quantity: 2, values }).ok).toBe(true);
  });

  it("8. quantity fracionária não envia identifiers", () => {
    expect(isWholeQuantity(1.5)).toBe(false);
    expect(isWholeQuantity("2.5")).toBe(false);
    expect(isWholeQuantity(2.0)).toBe(true);
    expect(
      buildCreateIdentifiersField({
        quantity: 1.5,
        values: { 1: "SN-A123" },
      })
    ).toEqual({ include: false });
    expect(
      validateIdentifiersForSubmit({
        quantity: 1.5,
        values: { 1: "SN-A123" },
      })
    ).toEqual({ ok: false, code: "fractionalNeedsClear" });
  });

  it("9. trim só no payload, preserva espaços internos", () => {
    expect(
      toPayloadIdentifiers({ 1: "  SN 123  " })
    ).toEqual([{ position: 1, identifier: "SN 123" }]);
  });

  it("10. máximo 255 caracteres", () => {
    const ok = "a".repeat(IDENTIFIER_MAX_LEN);
    const tooLong = "a".repeat(IDENTIFIER_MAX_LEN + 1);
    expect(
      validateIdentifiersForSubmit({ quantity: 1, values: { 1: ok } }).ok
    ).toBe(true);
    expect(
      validateIdentifiersForSubmit({ quantity: 1, values: { 1: tooLong } })
    ).toEqual({ ok: false, code: "maxLength" });
  });

  it("11. MAC preserva dois-pontos e caixa", () => {
    expect(
      toPayloadIdentifiers({ 1: "AA:BB:CC:DD:EE:FF" })
    ).toEqual([{ position: 1, identifier: "AA:BB:CC:DD:EE:FF" }]);
  });

  it("12. serial com hífen e barra não é normalizado", () => {
    expect(
      toPayloadIdentifiers({ 1: "SN-A123/2024" })
    ).toEqual([{ position: 1, identifier: "SN-A123/2024" }]);
  });

  it("13. duplicado no mesmo item (exato, case-sensitive)", () => {
    expect(findDuplicateIdentifier({ 1: "SN-A", 2: "SN-A" })).toEqual({
      identifier: "SN-A",
      positions: [1, 2],
    });
    expect(findDuplicateIdentifier({ 1: "SN-A", 2: "sn-a" })).toBeNull();
    expect(
      validateIdentifiersForSubmit({
        quantity: 2,
        values: { 1: "X", 2: "X" },
      })
    ).toEqual({ ok: false, code: "duplicate" });
  });

  it("14. load de draft existente mapeia por position", () => {
    expect(
      identifierValuesFromItem({
        identifiers: [
          { id: 9, position: 2, identifier: "SN-B" },
          { id: 8, position: 1, identifier: "SN-A" },
        ],
      })
    ).toEqual({ 1: "SN-A", 2: "SN-B" });
  });

  it("15. venda antiga identifiers [] funciona", () => {
    expect(identifierValuesFromItem({ identifiers: [] })).toEqual({});
    expect(identifiersFromSaleItem({ identifiers: [] })).toEqual([]);
    expect(identifierValuesFromItem({})).toEqual({});
  });

  it("22. payload create omite lista vazia e inclui preenchidos", () => {
    expect(
      buildCreateIdentifiersField({ quantity: 2, values: {} })
    ).toEqual({ include: false });
    expect(
      buildCreateIdentifiersField({
        quantity: 2,
        values: { 1: "SN123", 2: "AA:BB:CC:DD:EE:FF" },
      })
    ).toEqual({
      include: true,
      identifiers: [
        { position: 1, identifier: "SN123" },
        { position: 2, identifier: "AA:BB:CC:DD:EE:FF" },
      ],
    });
  });

  it("23. payload update sem mexer em identifiers omite o campo", () => {
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: false,
        quantity: 2,
        values: { 1: "SN-A" },
        originalValues: { 1: "SN-A" },
      })
    ).toEqual({ include: false });
  });

  it("24. payload [] apaga quando o usuário remove todos", () => {
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: true,
        quantity: 2,
        values: { 1: "  ", 2: "" },
        originalValues: { 1: "SN-A", 2: "SN-B" },
      })
    ).toEqual({ include: true, identifiers: [] });
  });

  it("quantity grande usa add-row em vez de N slots", () => {
    expect(usesInlineIdentifierSlots(3)).toBe(true);
    expect(usesInlineIdentifierSlots(50)).toBe(false);
    expect(
      visibleIdentifierPositions({ quantity: 50, values: {} })
    ).toEqual([]);
    expect(nextAvailablePosition(50, [])).toBe(1);
    expect(
      visibleIdentifierPositions({
        quantity: 50,
        values: { 1: "A", 7: "B" },
        extraPositions: [3],
      })
    ).toEqual([1, 3, 7]);
    expect(nextAvailablePosition(50, [1, 3, 7])).toBe(2);
  });

  it("integer → fractional com identifiers permanece visível e bloqueia save", () => {
    const values = { 1: "SN-A", 2: "SN-B" };
    expect(isFractionalIdentifierResolution(1.5, values)).toBe(true);
    expect(visibleIdentifierPositions({ quantity: 1.5, values })).toEqual([1, 2]);
    expect(
      validateIdentifiersForSubmit({ quantity: 1.5, values })
    ).toEqual({ ok: false, code: "fractionalNeedsClear" });
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: false,
        quantity: 1.5,
        values,
        originalValues: values,
      })
    ).toEqual({ include: false });
  });

  it("integer → fractional após remover todos envia identifiers []", () => {
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: true,
        quantity: 1.5,
        values: {},
        originalValues: { 1: "SN-A", 2: "SN-B" },
      })
    ).toEqual({ include: true, identifiers: [] });
  });

  it("qty 2 sem identifiers → 1.5 omite identifiers", () => {
    expect(validateIdentifiersForSubmit({ quantity: 1.5, values: {} }).ok).toBe(
      true
    );
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: false,
        quantity: 1.5,
        values: {},
        originalValues: {},
      })
    ).toEqual({ include: false });
  });

  it("quantity 50 sparse preserva positions e não renumera ao remover", () => {
    const values = { 1: "SN1", 7: "SN7", 30: "SN30" };
    expect(visibleIdentifierPositions({ quantity: 50, values })).toEqual([
      1, 7, 30,
    ]);
    expect(nextAvailablePosition(50, [1, 7, 30])).toBe(2);
    const afterRemove7 = { 1: "SN1", 30: "SN30" };
    expect(toPayloadIdentifiers(afterRemove7)).toEqual([
      { position: 1, identifier: "SN1" },
      { position: 30, identifier: "SN30" },
    ]);
    expect(nextAvailablePosition(50, [1, 30])).toBe(2);
    expect(
      buildUpdateIdentifiersField({
        identifiersTouched: true,
        quantity: 50,
        values: afterRemove7,
        originalValues: values,
      })
    ).toEqual({
      include: true,
      identifiers: [
        { position: 1, identifier: "SN1" },
        { position: 30, identifier: "SN30" },
      ],
    });
  });
});
