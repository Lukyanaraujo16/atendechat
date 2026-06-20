import { Request } from "express";

/**
 * Normaliza arquivos enviados via multer em POST /messages/:ticketId.
 * upload.array("medias") preenche req.files como File[]; este helper cobre variações.
 */
const extractMessageUploadMedias = (
  req: Request
): Express.Multer.File[] => {
  const raw = req.files as
    | Express.Multer.File[]
    | Record<string, Express.Multer.File[]>
    | undefined;

  if (Array.isArray(raw)) {
    return raw.filter(Boolean);
  }

  if (raw && typeof raw === "object") {
    const fromMedias = raw.medias;
    if (Array.isArray(fromMedias)) {
      return fromMedias.filter(Boolean);
    }
  }

  const single = req.file as Express.Multer.File | undefined;
  return single ? [single] : [];
};

export default extractMessageUploadMedias;
