import fs from "fs";
import path from "path";
import AppError from "../../../errors/AppError";
import InventorySale from "../../../models/InventorySale";
import { assertInventorySaleIsDraft } from "../inventorySaleHelpers";
import {
  assertIdentifiersForCompleteSale,
  assertQuantityReductionAllowsIdentifiers,
  parseAndNormalizeIdentifiers,
  parseIdentifiersField
} from "../inventorySaleItemIdentifiers";

function expectAppError(fn: () => unknown, messageIncludes?: string) {
  try {
    fn();
    throw new Error("expected AppError");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    if (messageIncludes) {
      const appErr = err as AppError;
      expect(`${appErr.clientMessage || ""} ${appErr.message}`).toContain(
        messageIncludes
      );
    }
  }
}

describe("inventorySaleItemIdentifiers — contrato de unidades vendidas", () => {
  it("1. quantity=1 sem identificador", () => {
    expect(parseAndNormalizeIdentifiers("omitted", 1)).toEqual([]);
    expect(parseAndNormalizeIdentifiers([], 1)).toEqual([]);
  });

  it("2. quantity=1 com identificador", () => {
    expect(
      parseAndNormalizeIdentifiers([{ position: 1, identifier: "SN-A123" }], 1)
    ).toEqual([{ position: 1, identifier: "SN-A123" }]);
  });

  it("3. quantity=3 com 3 identificadores (inclui 2.000)", () => {
    const rows = parseAndNormalizeIdentifiers(
      [
        { position: 2, identifier: "SN-A124" },
        { position: 1, identifier: "SN-A123" },
        { position: 3, identifier: "SN-A125" }
      ],
      3
    );
    expect(rows.map(r => r.position)).toEqual([1, 2, 3]);
    expect(
      parseAndNormalizeIdentifiers(
        [{ position: 1, identifier: "SN-A123" }],
        2.0
      )
    ).toEqual([{ position: 1, identifier: "SN-A123" }]);
  });

  it("4. quantity=3 com 1 identificador", () => {
    expect(
      parseAndNormalizeIdentifiers([{ position: 2, identifier: "SN-A124" }], 3)
    ).toEqual([{ position: 2, identifier: "SN-A124" }]);
  });

  it("5. trim", () => {
    expect(
      parseAndNormalizeIdentifiers(
        [{ position: 1, identifier: "  SN-A123  " }],
        1
      )
    ).toEqual([{ position: 1, identifier: "SN-A123" }]);
  });

  it("6. vazio ignorado", () => {
    expect(
      parseAndNormalizeIdentifiers(
        [
          { position: 1, identifier: "" },
          { position: 2, identifier: "   " },
          { position: 3, identifier: "SN3" }
        ],
        3
      )
    ).toEqual([{ position: 3, identifier: "SN3" }]);
  });

  it("7. 255 chars aceita", () => {
    const identifier = "A".repeat(255);
    expect(
      parseAndNormalizeIdentifiers([{ position: 1, identifier }], 1)
    ).toEqual([{ position: 1, identifier }]);
  });

  it("8. >255 rejeita", () => {
    expectAppError(
      () =>
        parseAndNormalizeIdentifiers(
          [{ position: 1, identifier: "A".repeat(256) }],
          1
        ),
      "255"
    );
  });

  it("9. MAC com : aceita", () => {
    expect(
      parseAndNormalizeIdentifiers(
        [{ position: 1, identifier: "AA:BB:CC:DD:EE:FF" }],
        1
      )[0].identifier
    ).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("10. serial com - aceita", () => {
    expect(
      parseAndNormalizeIdentifiers(
        [{ position: 1, identifier: "SN-A123" }],
        1
      )[0].identifier
    ).toBe("SN-A123");
  });

  it("11. quantity fracionária sem identifiers aceita", () => {
    expect(parseAndNormalizeIdentifiers([], 1.5)).toEqual([]);
    expect(parseAndNormalizeIdentifiers("omitted", 1.5)).toEqual([]);
  });

  it("12. quantity fracionária com identifiers rejeita", () => {
    expectAppError(
      () =>
        parseAndNormalizeIdentifiers([{ position: 1, identifier: "SN1" }], 1.5),
      "inteira"
    );
  });

  it("13. position 0 rejeita", () => {
    expectAppError(
      () =>
        parseAndNormalizeIdentifiers([{ position: 0, identifier: "SN1" }], 1),
      "a partir de 1"
    );
  });

  it("14. position > quantity rejeita", () => {
    expectAppError(
      () =>
        parseAndNormalizeIdentifiers([{ position: 3, identifier: "SN1" }], 2),
      "no máximo 2"
    );
  });

  it("15. position repetida rejeita", () => {
    expectAppError(
      () =>
        parseAndNormalizeIdentifiers(
          [
            { position: 1, identifier: "SN1" },
            { position: 1, identifier: "SN2" }
          ],
          2
        ),
      "repetir position"
    );
  });

  it("16. reduzir quantity com identificador excedente bloqueia", () => {
    expectAppError(
      () =>
        assertQuantityReductionAllowsIdentifiers(
          [{ position: 1 }, { position: 2 }, { position: 3 }],
          2
        ),
      "unidade 3"
    );
  });

  it("17. reduzir quantity sem excedente permite", () => {
    expect(() =>
      assertQuantityReductionAllowsIdentifiers(
        [{ position: 1 }, { position: 2 }],
        2
      )
    ).not.toThrow();
    expect(() =>
      assertQuantityReductionAllowsIdentifiers([{ position: 1 }], 2)
    ).not.toThrow();
    expect(() => assertQuantityReductionAllowsIdentifiers([], 2)).not.toThrow();
  });

  it("18. completed não permite alteração", () => {
    expectAppError(
      () =>
        assertInventorySaleIsDraft(
          { status: "completed" } as InventorySale,
          "ter itens editados"
        ),
      "rascunho"
    );
  });

  it("19. cancelled não permite alteração", () => {
    expectAppError(
      () =>
        assertInventorySaleIsDraft(
          { status: "cancelled" } as InventorySale,
          "ter itens editados"
        ),
      "rascunho"
    );
  });

  it("20. cancelamento preserva identificadores", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../CancelInventorySaleService.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/InventorySaleItemIdentifier/);
    expect(src).not.toMatch(/Identifier\.destroy/);
  });

  it("21. delete draft cascade", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../../../database/migrations/20260822120000-create-inventory-sale-item-identifiers.ts"
      ),
      "utf8"
    );
    expect(migration).toContain('onDelete: "CASCADE"');
    expect(migration).toContain("InventorySaleItems");
    expect(migration).toContain("InventorySaleItems_id_companyId_unique");
    expect(migration).toContain(
      "InventorySaleItemIdentifiers_saleItem_company_fk"
    );
    expect(migration).toContain('FOREIGN KEY ("saleItemId", "companyId")');

    const itemModel = fs.readFileSync(
      path.join(__dirname, "../../../models/InventorySaleItem.ts"),
      "utf8"
    );
    expect(itemModel).toContain('onDelete: "CASCADE"');
    expect(itemModel).toContain('as: "identifiers"');
  });

  it("22. Show sale retorna identifiers ordenados por position, filtrados pela company", () => {
    const helpers = fs.readFileSync(
      path.join(__dirname, "../inventorySaleHelpers.ts"),
      "utf8"
    );
    expect(helpers).toContain("buildInventorySaleItemIdentifierInclude");
    const identHelper = fs.readFileSync(
      path.join(__dirname, "../inventorySaleItemIdentifiers.ts"),
      "utf8"
    );
    expect(identHelper).toContain('as: "identifiers"');
    expect(identHelper).toContain('["position", "ASC"]');
    expect(identHelper).toContain("where: { companyId }");
  });

  it("23. isolamento company no complete", () => {
    expectAppError(
      () =>
        assertIdentifiersForCompleteSale({
          companyId: 1,
          items: [{ id: 10, companyId: 1, quantity: 1 }],
          identifiers: [
            {
              companyId: 2,
              saleItemId: 10,
              position: 1,
              identifier: "SN1"
            }
          ]
        }),
      "empresa"
    );
  });

  it("24. venda antiga sem identifiers continua funcionando", () => {
    expect(() =>
      assertIdentifiersForCompleteSale({
        companyId: 1,
        items: [
          { id: 10, companyId: 1, quantity: 2 },
          { id: 11, companyId: 1, quantity: 1.5 }
        ],
        identifiers: []
      })
    ).not.toThrow();
  });

  it("não altera casing nem remove / interno", () => {
    expect(
      parseAndNormalizeIdentifiers(
        [{ position: 1, identifier: "abc/DEF 12" }],
        1
      )[0].identifier
    ).toBe("abc/DEF 12");
  });

  it("identifiers omitido vs lista inválida", () => {
    expect(parseIdentifiersField(undefined)).toBe("omitted");
    expect(parseIdentifiersField(null)).toEqual([]);
    expectAppError(() => parseIdentifiersField("SN1"), "lista");
  });
});
