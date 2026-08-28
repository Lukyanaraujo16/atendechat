import AppError from "../../../../../../errors/AppError";
import {
  loadEvolutionCentralConfig,
  requireEvolutionCentralConfig,
  validateEvolutionCentralConfig
} from "../evolutionCentralConfig";
import {
  ERR_EVOLUTION_CENTRAL_CONFIG_INVALID,
  ERR_EVOLUTION_CENTRAL_CONFIG_MISSING
} from "../../evolutionErrors";

describe("evolutionCentralConfig", () => {
  const prevBase = process.env.EVOLUTION_CENTRAL_BASE_URL;
  const prevKey = process.env.EVOLUTION_CENTRAL_API_KEY;

  afterEach(() => {
    if (prevBase === undefined) {
      delete process.env.EVOLUTION_CENTRAL_BASE_URL;
    } else {
      process.env.EVOLUTION_CENTRAL_BASE_URL = prevBase;
    }
    if (prevKey === undefined) {
      delete process.env.EVOLUTION_CENTRAL_API_KEY;
    } else {
      process.env.EVOLUTION_CENTRAL_API_KEY = prevKey;
    }
  });

  it("loadEvolutionCentralConfig retorna null quando env ausente", () => {
    delete process.env.EVOLUTION_CENTRAL_BASE_URL;
    delete process.env.EVOLUTION_CENTRAL_API_KEY;
    expect(loadEvolutionCentralConfig()).toBeNull();
  });

  it("loadEvolutionCentralConfig normaliza baseUrl e lê apiKey", () => {
    process.env.EVOLUTION_CENTRAL_BASE_URL = "https://evo.example/";
    process.env.EVOLUTION_CENTRAL_API_KEY = "global-key";
    expect(loadEvolutionCentralConfig()).toEqual({
      baseUrl: "https://evo.example",
      apiKey: "global-key"
    });
  });

  it("requireEvolutionCentralConfig falha com ERR_EVOLUTION_CENTRAL_CONFIG_MISSING", () => {
    delete process.env.EVOLUTION_CENTRAL_BASE_URL;
    delete process.env.EVOLUTION_CENTRAL_API_KEY;
    expect(() => requireEvolutionCentralConfig()).toThrow(AppError);
    try {
      requireEvolutionCentralConfig();
    } catch (err) {
      expect((err as AppError).message).toBe(
        ERR_EVOLUTION_CENTRAL_CONFIG_MISSING
      );
      expect((err as AppError).statusCode).toBe(503);
    }
  });

  it("validateEvolutionCentralConfig rejeita URL inválida", () => {
    expect(() =>
      validateEvolutionCentralConfig({
        baseUrl: "not-a-url",
        apiKey: "k"
      })
    ).toThrow(
      expect.objectContaining({ message: ERR_EVOLUTION_CENTRAL_CONFIG_INVALID })
    );
  });

  it("validateEvolutionCentralConfig rejeita apiKey vazia", () => {
    expect(() =>
      validateEvolutionCentralConfig({
        baseUrl: "https://evo.example",
        apiKey: "   "
      })
    ).toThrow(
      expect.objectContaining({ message: ERR_EVOLUTION_CENTRAL_CONFIG_INVALID })
    );
  });
});
