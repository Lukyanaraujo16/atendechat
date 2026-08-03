/**
 * Gera build/version.json e injeta meta shc-build-version no index.html.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const buildDir = path.join(__dirname, "..", "build");
const outFile = path.join(buildDir, "version.json");
const indexFile = path.join(buildDir, "index.html");

function resolveVersion() {
  if (process.env.REACT_APP_BUILD_ID) {
    return String(process.env.REACT_APP_BUILD_ID).trim();
  }
  if (process.env.GITHUB_SHA) {
    return String(process.env.GITHUB_SHA).trim().slice(0, 12);
  }
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: path.join(__dirname, "..", ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return `build-${Date.now()}`;
  }
}

if (!fs.existsSync(buildDir)) {
  console.warn("[write-version-json] build/ não encontrado — ignore em dev.");
  process.exit(0);
}

const payload = {
  version: resolveVersion(),
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[write-version-json] ${outFile} → ${payload.version}`);

if (fs.existsSync(indexFile)) {
  let html = fs.readFileSync(indexFile, "utf8");
  const meta = `<meta name="shc-build-version" content="${payload.version}"/>`;
  if (/name=["']shc-build-version["']/.test(html)) {
    html = html.replace(
      /<meta\s+name=["']shc-build-version["']\s+content=["'][^"']*["']\s*\/?>/i,
      meta
    );
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  }
  fs.writeFileSync(indexFile, html, "utf8");
  console.log("[write-version-json] meta shc-build-version injetada no index.html");
}
