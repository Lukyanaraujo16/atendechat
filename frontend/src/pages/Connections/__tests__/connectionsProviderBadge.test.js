/**
 * Badge de provider na lista Connections: quem gerencia conexões, não só Super Admin.
 */
const fs = require("fs");
const path = require("path");

describe("Connections — provider badge", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../index.js"),
    "utf8"
  );

  it("usa canManageConnections para exibir o badge", () => {
    expect(src).toMatch(/if \(!canManageConnections\) return null/);
    expect(src).not.toMatch(/if \(!isSuperAdmin\) return null/);
    expect(src).not.toMatch(/isPlatformSuperAdmin/);
  });

  it("não interpola secrets Evolution no badge", () => {
    expect(src).not.toMatch(/baseUrl|apiKey|instanceName|apiKeyEncrypted/);
    expect(src).toMatch(/connectionProviderBadgeKey/);
  });
});
