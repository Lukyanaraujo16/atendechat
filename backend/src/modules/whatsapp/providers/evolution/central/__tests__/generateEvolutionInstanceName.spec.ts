import { generateEvolutionInstanceName } from "../generateEvolutionInstanceName";

describe("generateEvolutionInstanceName", () => {
  it("gera nome técnico único por companyId + whatsappId", () => {
    expect(
      generateEvolutionInstanceName({ companyId: 7, whatsappId: 42 })
    ).toBe("streamhub-c7-w42");
  });

  it("empresas diferentes geram instanceNames diferentes", () => {
    const a = generateEvolutionInstanceName({ companyId: 1, whatsappId: 10 });
    const b = generateEvolutionInstanceName({ companyId: 2, whatsappId: 10 });
    expect(a).not.toBe(b);
  });

  it("duas conexões na mesma empresa geram instanceNames diferentes", () => {
    const a = generateEvolutionInstanceName({ companyId: 5, whatsappId: 1 });
    const b = generateEvolutionInstanceName({ companyId: 5, whatsappId: 2 });
    expect(a).not.toBe(b);
  });

  it("concorrência: nomes distintos para pares distintos", () => {
    const names = new Set(
      Array.from({ length: 50 }, (_, i) =>
        generateEvolutionInstanceName({ companyId: 1, whatsappId: i + 1 })
      )
    );
    expect(names.size).toBe(50);
  });
});
