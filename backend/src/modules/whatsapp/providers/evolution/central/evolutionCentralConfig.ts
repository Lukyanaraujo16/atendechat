import AppError from "../../../../../errors/AppError";
import {
  ERR_EVOLUTION_CENTRAL_CONFIG_INVALID,
  ERR_EVOLUTION_CENTRAL_CONFIG_MISSING
} from "../evolutionErrors";

export type EvolutionCentralConfig = {
  baseUrl: string;
  apiKey: string;
};

/**
 * Configuração central Evolution (infra StreamHub).
 * Env: EVOLUTION_CENTRAL_BASE_URL + EVOLUTION_CENTRAL_API_KEY
 * Nunca logar valores. Não expor via API.
 */
export function loadEvolutionCentralConfig(): EvolutionCentralConfig | null {
  const baseUrl = String(process.env.EVOLUTION_CENTRAL_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(process.env.EVOLUTION_CENTRAL_API_KEY || "").trim();
  if (!baseUrl || !apiKey) {
    return null;
  }
  return { baseUrl, apiKey };
}

export function validateEvolutionCentralConfig(
  config: EvolutionCentralConfig
): void {
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw new AppError(
      ERR_EVOLUTION_CENTRAL_CONFIG_INVALID,
      400,
      "EVOLUTION_CENTRAL_BASE_URL inválida"
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError(
      ERR_EVOLUTION_CENTRAL_CONFIG_INVALID,
      400,
      "EVOLUTION_CENTRAL_BASE_URL deve ser http ou https"
    );
  }
  if (!String(config.apiKey || "").trim()) {
    throw new AppError(
      ERR_EVOLUTION_CENTRAL_CONFIG_INVALID,
      400,
      "EVOLUTION_CENTRAL_API_KEY vazia"
    );
  }
}

export function requireEvolutionCentralConfig(): EvolutionCentralConfig {
  const config = loadEvolutionCentralConfig();
  if (!config) {
    throw new AppError(
      ERR_EVOLUTION_CENTRAL_CONFIG_MISSING,
      503,
      "Provisionamento Evolution central não configurado no servidor"
    );
  }
  validateEvolutionCentralConfig(config);
  return config;
}
