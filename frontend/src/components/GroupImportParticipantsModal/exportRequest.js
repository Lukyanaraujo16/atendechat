export function buildGroupParticipantsExportRequest(whatsappId, groupJid) {
  return {
    method: "post",
    url: `/groups/${whatsappId}/participants/export`,
    data: { groupJid },
    responseType: "blob",
  };
}
