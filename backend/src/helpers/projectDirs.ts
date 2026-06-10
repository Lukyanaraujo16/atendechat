import fs from "fs";
import path from "path";
import AppError from "../errors/AppError";
import { resolveAppRoot } from "./appRoot";

export function getBackendDir(): string {
  const { root } = resolveAppRoot();
  return path.join(root, "backend");
}

export function getFrontendDir(): string {
  const { root } = resolveAppRoot();
  return path.join(root, "frontend");
}

export function assertProjectSubdir(kind: "backend" | "frontend"): string {
  const dir = kind === "backend" ? getBackendDir() : getFrontendDir();
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new AppError("SYSTEM_UPDATE_DIR_NOT_FOUND", 400, undefined, { kind });
  }
  const pkg = path.join(dir, "package.json");
  if (!fs.existsSync(pkg)) {
    throw new AppError("SYSTEM_UPDATE_PACKAGE_JSON_MISSING", 400, undefined, {
      kind
    });
  }
  return dir;
}
