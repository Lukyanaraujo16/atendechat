import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  readAppBuildInfoFile,
  resolveAppBuildInfo
} from "../../../config/appBuildInfo";

/**
 * P-B31-01 — versão do backend em execução: `scripts/write-build-info.js` grava
 * `dist/build-info.json` no `npm run build`; o runtime só lê o arquivo.
 */
const SCRIPT = path.join(__dirname, "../../../../scripts/write-build-info.js");
const SHA = "1234567890abcdef1234567890abcdef12345678";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "b31-build-info-"));
}

/** Copia o script para <root>/backend/scripts e cria <root>/backend/dist. */
function stageBackend(root: string): string {
  const backend = path.join(root, "backend");
  fs.mkdirSync(path.join(backend, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(backend, "dist"));
  fs.copyFileSync(SCRIPT, path.join(backend, "scripts", "write-build-info.js"));
  return backend;
}

function runScript(backend: string, env: Record<string, string | undefined> = {}) {
  const cleanEnv = { ...process.env };
  ["GIT_COMMIT", "COMMIT_SHA", "GIT_SHA", "GIT_DIR", "GIT_WORK_TREE"].forEach(k => delete cleanEnv[k]);
  execFileSync(process.execPath, [path.join(backend, "scripts", "write-build-info.js")], {
    env: { ...cleanEnv, ...env, GIT_CEILING_DIRECTORIES: path.dirname(path.dirname(backend)) },
    stdio: "ignore"
  });
  return JSON.parse(fs.readFileSync(path.join(backend, "dist", "build-info.json"), "utf8"));
}

function git(cwd: string, args: string[]) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    stdio: "ignore"
  });
}

describe("P-B31-01 — identificação de versão", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach(d => fs.rmSync(d, { recursive: true, force: true })));

  describe("runtime (appBuildInfo)", () => {
    it("lê o arquivo de build e valida o SHA; ausente/inválido → null, sem lançar", () => {
      const dir = tmpDir();
      dirs.push(dir);
      const file = path.join(dir, "build-info.json");
      fs.writeFileSync(file, JSON.stringify({ commit: SHA.toUpperCase(), dirty: false, builtAt: "2026-10-20T10:00:00.000Z" }));
      expect(readAppBuildInfoFile(file)).toEqual({
        commit: SHA,
        dirty: false,
        builtAt: "2026-10-20T10:00:00.000Z"
      });

      fs.writeFileSync(file, JSON.stringify({ commit: "build-42", dirty: "sim", builtAt: "ontem" }));
      expect(readAppBuildInfoFile(file)).toEqual({ commit: null, dirty: null, builtAt: null });

      fs.writeFileSync(file, "{nao-json");
      expect(readAppBuildInfoFile(file)).toBeNull();
      expect(readAppBuildInfoFile(path.join(dir, "nao-existe.json"))).toBeNull();
    });

    it("arquivo de build tem precedência sobre env (env antigo no .env não engana)", () => {
      const info = resolveAppBuildInfo(
        { commit: SHA, dirty: true, builtAt: "2026-10-20T10:00:00.000Z" },
        { GIT_COMMIT: "aaaaaaa" }
      );
      expect(info).toEqual({
        commit: SHA,
        source: "build_info",
        dirty: true,
        builtAt: "2026-10-20T10:00:00.000Z"
      });
    });

    it("sem commit no arquivo → env válido; senão null (nunca inventa)", () => {
      expect(resolveAppBuildInfo(null, { COMMIT_SHA: "abcdef1" })).toMatchObject({
        commit: "abcdef1",
        source: "env"
      });
      expect(resolveAppBuildInfo({ commit: null, dirty: null, builtAt: null }, { BACKEND_BUILD_STAMP: "build-42" })).toEqual({
        commit: null,
        source: null,
        dirty: null,
        builtAt: null
      });
    });
  });

  describe("build (scripts/write-build-info.js)", () => {
    it("checkout git: grava o HEAD e o estado dirty (só arquivos versionados)", () => {
      const root = tmpDir();
      dirs.push(root);
      const backend = stageBackend(root);
      git(root, ["init", "-q"]);
      fs.writeFileSync(path.join(root, "a.txt"), "1");
      git(root, ["add", "a.txt"]);
      git(root, ["commit", "-q", "-m", "c1"]);
      const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

      // dist/ e scripts/ não versionados (como no projeto, dist é ignorado) → limpo.
      let info = runScript(backend, { GIT_COMMIT: "aaaaaaa" });
      expect(info).toMatchObject({ commit: head, commitSource: "git", dirty: false });
      expect(Date.parse(info.builtAt)).not.toBeNaN();

      fs.writeFileSync(path.join(root, "a.txt"), "2");
      info = runScript(backend);
      expect(info).toMatchObject({ commit: head, dirty: true });
      expect(JSON.stringify(info)).not.toContain("a.txt");
    });

    it("sem git: usa GIT_COMMIT do build; sem nada → null", () => {
      const root = tmpDir();
      dirs.push(root);
      const backend = stageBackend(root);
      expect(runScript(backend, { GIT_COMMIT: SHA })).toMatchObject({
        commit: SHA,
        commitSource: "build_env",
        dirty: null
      });
      expect(runScript(backend, { GIT_COMMIT: "nao-e-sha" })).toMatchObject({
        commit: null,
        commitSource: null
      });
    });

    it("sem dist/ não grava nada e não falha o build", () => {
      const root = tmpDir();
      dirs.push(root);
      const backend = stageBackend(root);
      fs.rmSync(path.join(backend, "dist"), { recursive: true });
      expect(() =>
        execFileSync(process.execPath, [path.join(backend, "scripts", "write-build-info.js")], {
          stdio: "ignore"
        })
      ).not.toThrow();
      expect(fs.existsSync(path.join(backend, "dist"))).toBe(false);
    });
  });
});
