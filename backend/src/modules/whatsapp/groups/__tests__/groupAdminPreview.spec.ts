import {
  buildGroupAdminPreview,
  countNormalizedGroupAdmins,
  toPublicGroupListEntry
} from "../groupAdminPreview";
import { mapGroupMetadataParticipants } from "../mapGroupMetadataParticipants";
import {
  normalizeGroupParticipantFromMetadata,
  normalizeGroupParticipantsFromMetadata
} from "../../../../helpers/groupParticipantFromMetadata";

describe("group admin preview", () => {
  it("conta admin/superadmin e limita preview a 5", () => {
    const participants = mapGroupMetadataParticipants([
      { id: "1@s.whatsapp.net", admin: "superadmin", notify: "Ana" },
      { id: "2@s.whatsapp.net", admin: "admin", name: "Bruno" },
      { id: "3@s.whatsapp.net", isAdmin: true },
      { id: "4@s.whatsapp.net", admin: "admin", notify: "Dora" },
      { id: "5@s.whatsapp.net", admin: "admin", notify: "Eva" },
      { id: "6@s.whatsapp.net", admin: "admin", notify: "Fábio" },
      { id: "7@s.whatsapp.net" }
    ]);

    expect(countNormalizedGroupAdmins(participants)).toBe(6);
    expect(buildGroupAdminPreview(participants)).toEqual([
      "Ana",
      "Bruno",
      "3",
      "Dora",
      "Eva"
    ]);
  });

  it("usa local-part e Admin quando não há notify/name", () => {
    const participants = mapGroupMetadataParticipants([
      { id: "5511999@s.whatsapp.net", admin: "admin" },
      { id: "", admin: "admin" }
    ]);
    expect(buildGroupAdminPreview(participants)).toEqual(["5511999", "Admin"]);
  });

  it("JSON público da listagem preserva id/name/contagens", () => {
    expect(
      toPublicGroupListEntry({
        remoteJid: "120363111@g.us",
        subject: "Time",
        participantCount: 4,
        adminCount: 1,
        adminPreview: ["Ana"]
      })
    ).toEqual({
      id: "120363111@g.us",
      name: "Time",
      participantCount: 4,
      adminCount: 1,
      adminPreview: ["Ana"]
    });
  });
});

describe("LID na boundary de grupos", () => {
  it("participant @lid sem PN fica unavailable e não vira telefone", () => {
    const mapped = mapGroupMetadataParticipants([
      { id: "123456789012345@lid" },
      {
        id: "111222333444555@lid",
        phoneNumber: "5511999887766@s.whatsapp.net"
      }
    ]);

    expect(mapped[0].phoneNumber).toBeNull();
    expect(mapped[0].lid).toBe("123456789012345@lid");
    expect(String(mapped[0].jid)).toContain("@lid");
    expect(String(mapped[0].jid).replace("@lid", "")).not.toBe(
      mapped[0].phoneNumber
    );

    const preview = normalizeGroupParticipantsFromMetadata(
      mapped.map(p => ({
        id: p.jid,
        phoneNumber: p.phoneNumber,
        lid: p.lid
      }))
    );
    expect(preview[0].status).toBe("unavailable");
    expect(preview[0].phone).toBeNull();
    expect(preview[1].status).toBe("available");
    expect(preview[1].phone).toBe("5511999887766");
  });

  it("não faz strip de @lid no helper de metadata", () => {
    const participant = normalizeGroupParticipantFromMetadata({
      id: "5511999887766@lid"
    });
    expect(participant.phone).toBeNull();
    expect(participant.status).toBe("unavailable");
  });
});
