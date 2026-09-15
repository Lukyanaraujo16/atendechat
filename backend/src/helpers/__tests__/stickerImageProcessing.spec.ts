/**
 * @jest-environment node
 *
 * Sharp's native addon does not load inside Jest on this repo; the runtime
 * script executes the real helper with Node + ts-node.
 */
import { execFileSync } from "child_process";
import path from "path";

const runtime = path.join(__dirname, "stickerImageProcessing.runtime.js");
const backendRoot = path.resolve(__dirname, "../../..");

function runProcessingReport() {
  const stdout = execFileSync(process.execPath, [runtime], {
    encoding: "utf8",
    cwd: backendRoot,
    timeout: 60000,
    env: { ...process.env, TS_NODE_TRANSPILE_ONLY: "1" }
  });
  return JSON.parse(stdout);
}

describe("stickerImageProcessing", () => {
  const report = runProcessingReport();

  it("WebP estático válido continua funcionando", () => {
    expect(report.staticPassThrough).toBe(true);
    expect(report.staticAnimated).toBe(false);
    expect(report.staticPages).toBe(1);
  });

  it("WebP animado dentro dos limites faz pass-through e preserva frames", () => {
    expect(report.animInputPages).toBe(3);
    expect(report.animPassThrough).toBe(true);
    expect(report.animOutputAnimated).toBe(true);
    expect(report.animOutputPages).toBe(3);
  });

  it("WebP animado que precisa reprocessar permanece animado", () => {
    expect(report.bigInputPages).toBe(2);
    expect(report.bigReencoded).toBe(true);
    expect(report.bigOutputAnimated).toBe(true);
    expect(report.bigOutputPages).toBe(2);
    expect(report.bigOutputWidth).toBeLessThanOrEqual(512);
    expect(report.bigOutputBytesOk).toBe(true);
  });

  it("PNG continua convertido para WebP estático", () => {
    expect(report.pngFormat).toBe("webp");
    expect(report.pngAnimated).toBe(false);
    expect(report.pngPages).toBe(1);
  });

  it("JPEG continua convertido para WebP estático", () => {
    expect(report.jpegFormat).toBe("webp");
    expect(report.jpegAnimated).toBe(false);
    expect(report.jpegPages).toBe(1);
  });

  it("limites de dimensão/tamanho continuam respeitados no WebP estático grande", () => {
    expect(report.largeStaticReencoded).toBe(true);
    expect(report.largeStaticWidth).toBeLessThanOrEqual(512);
    expect(report.largeStaticHeight).toBeLessThanOrEqual(512);
    expect(report.largeStaticAnimated).toBe(false);
    expect(report.largeStaticBytesOk).toBe(true);
  });
});
