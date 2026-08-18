import {
  GROUP_PARTICIPANT_PHONE_AVAILABLE,
  uniqueResolvedPhones,
  type NormalizedGroupParticipant
} from "../../helpers/groupParticipantFromMetadata";

export type GroupParticipantsPreview = {
  groupName: string;
  totalParticipants: number;
  withPhone: number;
  withoutPhone: number;
  existingContacts: number;
  newContacts: number;
  importableCount: number;
};

export function buildGroupParticipantsPreview(
  groupSubject: string,
  participants: NormalizedGroupParticipant[],
  existingPhones: Set<string>
): GroupParticipantsPreview {
  const withPhoneParticipants = participants.filter(
    p => p.status === GROUP_PARTICIPANT_PHONE_AVAILABLE && p.phone
  );
  const uniquePhones = uniqueResolvedPhones(participants);
  const existingContacts = uniquePhones.filter(phone =>
    existingPhones.has(phone)
  ).length;
  const newContacts = uniquePhones.length - existingContacts;

  return {
    groupName: groupSubject,
    totalParticipants: participants.length,
    withPhone: withPhoneParticipants.length,
    withoutPhone: participants.length - withPhoneParticipants.length,
    existingContacts,
    newContacts,
    importableCount: newContacts
  };
}
