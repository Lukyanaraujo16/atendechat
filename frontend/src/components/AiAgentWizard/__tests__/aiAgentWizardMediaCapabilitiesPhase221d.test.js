/**
 * Fase 2.21D — o mapper REAL deve preservar flags de mídia da Product API.
 */
import {
  mapAiAgentWizardProductOptions,
  resolveMediaCapabilityReason,
  resolveSelectedModelMediaCaps,
} from "../aiAgentWizardProductMapper";

const productOptions = {
  providers: [
    { value: "openai", label: "OpenAI", available: true },
    { value: "gemini", label: "Google Gemini", available: true },
  ],
  models: [
    {
      value: "gpt-4o-mini",
      label: "gpt-4o-mini",
      provider: "openai",
      supportsText: true,
      supportsVision: true,
      supportsAudioTranscription: true,
    },
    {
      value: "gpt-4o",
      label: "gpt-4o",
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
  ],
};

describe("Fase 2.21D — mapAiAgentWizardProductOptions preserva media caps", () => {
  const mapped = mapAiAgentWizardProductOptions(productOptions);

  it("normalizeModel preserva supportsVision e supportsAudioTranscription", () => {
    const mini = mapped.models.find((m) => m.value === "gpt-4o-mini");
    expect(mini.supportsVision).toBe(true);
    expect(mini.supportsAudioTranscription).toBe(true);
    expect(mini.supportsText).toBe(true);
  });

  it("gpt-4o-mini aparece com visão e áudio", () => {
    const caps = resolveSelectedModelMediaCaps(mapped.models, "gpt-4o-mini");
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("gpt-4o aparece com visão e áudio", () => {
    const caps = resolveSelectedModelMediaCaps(mapped.models, "gpt-4o");
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("OpenAI sem visão não inventa visão, mas áudio permanece via STT", () => {
    const caps = resolveSelectedModelMediaCaps(
      mapped.models,
      "gpt-3.5-turbo-1106"
    );
    expect(caps.supportsVision).toBe(false);
    expect(caps.supportsAudioTranscription).toBe(true);
    expect(
      resolveMediaCapabilityReason({
        kind: "vision",
        caps,
        hasModel: true,
        hasCredential: true,
      })
    ).toBe("reasonModel");
    expect(
      resolveMediaCapabilityReason({
        kind: "audio",
        caps,
        hasModel: true,
        hasCredential: true,
      })
    ).toBeNull();
  });

  it("Gemini flash reflete registry (visão + áudio)", () => {
    const caps = resolveSelectedModelMediaCaps(
      mapped.models,
      "gemini-2.5-flash"
    );
    expect(caps.supportsVision).toBe(true);
    expect(caps.supportsAudioTranscription).toBe(true);
  });

  it("áudio indisponível usa motivo de provider/STT, não de modelo", () => {
    const caps = {
      supportsText: true,
      supportsVision: true,
      supportsAudioTranscription: false,
    };
    expect(
      resolveMediaCapabilityReason({
        kind: "audio",
        caps,
        hasModel: true,
        hasCredential: true,
      })
    ).toBe("reasonProvider");
  });

  it("modelo em string não inventa visão/áudio", () => {
    const mappedStrings = mapAiAgentWizardProductOptions({
      models: ["gpt-4o-mini"],
    });
    expect(mappedStrings.models[0].supportsVision).toBe(false);
    expect(mappedStrings.models[0].supportsAudioTranscription).toBe(false);
  });
});
