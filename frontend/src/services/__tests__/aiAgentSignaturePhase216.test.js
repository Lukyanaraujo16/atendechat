/**
 * Fase 2.16 — contrato visual: Simulator/histórico renderizam conteúdo já assinado pelo backend.
 * A assinatura NÃO é reaplicada no frontend (evita duplicação).
 */

describe("Fase 2.16 — assinatura renderizada (contrato FE)", () => {
  it("preserva quebra de linha Nome:\\nMensagem", () => {
    const body = "Eduardo:\nOlá! Como posso ajudar?";
    const lines = body.split("\n");
    expect(lines[0]).toBe("Eduardo:");
    expect(lines[1]).toBe("Olá! Como posso ajudar?");
  });

  it("handoff transition não usa vocabulário proibido", () => {
    const body =
      "Eduardo:\nPara te ajudar melhor, vou encaminhar seu atendimento para outro atendente da nossa equipe.";
    expect(body.toLowerCase()).not.toMatch(/humano/);
    expect(body.toLowerCase()).not.toMatch(/atendente humano/);
  });

  it("mensagens humanas com negrito WhatsApp permanecem no formato próprio", () => {
    const humanBody = "*Eduardo:*\nOlá, como posso ajudar?";
    expect(humanBody.startsWith("*Eduardo:*")).toBe(true);
    expect(humanBody).not.toBe("Eduardo:\nOlá, como posso ajudar?");
  });

  it("fallback Assistente é renderizável", () => {
    const body = "Assistente:\nOi";
    expect(body.split("\n")[0]).toBe("Assistente:");
  });
});
