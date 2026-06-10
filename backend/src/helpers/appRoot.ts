import fs from "fs";
import path from "path";

export type AppRootStrategy = "APP_ROOT_ENV" | "BACKEND_PARENT_FALLBACK";

export function resolveAppRoot(): { root: string; strategy: AppRootStrategy } {
  const fromEnv = String(process.env.APP_ROOT || "").trim();
  if (fromEnv) {
    return { root: path.resolve(fromEnv), strategy: "APP_ROOT_ENV" };
  }
  // dist/helpers → backend → repo root
  const fallback = path.resolve(__dirname, "..", "..", "..");
  return { root: fallback, strategy: "BACKEND_PARENT_FALLBACK" };
}

export function assertAppRootIsGitRepo(root: string): void {
  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error("APP_ROOT_NOT_GIT_REPO");
  }
}
