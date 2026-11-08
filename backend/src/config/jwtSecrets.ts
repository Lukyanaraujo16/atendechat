/**
 * Segredos JWT: sem fallback. O backend não inicia com valor ausente, curto, público ou repetido.
 *
 * Compatível com instalações existentes: aceita qualquer segredo próprio com 32+ caracteres
 * (o instalador antigo gerava `openssl rand -base64 32` = 44; o atual, 64 hex).
 * Gerar: openssl rand -hex 32
 */

export const JWT_SECRET_MIN_LENGTH = 32;

/** Valores que já foram publicados (fallbacks antigos e .env.example versionado). */
const KNOWN_INSECURE_JWT_SECRETS = new Set([
  "mysecret",
  "myanothersecret",
  "kZaOTd+YZpjRUyyuQUpigJaEMk4vcW4YOymKPZX0Ts8=",
  "dBSXqFg9TaNUEDXVp6fhMTRLBysP+j2DSqf7+raxD3A=",
  "secret",
  "changeme"
]);

export type JwtSecrets = { secret: string; refreshSecret: string };

type Env = Record<string, string | undefined>;

/** Lista de problemas (só nomes de variáveis, nunca valores). Vazia = configuração válida. */
export function validateJwtSecrets(env: Env = process.env): string[] {
  const problems: string[] = [];
  const check = (name: string): string => {
    const value = String(env[name] ?? "").trim();
    if (!value) {
      problems.push(`${name} ausente ou vazio`);
    } else if (KNOWN_INSECURE_JWT_SECRETS.has(value)) {
      problems.push(`${name} usa um valor público conhecido`);
    } else if (value.length < JWT_SECRET_MIN_LENGTH) {
      problems.push(`${name} tem menos de ${JWT_SECRET_MIN_LENGTH} caracteres`);
    }
    return value;
  };
  const secret = check("JWT_SECRET");
  const refreshSecret = check("JWT_REFRESH_SECRET");
  // Iguais: um refresh token (7 dias) seria aceito como token de acesso.
  if (secret && secret === refreshSecret) {
    problems.push("JWT_SECRET e JWT_REFRESH_SECRET são iguais");
  }
  return problems;
}

export class JwtConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Configuração JWT inválida: ${problems.join("; ")}. ` +
        "Defina valores próprios no backend/.env (openssl rand -hex 32) " +
        "ou execute: sudo bash install.sh --reconfigurar (opção 3)."
    );
    this.name = "JwtConfigError";
  }
}

/** Retorna os segredos válidos ou lança JwtConfigError. */
export function requireJwtSecrets(env: Env = process.env): JwtSecrets {
  const problems = validateJwtSecrets(env);
  if (problems.length) throw new JwtConfigError(problems);
  // Valor exatamente como configurado: tokens já emitidos continuam válidos.
  return {
    secret: String(env.JWT_SECRET),
    refreshSecret: String(env.JWT_REFRESH_SECRET)
  };
}
