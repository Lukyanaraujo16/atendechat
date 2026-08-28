import {
  buildEvolutionWebhookPublicBaseUrl,
  buildEvolutionWebhookUrl
} from "../evolutionWebhookPublicUrl";

describe("evolutionWebhookPublicUrl Fase 10", () => {
  const prevBackend = process.env.BACKEND_URL;
  const prevDedicated = process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL;
  const prevProxy = process.env.PROXY_PORT;

  afterEach(() => {
    if (prevBackend === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevBackend;
    if (prevDedicated === undefined)
      delete process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL;
    else process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL = prevDedicated;
    if (prevProxy === undefined) delete process.env.PROXY_PORT;
    else process.env.PROXY_PORT = prevProxy;
  });

  it("usa BACKEND_URL", () => {
    delete process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL;
    process.env.BACKEND_URL = "https://api.streamhub.test";
    expect(buildEvolutionWebhookUrl(15)).toBe(
      "https://api.streamhub.test/webhooks/evolution/15"
    );
  });

  it("EVOLUTION_WEBHOOK_PUBLIC_BASE_URL sobrescreve", () => {
    process.env.BACKEND_URL = "https://ignored.test";
    process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL = "https://public.evo.test";
    expect(buildEvolutionWebhookPublicBaseUrl()).toBe(
      "https://public.evo.test"
    );
  });

  it("sem base → null", () => {
    delete process.env.BACKEND_URL;
    delete process.env.EVOLUTION_WEBHOOK_PUBLIC_BASE_URL;
    expect(buildEvolutionWebhookUrl(1)).toBeNull();
  });
});
