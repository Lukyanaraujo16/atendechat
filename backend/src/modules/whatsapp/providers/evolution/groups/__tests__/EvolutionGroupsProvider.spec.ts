/* eslint-disable import/first */
const mockFetchAll = jest.fn();
const mockFindInfos = jest.fn();
const mockCreate = jest.fn();
const mockAccept = jest.fn();
const mockLeave = jest.fn();
const mockGetWbot = jest.fn();

jest.mock("../../inbound/evolutionHttpClient", () => {
  class EvolutionHttpError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "EvolutionHttpError";
    }
  }
  return {
    EvolutionHttpError,
    evolutionFetchAllGroups: (...a: unknown[]) => mockFetchAll(...a),
    evolutionFindGroupInfos: (...a: unknown[]) => mockFindInfos(...a),
    evolutionCreateGroup: (...a: unknown[]) => mockCreate(...a),
    evolutionAcceptGroupInvite: (...a: unknown[]) => mockAccept(...a),
    evolutionLeaveGroup: (...a: unknown[]) => mockLeave(...a)
  };
});

jest.mock("../../../../../../libs/wbot", () => ({
  getWbot: (...a: unknown[]) => mockGetWbot(...a)
}));

import { EvolutionHttpError } from "../../inbound/evolutionHttpClient";
import {
  EvolutionGroupsProvider,
  evolutionParticipantJidToDigits
} from "../EvolutionGroupsProvider";

const PILOT_LIST = [
  {
    id: "120363111222333@g.us",
    subject: "Grupo teste",
    subjectOwner: "123456789012345@lid",
    pictureUrl: null,
    size: 3,
    owner: "123456789012345@lid",
    restrict: false,
    announce: false,
    isCommunity: false,
    isCommunityAnnounce: false,
    extraIgnored: true,
    participants: [
      {
        id: "111222333444555@lid",
        phoneNumber: "5527999887766@s.whatsapp.net",
        admin: "superadmin"
      },
      {
        id: "666777888999000@lid",
        phoneNumber: "5527888777666@s.whatsapp.net",
        admin: null
      },
      {
        id: "101010101010101@lid",
        admin: "admin"
      }
    ]
  }
];

