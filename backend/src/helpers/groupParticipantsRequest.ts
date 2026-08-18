import { Op } from "sequelize";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";

/** Preview, export e import leem o JID só do body — nunca da query string. */
export function resolveGroupJidFromBody(body: unknown): string {
  const groupJid = String(
    (body as { groupJid?: string } | null | undefined)?.groupJid || ""
  ).trim();
  return groupJid;
}

export function buildExistingPhonesLookupWhere(
  companyId: number,
  phones: string[]
): {
  companyId: number;
  isGroup: false;
  number: { [Op.in]: string[] };
} {
  return {
    companyId,
    isGroup: false,
    number: { [Op.in]: phones }
  };
}

export function wrapGroupAccessError(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof Boom) {
    throw new AppError("ERR_GROUP_ACCESS_DENIED", 400);
  }
  const message = err instanceof Error ? err.message : "";
  if (message === "ERR_GROUP_ID_REQUIRED") {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }
  if (message === "ERR_GROUP_INVALID_GROUP_ID") {
    throw new AppError("ERR_GROUP_INVALID_GROUP_ID", 400);
  }
  throw new AppError("ERR_GROUP_ACCESS_DENIED", 400);
}
