import { promises as fs } from "fs";
import path from "path";
import { incrementCompanyStorageUsage } from "../../../../../services/CompanyService/adjustCompanyStorageUsage";
import { EvolutionExtractedMedia } from "./EvolutionMediaExtractor";

/**
 * Persistência de arquivo de mídia Evolution em public/ (mesmo padrão Baileys).
 * mediaUrl relativo = filename sob public/.
 */
export async function persistEvolutionMediaFile(input: {
  companyId: number;
  media: EvolutionExtractedMedia;
  /** Diretório override (testes). Default: backend/public */
  publicDir?: string;
}): Promise<{ relativeFilename: string; absolutePath: string }> {
  const publicDir =
    input.publicDir ||
    path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "public");
  await fs.mkdir(publicDir, { recursive: true });

  const absolutePath = path.join(publicDir, input.media.filename);
  // Impede path traversal no filename.
  if (!absolutePath.startsWith(publicDir)) {
    throw new Error("ERR_EVOLUTION_MEDIA_PATH_TRAVERSAL");
  }

  await fs.writeFile(absolutePath, input.media.data);
  // eslint-disable-next-line no-void
  void incrementCompanyStorageUsage(input.companyId, input.media.data.length);

  return {
    relativeFilename: input.media.filename,
    absolutePath
  };
}
