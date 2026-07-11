import { Transaction } from "sequelize";
import sequelize from "../../database";
import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import {
  assertUserCanAccessContact,
  ContactAccessUser
} from "../../helpers/contactAccess";
import { getContactHistoryBlockReason } from "./CheckContactDeletableService";
import { logger } from "../../utils/logger";

export type BatchDeleteContactItem = {
  contactId: number;
  reason: string;
};

export type BatchDeleteContactsResult = {
  deletedCount: number;
  blockedCount: number;
  failedCount: number;
  deletedIds: number[];
  blocked: BatchDeleteContactItem[];
  failed: BatchDeleteContactItem[];
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

  const eligibleIds: number[] = [];
  const blocked: BatchDeleteContactItem[] = [];
  const failed: BatchDeleteContactItem[] = [];

  // 1) Validação (sem destruir): tenant, permissão de acesso e histórico.
  for (const rawId of contactIds) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      failed.push({ contactId: rawId as number, reason: "INVALID_ID" });
      continue;
    }

    try {
      // Garante tenant (companyId) e permissão de visualização/acesso ao contato.
      await assertUserCanAccessContact(id, companyId, accessUser);

      const historyReason = await getContactHistoryBlockReason(id, companyId);
      if (historyReason) {
        blocked.push({ contactId: id, reason: historyReason });
        continue;
      }

      eligibleIds.push(id);
    } catch (err) {
      const reason = extractErrorMessage(err);
      if (err instanceof AppError && err.statusCode === 403) {
        blocked.push({ contactId: id, reason: "NO_ACCESS" });
      } else if (err instanceof AppError && err.statusCode === 404) {
        failed.push({ contactId: id, reason: "NOT_FOUND" });
      } else {
        failed.push({ contactId: id, reason });
      }
      logger.warn(
        { err, contactId: id, companyId, errorMessage: reason },
        "[ContactBatchDelete] validation failed"
      );
    }
  }

  // 2) Parte destrutiva apenas dos elegíveis, em transação (tudo ou nada).
  const deletedIds: number[] = [];
  if (eligibleIds.length) {
    await sequelize.transaction(async (transaction: Transaction) => {
      for (const id of eligibleIds) {
        // where inclui companyId como salvaguarda extra contra cross-tenant.
        const affected = await Contact.destroy({
          where: { id, companyId },
          transaction
        });
        if (affected > 0) {
          deletedIds.push(id);
        }
      }
    });
  }

  // 3) Notifica remoções após o commit.
  if (deletedIds.length) {
    const io = getIO();
    for (const id of deletedIds) {
      io.to(`company-${companyId}-mainchannel`).emit(
        `company-${companyId}-contact`,
        {
          action: "delete",
          contactId: id
        }
      );
    }
  }

  logger.info(
    {
      companyId,
      deletedCount: deletedIds.length,
      blockedCount: blocked.length,
      failedCount: failed.length
    },
    "[ContactBatchDelete] finished"
  );

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    failedCount: failed.length,
    deletedIds,
    blocked,
    failed
  };
};

export default BatchDeleteContactsService;