describe("EvolutionGroupsProvider", () => {
  beforeEach(() => {
    mockFetchAll.mockReset();
    mockFindInfos.mockReset();
    mockCreate.mockReset();
    mockAccept.mockReset();
    mockLeave.mockReset();
    mockGetWbot.mockReset();
  });

  it("lista grupos da Pilot: LID, PN explícito, admin/superadmin, pictureUrl null", async () => {
    mockFetchAll.mockResolvedValue(PILOT_LIST);
    const provider = new EvolutionGroupsProvider(3);
    const groups = await provider.listParticipatingGroups();

    expect(provider.provider).toBe("evolution");
    expect(mockFetchAll).toHaveBeenCalledWith({
      whatsappId: 3,
      getParticipants: true
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].remoteJid).toBe("120363111222333@g.us");
    expect(groups[0].subject).toBe("Grupo teste");
    expect(groups[0].participantCount).toBe(3);
    expect(groups[0].adminCount).toBe(2);
    expect(groups[0].adminPreview).toEqual([
      "111222333444555",
      "101010101010101"
    ]);
    expect(groups[0]).not.toHaveProperty("participantsData");
    expect(groups[0]).not.toHaveProperty("pictureUrl");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("LID com PN explícito fica disponível; LID sem PN fica unavailable", async () => {
    mockFindInfos.mockResolvedValue(PILOT_LIST[0]);
    const provider = new EvolutionGroupsProvider(3);
    const meta = await provider.getGroupMetadata("120363111222333@g.us");

    expect(mockFindInfos).toHaveBeenCalledWith({
      whatsappId: 3,
      groupJid: "120363111222333@g.us"
    });
    expect(meta.participants[0]).toMatchObject({
      jid: "111222333444555@lid",
      lid: "111222333444555@lid",
      phoneNumber: "5527999887766",
      isAdmin: true
    });
    expect(String(meta.participants[0].jid)).toContain("@lid");
    expect(meta.participants[2]).toMatchObject({
      jid: "101010101010101@lid",
      lid: "101010101010101@lid",
      phoneNumber: null,
      isAdmin: true
    });
    expect(meta.participants[1].isAdmin).toBe(false);
  });

  it("participant.id PN sem phoneNumber normaliza telefone; notify não vira identidade", async () => {
    mockFindInfos.mockResolvedValue({
      id: "120363111222333@g.us",
      subject: "Grupo teste",
      participants: [
        {
          id: "5511999887766@s.whatsapp.net",
          admin: null,
          notify: "5511000000000",
          pushName: "João"
        }
      ]
    });
    const provider = new EvolutionGroupsProvider(3);
    const meta = await provider.getGroupMetadata("120363111222333@g.us");
    expect(meta.participants[0]).toMatchObject({
      jid: "5511999887766@s.whatsapp.net",
      phoneNumber: "5511999887766",
      isAdmin: false,
      displayName: "5511000000000"
    });
    expect(meta.participants[0].phoneNumber).not.toBe("5511000000000");
    expect(
      meta.participants[0].lid == null || meta.participants[0].lid === ""
    ).toBe(true);
  });

  it("pictureUrl null devolve null sem POST de foto", async () => {
    mockFindInfos.mockResolvedValue({ ...PILOT_LIST[0], pictureUrl: null });
    const provider = new EvolutionGroupsProvider(3);
    await expect(
      provider.getGroupProfilePicture("120363111222333@g.us")
    ).resolves.toBeNull();
  });

  it("create converte PN JID em dígitos e recusa LID", async () => {
    mockCreate.mockResolvedValue({
      id: "120363999@g.us",
      subject: "Novo",
      participants: [{ id: "5511999887766@s.whatsapp.net" }]
    });
    const provider = new EvolutionGroupsProvider(3);
    await expect(
      provider.createGroup({
        subject: "Novo",
        participantJids: ["5511999887766@s.whatsapp.net"]
      })
    ).resolves.toEqual({
      remoteJid: "120363999@g.us",
      subject: "Novo",
      participantCount: 1
    });
    expect(mockCreate).toHaveBeenCalledWith({
      whatsappId: 3,
      subject: "Novo",
      participants: ["5511999887766"]
    });

    await expect(
      provider.createGroup({
        subject: "X",
        participantJids: ["123456789012345@lid"]
      })
    ).rejects.toMatchObject({ message: "ERR_GROUP_INVALID_NUMBER" });
    expect(
      evolutionParticipantJidToDigits("5511888777666@s.whatsapp.net")
    ).toBe("5511888777666");
  });

  it("acceptInvite GET mapeia groupJid; leave DELETE usa JID canónico", async () => {
    mockAccept.mockResolvedValue({
      accepted: true,
      groupJid: "120363888@g.us"
    });
    mockLeave.mockResolvedValue({ leave: true });
    const provider = EvolutionGroupsProvider.fromWhatsapp({ id: 3 });

    await expect(
      provider.acceptInvite("AbCdef1234567890AbCdef")
    ).resolves.toEqual({
      groupJid: "120363888@g.us"
    });
    expect(mockAccept).toHaveBeenCalledWith({
      whatsappId: 3,
      inviteCode: "AbCdef1234567890AbCdef"
    });

    await expect(
      provider.leaveGroup("120363888@g.us")
    ).resolves.toBeUndefined();
    expect(mockLeave).toHaveBeenCalledWith({
      whatsappId: 3,
      groupJid: "120363888@g.us"
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("credencial ausente não vira ERR_WAPP_NOT_INITIALIZED", async () => {
    mockFetchAll.mockRejectedValue(
      new EvolutionHttpError(
        "ERR_EVOLUTION_CREDENTIAL_MISSING",
        "Credencial Evolution ausente"
      )
    );
    const provider = new EvolutionGroupsProvider(3);
    await expect(provider.listParticipatingGroups()).rejects.toMatchObject({
      message: "ERR_EVOLUTION_CREDENTIAL_MISSING",
      statusCode: 400
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("erro remoto de grupo vira ERR_GROUP_ACCESS_DENIED", async () => {
    mockFindInfos.mockRejectedValue(
      new EvolutionHttpError("ERR_EVOLUTION_API_ERROR", "boom stack")
    );
    const provider = new EvolutionGroupsProvider(3);
    await expect(
      provider.getGroupMetadata("120363111222333@g.us")
    ).rejects.toMatchObject({
      message: "ERR_GROUP_ACCESS_DENIED",
      statusCode: 400
    });
  });
});
