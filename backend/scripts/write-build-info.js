/**
 * Grava dist/build-info.json com o commit do código compilado (PT-9, P-B31-01).
 *
 * Roda no fim de `npm run build`, no mesmo checkout que está sendo compilado (install.sh,
 * MINIMAL_UPDATE e a sequência manual da 8.4 já chamam `npm run build`). O runtime só lê o
 * arquivo; não executa git durante requisições.
 *
 * Ordem: `git rev-parse HEAD` do checkout → GIT_COMMIT/COMMIT_SHA/GIT_SHA do ambiente de build
 * (ex.: build Docker sem .git) → null. Nunca inventa SHA. Falha aqui nunca quebra o build.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SHA_RE = /^[0-9a-f]{7,40}$/;
const backendDir = path.join(__dirname, "..");
const distDir = path.join(backendDir, "dist");
const outFile = path.join(distDir, "build-info.json");
const repoRoot = path.resolve(backendDir, "..");

function git(args) {
  try {
    // safe.directory: o build pode rodar como root num checkout de outro usuário
    // (install.sh); só comandos de leitura.
    return execFileSync("git", ["-c", `safe.directory=${repoRoot}`, ...args], {
      cwd: backendDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000
    }).trim();
  } catch {
    return null;
  }
}

function resolveCommit() {
  const fromGit = (git(["rev-parse", "HEAD"]) || "").toLowerCase();
  if (SHA_RE.test(fromGit)) {
    // Só arquivos versionados; não grava nomes de arquivo, só o booleano.
    const status = git(["status", "--porcelain", "--untracked-files=no"]);
    return { commit: fromGit, source: "git", dirty: status === null ? null : status !== "" };
  }
  for (const key of ["GIT_COMMIT", "COMMIT_SHA", "GIT_SHA"]) {
    const raw = String(process.env[key] || "").trim().toLowerCase();
    if (SHA_RE.test(raw)) return { commit: raw, source: "build_env", dirty: null };
  }
  return { commit: null, source: null, dirty: null };
}

try {
  if (!fs.existsSync(distDir)) {
    console.warn("[write-build-info] dist/ não encontrado — nada gravado.");
    process.exit(0);
  }
  const { commit, source, dirty } = resolveCommit();
  const payload = { commit, commitSource: source, dirty, builtAt: new Date().toISOString() };
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[write-build-info] ${outFile} → ${commit || "commit indisponível"}`);
} catch (err) {
  console.warn(`[write-build-info] não gravado: ${err && err.message ? err.message : err}`);
}
