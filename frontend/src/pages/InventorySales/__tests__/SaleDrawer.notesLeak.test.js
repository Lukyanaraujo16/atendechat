/**
 * @jest-environment node
 */
const fs = require("fs");
const path = require("path");

describe("SaleDrawer residual JSX", () => {
  it("não deixa ternário residual como texto entre Observação e Pagamento", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../SaleDrawer.js"),
      "utf8"
    );
    expect(src).not.toMatch(/disabled=\{!editable\}\s*\/>\s*\) : null\}/);
    expect(src).not.toContain("): null)}");
  });
});
