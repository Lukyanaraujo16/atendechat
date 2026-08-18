import CreateContactService from "../ContactServices/CreateContactService";
import { GROUP_PARTICIPANT_PHONE_AVAILABLE } from "../../helpers/groupParticipantFromMetadata";
import { GroupAccessActor } from "../../helpers/groupVisibility";
import { logger } from "../../utils/logger";
import GroupLoadParticipantsSnapshotService from "./GroupLoadParticipantsSnapshotService";
import {
  importResolvedGroupParticipants,
  type GroupImportParticipantsResult
} from "./importResolvedGroupParticipants";

export type { GroupImportParticipantsResult };
export { importResolvedGroupParticipants };

const GroupImportParticipantsService = async ({
  companyId,
  userId,
  whatsappId,
  groupJid,
  actor
}: {
  companyId: number;
  userId: number;
  whatsappId: number;
  groupJid: string;
  actor: GroupAccessActor;
}): Promise<GroupImportParticipantsResult> => {
  const started = Date.now();
  const snapshot = await GroupLoadParticipantsSnapshotService({
    companyId,
    whatsappId,
    groupJid,
    actor
  });

  const result = await importResolvedGroupParticipants({
    companyId,
    userId,
    participants: snapshot.participants,
    existingPhones: new Set(snapshot.existingPhones),
    createContact: CreateContactService
  });

  logger.info(
    {
      event: "group_participants_import",
      companyId,
      userId,
      whatsappId,
      groupJidMasked: snapshot.groupJidMasked,
      total: snapshot.participants.length,
      withPhone: snapshot.participants.filter(
        p => p.status === GROUP_PARTICIPANT_PHONE_AVAILABLE
      ).length,
      imported: result.imported,
      skippedExisting: result.skippedExisting,
      skippedNoPhone: result.skippedNoPhone,
      failed: result.failed,
      skippedLimit: result.skippedLimit,
      durationMs: Date.now() - started
    },
    "[groups] participants import"
  );

  return result;
};

export default GroupImportParticipantsService;
