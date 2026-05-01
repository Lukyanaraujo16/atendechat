import path from "path";

/** Pasta `public/` na raiz do backend (mesma convenção de `config/upload.ts`). */
export function getBackendPublicFolder(): string {
  return path.resolve(__dirname, "..", "..", "public");
}
