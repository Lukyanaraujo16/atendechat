import { Request, Response } from "express";
import multer from "multer";
import AppError from "../errors/AppError";
import { MAX_P12_BYTES } from "../services/SaasBilling/efiCertificateStore";
import {
  activateEfiAdminConfig,
  deactivateEfiAdminConfig,
  deleteEfiCertificate,
  getEfiAdminConfigSafe,
  listEfiAdminAudits,
  revokeEfiAdminConfig,
  testEfiAdminAuth,
  uploadEfiCertificate,
  upsertEfiAdminConfig
} from "../services/SaasBilling/PlatformEfiConfigAdminService";

export const efiCertUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_P12_BYTES, files: 1 }
});

function actorId(req: Request): number {
  const id = Number(req.user?.id);
  if (!Number.isFinite(id)) {
    throw new AppError("Acesso não permitido", 401);
  }
  return id;
}

function slotParam(req: Request): string {
  return String(req.params.slot || "");
}

/** GET /saas/finance/efi/config */
export const getConfig = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await getEfiAdminConfigSafe();
  return res.status(200).json(dto);
};

/** PUT /saas/finance/efi/config/:slot */
export const upsertConfig = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await upsertEfiAdminConfig({
    slot: slotParam(req),
    actorUserId: actorId(req),
    body: req.body || {}
  });
  return res.status(200).json(dto);
};

/** POST /saas/finance/efi/config/:slot/certificate */
export const uploadCertificate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = req.file;
  if (!file?.buffer) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_EMPTY",
      400,
      "Arquivo de certificado obrigatório."
    );
  }
  const dto = await uploadEfiCertificate({
    slot: slotParam(req),
    actorUserId: actorId(req),
    buffer: file.buffer,
    originalName: file.originalname
  });
  return res.status(200).json(dto);
};

/** DELETE /saas/finance/efi/config/:slot/certificate */
export const removeCertificate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await deleteEfiCertificate({
    slot: slotParam(req),
    actorUserId: actorId(req)
  });
  return res.status(200).json(dto);
};

/** POST /saas/finance/efi/config/:slot/test-auth */
export const testAuth = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = await testEfiAdminAuth({
    slot: slotParam(req),
    actorUserId: actorId(req)
  });
  return res.status(200).json(result);
};

/** POST /saas/finance/efi/config/:slot/activate */
export const activate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await activateEfiAdminConfig({
    slot: slotParam(req),
    actorUserId: actorId(req),
    confirm: Boolean(req.body?.confirm)
  });
  return res.status(200).json(dto);
};

/** POST /saas/finance/efi/config/:slot/deactivate */
export const deactivate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await deactivateEfiAdminConfig({
    slot: slotParam(req),
    actorUserId: actorId(req)
  });
  return res.status(200).json(dto);
};

/** POST /saas/finance/efi/config/:slot/revoke */
export const revoke = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const dto = await revokeEfiAdminConfig({
    slot: slotParam(req),
    actorUserId: actorId(req),
    confirm: Boolean(req.body?.confirm)
  });
  return res.status(200).json(dto);
};

/** GET /saas/finance/efi/config/audits */
export const listAudits = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const items = await listEfiAdminAudits({
    limit: Number(req.query.limit) || 50
  });
  return res.status(200).json({ items });
};
