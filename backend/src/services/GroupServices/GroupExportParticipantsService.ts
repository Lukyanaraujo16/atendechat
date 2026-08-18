import { GroupAccessActor } from "../../helpers/groupVisibility";
import GroupLoadParticipantsSnapshotService from "./GroupLoadParticipantsSnapshotService";
import {
  buildGroupParticipantsCsv,
  buildGroupParticipantsExportFilename
} from "./buildGroupParticipantsCsv";
import { logger } from "../../utils/logger";

const GroupExportParticipantsService = async ({
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
}): Promise<{ filename: string; csv: string }> => {
  const started = Date.now();
  const snapshot = await GroupLoadParticipantsSnapshotService({
    companyId,
    whatsappId,
    groupJid,
    actor
  });

  const csv = buildGroupParticipantsCsv(snapshot.participants);
  const filename = buildGroupParticipantsExportFilename(snapshot.groupSubject);

  logger.info(
    {
      event: "group_participants_export",
      companyId,
      userId,
      whatsappId,
      groupJidMasked: snapshot.groupJidMasked,
      total: snapshot.participants.length,
      withPhone: snapshot.participants.filter(p => p.phone).length,
      withoutPhone: snapshot.participants.filter(p => !p.phone).length,
      durationMs: Date.now() - started
    },
    "[groups] participants export"
  );

  return { filename, csv };
};

export default GroupExportParticipantsService;
