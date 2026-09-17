/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  proto: {},
  jidNormalizedUser: (jid: string) => jid
}));

const mockGetWbot = jest.fn();
jest.mock("../../../../../../libs/wbot", () => ({
  getWbot: (...args: unknown[]) => mockGetWbot(...args)
}));

import { Boom } from "@hapi/boom";
import AppError from "../../../../../../errors/AppError";
import { BaileysGroupsProvider } from "../BaileysGroupsProvider";

function mockWbot(overrides: Record<string, unknown> = {}) {
  return {
    groupFetchAllParticipating: jest.fn(),
    groupMetadata: jest.fn(),
    groupCreate: jest.fn(),
    groupAcceptInvite: jest.fn(),
    groupLeave: jest.fn(),
    profilePictureUrl: jest.fn(),
    ...overrides
  };
}

describe("BaileysGroupsProvider", () => {
  beforeEach(() => {
    mockGetWbot.mockReset();
  });

  it("fromWhatsappId usa getWbot e lista grupos normalizados", async () => {
    const wbot = mockWbot();
    wbot.groupFetchAllParticipating.mockResolvedValue({
      "120363111@g.us": {
        subject: "Time Comercial",
        size: 3,
        participants: [
          {
            id: "5511999887766@s.whatsapp.net",
            admin: "superadmin",
            notify: "Ana"
          },
          {
            id: "5511888777666@s.whatsapp.net",
            admin: "admin",
            name: "Bruno"
          },
          { id: "123456789012345@lid" }
        ]
      }
    });
    mockGetWbot.mockReturnValue(wbot);

    const provider = BaileysGroupsProvider.fromWhatsappId(42);
    const groups = await provider.listParticipatingGroups();

    expect(mockGetWbot).toHaveBeenCalledWith(42);
    expect(provider.provider).toBe("baileys");
    expect(groups).toEqual([
      {
        remoteJid: "120363111@g.us",
        subject: "Time Comercial",
        participantCount: 3,
        adminCount: 2,
        adminPreview: ["Ana", "Bruno"]
      }
    ]);
  });

  it("metadata normaliza participante PN e LID sem telefone", async () => {
    const wbot = mockWbot();
    wbot.groupMetadata.mockResolvedValue({
      id: "120363111@g.us",
      subject: "Ops",
      participants: [
        {
          id: "5511999887766@s.whatsapp.net",
          admin: "admin",
          notify: "Ana"
        },
        { id: "123456789012345@lid" }
      ]
    });

    const provider = new BaileysGroupsProvider(wbot as never);
    const meta = await provider.getGroupMetadata("120363111@g.us");

    expect(meta.remoteJid).toBe("120363111@g.us");
    expect(meta.subject).toBe("Ops");
    expect(meta.participants[0]).toMatchObject({
      jid: "5511999887766@s.whatsapp.net",
      phoneNumber: "5511999887766",
      isAdmin: true,
      displayName: "Ana"
    });
    expect(meta.participants[1]).toMatchObject({
      jid: "123456789012345@lid",
      phoneNumber: null,
      lid: "123456789012345@lid",
      isAdmin: false
    });
    expect(String(meta.participants[1].jid)).toContain("@lid");
    expect(meta.participants[1].phoneNumber).toBeNull();
  });

  it("create, accept invite, leave e profile picture", async () => {
    const wbot = mockWbot();
    wbot.groupCreate.mockResolvedValue({
      id: "120363999@g.us",
      subject: "Novo",
      participants: [{ id: "5511999887766@s.whatsapp.net" }]
    });
    wbot.groupAcceptInvite.mockResolvedValue("120363888@g.us");
    wbot.groupLeave.mockResolvedValue(undefined);
    wbot.profilePictureUrl.mockResolvedValue("https://img/group.jpg");

    const provider = new BaileysGroupsProvider(wbot as never);

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
    expect(wbot.groupCreate).toHaveBeenCalledWith("Novo", [
      "5511999887766@s.whatsapp.net"
    ]);

    await expect(provider.acceptInvite("ABC123")).resolves.toEqual({
      groupJid: "120363888@g.us"
    });
    expect(wbot.groupAcceptInvite).toHaveBeenCalledWith("ABC123");

    await expect(
      provider.leaveGroup("120363888@g.us")
    ).resolves.toBeUndefined();
    expect(wbot.groupLeave).toHaveBeenCalledWith("120363888@g.us");

    await expect(
      provider.getGroupProfilePicture("120363888@g.us")
    ).resolves.toBe("https://img/group.jpg");
  });

  it("falha de foto devolve null e erro de socket vira AppError estável", async () => {
    const wbot = mockWbot();
    wbot.profilePictureUrl.mockRejectedValue(new Error("not-found"));
    wbot.groupMetadata.mockRejectedValue(
      new Boom("forbidden", { statusCode: 403 })
    );
    mockGetWbot.mockImplementation(() => {
      throw new AppError("ERR_WAPP_NOT_INITIALIZED");
    });

    const provider = new BaileysGroupsProvider(wbot as never);
    await expect(
      provider.getGroupProfilePicture("120363888@g.us")
    ).resolves.toBeNull();

    await expect(
      provider.getGroupMetadata("120363888@g.us")
    ).rejects.toMatchObject({
      message: "ERR_GROUP_ACCESS_DENIED",
      statusCode: 400
    });

    expect(() => BaileysGroupsProvider.fromWhatsappId(7)).toThrow(
      expect.objectContaining({ message: "ERR_WAPP_NOT_INITIALIZED" })
    );
  });
});
