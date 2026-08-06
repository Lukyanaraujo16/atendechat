/**
 * Preservação: manifest, kill-switch, OneSignal workers, AppVersionGate.
 */
import fs from "fs";
import path from "path";

const frontendRoot = path.join(__dirname, "../../..");
const publicDir = path.join(frontendRoot, "public");

describe("PWA assets preservados / manifest", () => {
  it("manifest válido com marca StreamHUB e ícones", () => {
    const raw = fs.readFileSync(path.join(publicDir, "manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    expect(manifest.name).toBe("StreamHUB Chat");
    expect(manifest.short_name).toBe("StreamHUB");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.scope).toBeTruthy();
    const sizes = (manifest.icons || []).map((i) => i.sizes);
    expect(sizes.some((s) => String(s).includes("192"))).toBe(true);
    expect(sizes.some((s) => String(s).includes("512"))).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("kill-switch service-worker.js preservado (anti-cache, sem Workbox)", () => {
    const sw = fs.readFileSync(path.join(publicDir, "service-worker.js"), "utf8");
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/unregister/);
    expect(sw).toMatch(/workbox|precache/i);
    expect(sw).not.toMatch(/workbox-webpack-plugin|precacheAndRoute|clientsClaim\(\)/);
    expect(sw.toLowerCase()).not.toContain("importscripts");
  });

  it("OneSignal workers preservados na public/", () => {
    expect(
      fs.existsSync(path.join(publicDir, "OneSignalSDKWorker.js"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(publicDir, "OneSignalSDKUpdaterWorker.js"))
    ).toBe(true);
    const worker = fs.readFileSync(
      path.join(publicDir, "OneSignalSDKWorker.js"),
      "utf8"
    );
    expect(worker.length).toBeGreaterThan(0);
  });
});
