/**
 * Substitui __BRANDING_BOOTSTRAP_SRC__ em build/index.html pela URL do script de branding.
 * Prioridade: REACT_APP_BACKEND_URL do frontend/.env; senão URL relativa (proxy Nginx mesma origem).
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function readBackendUrlFromEnvFile(filePath) {
  try {
    const s = fs.readFileSync(filePath, "utf8");
    const m = s.match(/^REACT_APP_BACKEND_URL=(.+)$/m);
    if (!m) return "";
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v.replace(/\r$/, "").trim();
  } catch {
    return "";
  }
}

const buildIndex = path.join(__dirname, "..", "build", "index.html");
if (!fs.existsSync(buildIndex)) {
  console.warn("[patch-index-html-branding] build/index.html não encontrado — ignore em dev.");
  process.exit(0);
}

const envFile = path.join(__dirname, "..", ".env");
const base = readBackendUrlFromEnvFile(envFile).replace(/\/$/, "");
const src = base
  ? `${base}/system-settings/branding-bootstrap.js`
  : "/system-settings/branding-bootstrap.js";

let html = fs.readFileSync(buildIndex, "utf8");
if (!html.includes("__BRANDING_BOOTSTRAP_SRC__")) {
  console.warn(
    "[patch-index-html-branding] placeholder __BRANDING_BOOTSTRAP_SRC__ ausente em index.html"
  );
  process.exit(0);
}
html = html.split("__BRANDING_BOOTSTRAP_SRC__").join(src);
fs.writeFileSync(buildIndex, html, "utf8");
console.log("[patch-index-html-branding] OK →", src);
