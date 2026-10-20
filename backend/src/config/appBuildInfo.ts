import fs from "fs";
import path from "path";

/**
 * Versão (commit) do código em execução — Fase 8.3-B3 PT-9 / P-B31-01.
 *
 * Fonte principal: `dist/build-info.json`, gravado por `scripts/write-build-info.js` no fim de
 * `npm run build`, no checkout compilado. É lido uma vez, quando o módulo carrega (boot): um
 * rebuild com o processo antigo ainda no ar não troca a versão informada por ele.
 * Fallback: variável de ambiente (GIT_COMMIT, COMMIT_SHA, GIT_SHA, BACKEND_BUILD_STAMP), para
 * builds sem `.git`. Sem git em runtime. Só aceita SHA hexadecimal (7–40); o resto é desconhecido.
 */
const SHA_RE = /^[0-9a-f]{7,40}$/;

const COMMIT_ENV_KEYS = [
  "GIT_COMMIT",
  "COMMIT_SHA",
  "GIT_SHA",
  "BACKEND_BUILD_STAMP"
] as const;

export type AppBuildInfoFile = {
  commit: string | null;
  dirty: boolean | null;
  builtAt: string | null;
};

export type AppBuildInfo = {
  commit: string | null;
  source: "build_info" | "env" | null;
  /** Árvore com alterações não commitadas no build; null = desconhecido. */
  dirty: boolean | null;
  builtAt: string | null;
};

const DEFAULT_BUILD_INFO_FILE = path.join(__dirname, "..", "build-info.json");

function normalizeSha(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return SHA_RE.test(v) ? v : null;
}

/** Lê e valida o arquivo; ausente ou inválido → null (nunca lança). */
export function readAppBuildInfoFile(file: string): AppBuildInfoFile | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      commit: normalizeSha(parsed.commit),
      dirty: typeof parsed.dirty === "boolean" ? parsed.dirty : null,
      builtAt:
        typeof parsed.builtAt === "string" && !Number.isNaN(Date.parse(parsed.builtAt))
          ? parsed.builtAt
          : null
    };
  } catch {
    return null;
  }
}

export function resolveAppBuildInfo(
  file: AppBuildInfoFile | null,
  env: NodeJS.ProcessEnv
): AppBuildInfo {
  if (file?.commit) {
    return { commit: file.commit, source: "build_info", dirty: file.dirty, builtAt: file.builtAt };
  }
  for (const key of COMMIT_ENV_KEYS) {
    const commit = normalizeSha(env[key]);
    if (commit) return { commit, source: "env", dirty: null, builtAt: file?.builtAt ?? null };
  }
  return { commit: null, source: null, dirty: null, builtAt: file?.builtAt ?? null };
}

const BUILD_INFO_FILE = readAppBuildInfoFile(DEFAULT_BUILD_INFO_FILE);

export function getAppBuildInfo(): AppBuildInfo {
  return resolveAppBuildInfo(BUILD_INFO_FILE, process.env);
}

export function getAppBuildCommit(): string | null {
  return getAppBuildInfo().commit;
}

/**
 * Compara commits aceitando abreviação (prefixo). Desconhecido nunca é "igual".
 */
export function isSameAppCommit(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.startsWith(y) || y.startsWith(x);
}
