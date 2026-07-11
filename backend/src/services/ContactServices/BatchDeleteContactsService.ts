import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import {
  assertUserCanAccessContact,
  ContactAccessUser
} from "../../helpers/contactAccess";
import DeleteContactService from "./DeleteContactService";
import { logger } from "../../utils/logger";

export type BatchDeleteContactFailedItem = {
  id: number;
  reason: string;
};

export type BatchDeleteContactsResult = {
  deletedCount: number;
  failedCount: number;
  blockedCount: number;
  deletedIds: number[];
  failedIds: BatchDeleteContactFailedItem[];
  blockedIds: BatchDeleteContactFailedItem[];
};

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return String(err);
}

export function userCanBulkDeleteContacts(user: ContactAccessUser): boolean {
  if (user.super === true) return true;
  if (user.supportMode === true) return true;
  return String(user.profile || "") === "admin";
}

const BatchDeleteContactsService = async (
  contactIds: number[],
  companyId: number,
  accessUser: ContactAccessUser
): Promise<BatchDeleteContactsResult> => {
  if (!userCanBulkDeleteContacts(accessUser)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const deletedIds: number[] = [];
  const failedIds: BatchDeleteContactFailedItem[] = [];
  const blockedIds: BatchDeleteContactFailedItem[] = [];

  const io = getIO();

  for (const rawId of contactIds) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      failedIds.push({ id: rawId as number, reason: "invalid contact id" });
      continue;
    }

    try {
      await assertUserCanAccessContact(id, companyId, accessUser);
      await DeleteContactService(String(id));
      deletedIds.push(id);

      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-contact`,
        {
          action: "delete",
          contactId: id
        }
      );
    } catch (err) {
      const reason = extractErrorMessage(err);
      if (err instanceof AppError && err.statusCode === 403) {
        blockedIds.push({ id, reason });
      } else {
        failedIds.push({ id, reason });
      }
      logger.warn(
        {
          err,
          contactId: id,
          companyId,
          errorMessage: reason
        },
        "[ContactBatchDelete] item failed"
      );
    }
  }

  return {
    deletedCount: deletedIds.length,
    failedCount: failedIds.length,
    blockedCount: blockedIds.length,
    deletedIds,
    failedIds,
    blockedIds
  };
};

export default BatchDeleteContactsService;
