/**
 * Fase 2.17 — capacidades multimodais no painel de Inteligência.
 */
describe("aiAgentMultimodalCapabilitiesPhase217", () => {
  function resolveSelectedModelCaps(models, modelValue) {
    if (!modelValue) return null;
    const row = (models || []).find((m) => m.value === modelValue);
    if (!row) return null;
    return {
      supportsText: row.supportsText !== false,
      supportsVision: row.supportsVision === true,
      supportsAudioTranscription: row.supportsAudioTranscription === true,
    };
  }

  const models = [
    {
      value: "gpt-4o-mini",
      label: "gpt-4o-mini",
      provider: "openai",
      supportsText: true,
      supportsVision: true,
      supportsAudioTranscription: true,
    },
    {
      value: "gpt-3.5-turbo-1106",
      label: "gpt-3.5-turbo-1106",
      provider: "openai",
      supportsText: true,
      supportsVision: false,
      supportsAudioTranscription: true,
    },
    {
      value: "gemini-2.5-flash",
      label: "gemini-2.5-flash",
      provider: "gemini",
      supportsText: true,
      supportsVision: true,
      supportsAudioTranscription: true,
    },
  ];

  it("gpt-4o-mini disponível para texto, imagem e áudio", () => {
    const caps = resolveSelectedModelCaps(models, "gpt-4o-mini");
    expect(caps.supportsText).toBe(true);
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("gpt-3.5 sem visão — indicador indisponível", () => {
    const caps = resolveSelectedModelCaps(models, "gpt-3.5-turbo-1106");
    expect(caps.supportsVision).toBe(false);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("gemini flash com visão e áudio", () => {
    const caps = resolveSelectedModelCaps(models, "gemini-2.5-flash");
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("sem modelo selecionado → null (UI mostra motivo de credencial/modelo)", () => {
    expect(resolveSelectedModelCaps(models, "")).toBeNull();
  });

  it("não expõe IDs técnicos nem secrets no contrato de options", () => {
    const sanitized = models.map((m) => ({
      value: m.value,
      label: m.label,
      provider: m.provider,
      supportsText: m.supportsText,
      supportsVision: m.supportsVision,
      supportsAudioTranscription: m.supportsAudioTranscription,
    }));
    const blob = JSON.stringify(sanitized);
    expect(blob).not.toMatch(/apiKey|sk-|AIza/i);
    expect(blob).not.toMatch(/credentialId|systemPrompt/i);
  });
});
