import {
  buildOneSignalExternalId,
  expandOneSignalExternalIdAliases
} from "../oneSignalExternalId";

describe("oneSignalExternalId", () => {
  it("produz streamhub_user_25 só a partir do id", () => {
    expect(buildOneSignalExternalId(25)).toBe("streamhub_user_25");
    expect(buildOneSignalExternalId(25)).not.toContain("company");
  });

  it("par do usuário 25", () => {
    expect(expandOneSignalExternalIdAliases([25])).toEqual([
      "25",
      "streamhub_user_25"
    ]);
  });

  it("pares de 25 e 32 na ordem dos destinatários", () => {
    expect(expandOneSignalExternalIdAliases([25, 32])).toEqual([
      "25",
      "streamhub_user_25",
      "32",
      "streamhub_user_32"
    ]);
  });

  it("não repete alias quando o id vem duplicado", () => {
    expect(expandOneSignalExternalIdAliases([25, 25, 32, 25])).toEqual([
      "25",
      "streamhub_user_25",
      "32",
      "streamhub_user_32"
    ]);
  });
});
