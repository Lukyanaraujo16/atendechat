import { GroupAccessActor } from "../../helpers/groupVisibility";
import GroupLoadParticipantsSnapshotService from "./GroupLoadParticipantsSnapshotService";
import { buildGroupParticipantsPreview } from "./buildGroupParticipantsPreview";

const GroupPreviewParticipantsService = async ({
  companyId,
  whatsappId,
  groupJid,
  actor
}: {
  companyId: number;
  whatsappId: number;
  groupJid: string;
  actor: GroupAccessActor;
}) => {
  const snapshot = await GroupLoadParticipantsSnapshotService({
    companyId,
    whatsappId,
    groupJid,
    actor
  });

  return buildGroupParticipantsPreview(
    snapshot.groupSubject,
    snapshot.participants,
    snapshot.existingPhones
  );
};

export default GroupPreviewParticipantsService;
