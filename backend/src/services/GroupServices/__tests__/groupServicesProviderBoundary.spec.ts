/* eslint-disable import/first */
const mockGetWbot = jest.fn();
const mockShowWhatsAppService = jest.fn();
const mockGetProvider = jest.fn();
const mockContactFindAll = jest.fn();
const mockContactFindOne = jest.fn();
const mockContactCreate = jest.fn();
const mockWhatsappFindByPk = jest.fn();
const mockFilterGroupRowsForUser = jest.fn(async (rows: unknown[]) => rows);
const mockLoadAuthorizedQueueIdsByContact = jest.fn(
  async () => new Map<number, number[]>()
);
const mockAssertUserCanAccessGroupContact = jest.fn();
const mockIsGroupVisibilityPrivileged = jest.fn(() => true);
const mockCreateOrUpdateContactService = jest.fn();
const mockFindOrCreateTicketService = jest.fn();
const mockEnsureGroupTicketPermanentOpen = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  getWbot: mockGetWbot
}));

jest.mock("../../WhatsappService/ShowWhatsAppService", () => ({
  __esModule: true,
  default: mockShowWhatsAppService
}));

jest.mock(
  "../../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider",
  () => ({
    getWhatsAppGroupsProviderForWhatsapp: mockGetProvider
  })
);

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findAll: mockContactFindAll,
    findOne: mockContactFindOne,
    create: mockContactCreate
  }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockWhatsappFindByPk
  }
}));

jest.mock("../../../helpers/groupVisibility", () => ({
  isGroupVisibilityPrivileged: mockIsGroupVisibilityPrivileged,
  filterGroupRowsForUser: mockFilterGroupRowsForUser,
  loadAuthorizedQueueIdsByContact: mockLoadAuthorizedQueueIdsByContact,
  assertUserCanAccessGroupContact: mockAssertUserCanAccessGroupContact,
  assertCanManageGroupParticipants: jest.fn(),
  assertGroupParticipantsVisibility: jest.fn()
}));

jest.mock("../../ContactServices/CreateOrUpdateContactService", () => ({
  __esModule: true,
  default: mockCreateOrUpdateContactService
}));

jest.mock("../../TicketServices/FindOrCreateTicketService", () => ({
  __esModule: true,
  default: mockFindOrCreateTicketService
}));

jest.mock("../../../helpers/groupTicketRules", () => ({
  ensureGroupTicketPermanentOpen: mockEnsureGroupTicketPermanentOpen
}));

import AppError from "../../../errors/AppError";
import { ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY } from "../../../modules/whatsapp/groups/groupsErrors";
import ListParticipatingGroupsService from "../ListParticipatingGroupsService";
import CreateWhatsAppGroupService from "../CreateWhatsAppGroupService";
import JoinWhatsAppGroupService, {
  normalizeInviteCode
} from "../JoinWhatsAppGroupService";
import LeaveWhatsAppGroupService from "../LeaveWhatsAppGroupService";
import GroupLoadParticipantsSnapshotService from "../GroupLoadParticipantsSnapshotService";
import GroupOpenConversationService from "../GroupOpenConversationService";

const actor = {
  id: 1,
  profile: "admin",
  companyId: 19
};

function mockProvider(overrides: Record<string, unknown> = {}) {
  return {
    provider: "baileys",
    listParticipatingGroups: jest.fn(),
    getGroupMetadata: jest.fn(),
    getGroupProfilePicture: jest.fn(),
    createGroup: jest.fn(),
    acceptInvite: jest.fn(),
    leaveGroup: jest.fn(),
    ...overrides
  };
}

describe("Group services provider boundary", () => {
  beforeEach(() => {
    mockGetWbot.mockReset();
    mockShowWhatsAppService.mockReset();
    mockGetProvider.mockReset();
    mockContactFindAll.mockReset();
    mockContactFindOne.mockReset();
    mockContactCreate.mockReset();
    mockWhatsappFindByPk.mockReset();
    mockFilterGroupRowsForUser.mockImplementation(
      async (rows: unknown[]) => rows
    );
    mockLoadAuthorizedQueueIdsByContact.mockResolvedValue(new Map());
    mockCreateOrUpdateContactService.mockReset();
    mockFindOrCreateTicketService.mockReset();
    mockEnsureGroupTicketPermanentOpen.mockReset();
  });

  it("list JSON público preserva id/name/contagens e enriquecimento local", async () => {
    mockShowWhatsAppService.mockResolvedValue({
      id: 5,
      companyId: 19,
      connectionProvider: "baileys"
    });
    const provider = mockProvider();
    provider.listParticipatingGroups.mockResolvedValue([
      {
        remoteJid: "120363111@g.us",
        subject: "Time Comercial",
        participantCount: 3,
        adminCount: 1,
        adminPreview: ["Ana"]
      }
    ]);
    mockGetProvider.mockResolvedValue(provider);
    mockContactFindAll.mockResolvedValue([
      {
        id: 88,
        name: "Time Comercial",
        number: "120363111",
        groupVisible: true,
        isGroup: true
      }
    ]);

    const data = await ListParticipatingGroupsService({
      whatsappId: 5,
      companyId: 19,
      actor
    });

    expect(data.groups[0]).toEqual({
      id: "120363111@g.us",
      name: "Time Comercial",
      participantCount: 3,
      adminCount: 1,
      adminPreview: ["Ana"],
      contactId: 88,
      groupVisible: true,
      authorizedQueueIds: []
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
    expect(provider.listParticipatingGroups).toHaveBeenCalled();
  });

  it("create/join/leave preservam JSON público", async () => {
    mockShowWhatsAppService.mockResolvedValue({
      id: 5,
      companyId: 19,
      connectionProvider: "baileys"
    });
    const provider = mockProvider();
    provider.createGroup.mockResolvedValue({
      remoteJid: "120363999@g.us",
      subject: "Novo",
      participantCount: 2
    });
    provider.acceptInvite.mockResolvedValue({ groupJid: "120363888@g.us" });
    provider.leaveGroup.mockResolvedValue(undefined);
    mockGetProvider.mockResolvedValue(provider);

    await expect(
      CreateWhatsAppGroupService({
        companyId: 19,
        whatsappId: 5,
        name: "Novo",
        participants: ["5511999887766", "5511888777666"]
      })
    ).resolves.toEqual({
      id: "120363999@g.us",
      name: "Novo",
      participantCount: 2
    });
    expect(provider.createGroup).toHaveBeenCalledWith({
      subject: "Novo",
      participantJids: [
        "5511999887766@s.whatsapp.net",
        "5511888777666@s.whatsapp.net"
      ]
    });

    expect(normalizeInviteCode("https://chat.whatsapp.com/AbC_12")).toBe(
      "AbC_12"
    );
    await expect(
      JoinWhatsAppGroupService({
        companyId: 19,
        whatsappId: 5,
        inviteCode: "https://chat.whatsapp.com/AbC_12"
      })
    ).resolves.toEqual({ groupJid: "120363888@g.us" });
    expect(provider.acceptInvite).toHaveBeenCalledWith("AbC_12");

    await expect(
      LeaveWhatsAppGroupService({
        companyId: 19,
        whatsappId: 5,
        groupId: "120363888@g.us"
      })
    ).resolves.toEqual({ ok: true });
    expect(provider.leaveGroup).toHaveBeenCalledWith("120363888@g.us");
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("snapshot usa provider.getGroupMetadata e mantém LID unavailable", async () => {
    mockShowWhatsAppService.mockResolvedValue({
      id: 5,
      companyId: 19,
      connectionProvider: "baileys"
    });
    const provider = mockProvider();
    provider.getGroupMetadata.mockResolvedValue({
      remoteJid: "120363111@g.us",
      subject: "Ops",
      participants: [
        {
          jid: "5511999887766@s.whatsapp.net",
          phoneNumber: "5511999887766",
          isAdmin: true,
          displayName: "Ana"
        },
        {
          jid: "123456789012345@lid",
          phoneNumber: null,
          lid: "123456789012345@lid",
          isAdmin: false
        }
      ]
    });
    mockGetProvider.mockResolvedValue(provider);
    mockContactFindOne.mockResolvedValue({
      id: 88,
      isGroup: true,
      number: "120363111"
    });
    mockContactFindAll.mockResolvedValue([{ number: "5511999887766" }]);

    const snapshot = await GroupLoadParticipantsSnapshotService({
      companyId: 19,
      whatsappId: 5,
      groupJid: "120363111@g.us",
      actor
    });

    expect(provider.getGroupMetadata).toHaveBeenCalledWith("120363111@g.us");
    expect(mockGetWbot).not.toHaveBeenCalled();
    expect(snapshot.groupSubject).toBe("Ops");
    expect(snapshot.participants[0].phone).toBe("5511999887766");
    expect(snapshot.participants[0].status).toBe("available");
    expect(snapshot.participants[1].phone).toBeNull();
    expect(snapshot.participants[1].status).toBe("unavailable");
  });

  it("open conversation usa provider para metadata e foto", async () => {
    mockShowWhatsAppService.mockResolvedValue({
      id: 5,
      companyId: 19,
      connectionProvider: "baileys",
      defaultGroupVisible: true
    });
    const provider = mockProvider();
    provider.getGroupProfilePicture.mockResolvedValue("https://img/g.jpg");
    provider.getGroupMetadata.mockResolvedValue({
      remoteJid: "120363111@g.us",
      subject: "Time",
      participants: []
    });
    mockGetProvider.mockResolvedValue(provider);
    mockContactFindOne.mockResolvedValue(null);
    mockCreateOrUpdateContactService.mockResolvedValue({
      id: 9,
      isGroup: true,
      number: "120363111"
    });
    mockFindOrCreateTicketService.mockResolvedValue({ uuid: "ticket-uuid" });
    mockEnsureGroupTicketPermanentOpen.mockResolvedValue({
      uuid: "ticket-uuid"
    });

    const result = await GroupOpenConversationService({
      companyId: 19,
      whatsappId: 5,
      groupId: "120363111@g.us"
    });

    expect(result).toEqual({ uuid: "ticket-uuid" });
    expect(provider.getGroupMetadata).toHaveBeenCalledWith("120363111@g.us");
    expect(provider.getGroupProfilePicture).toHaveBeenCalledWith(
      "120363111@g.us"
    );
    expect(mockCreateOrUpdateContactService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Time",
        number: "120363111",
        isGroup: true,
        groupVisible: true,
        profilePicUrl: "https://img/g.jpg"
      })
    );
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("tenant isolation: ShowWhatsAppService recebe companyId e bloqueia outra empresa", async () => {
    mockShowWhatsAppService.mockRejectedValue(
      new AppError("ERR_NO_WAPP_FOUND", 404)
    );

    await expect(
      CreateWhatsAppGroupService({
        companyId: 19,
        whatsappId: 99,
        name: "X",
        participants: ["5511999887766"]
      })
    ).rejects.toMatchObject({
      message: "ERR_NO_WAPP_FOUND",
      statusCode: 404
    });
    expect(mockShowWhatsAppService).toHaveBeenCalledWith(99, 19);
    expect(mockGetProvider).not.toHaveBeenCalled();
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("Evolution NOT_READY não usa getWbot", async () => {
    mockShowWhatsAppService.mockResolvedValue({
      id: 8,
      companyId: 19,
      connectionProvider: "evolution"
    });
    mockGetProvider.mockImplementation(() => {
      throw new AppError(ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY, 503);
    });

    await expect(
      ListParticipatingGroupsService({
        whatsappId: 8,
        companyId: 19,
        actor
      })
    ).rejects.toMatchObject({
      message: ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY,
      statusCode: 503
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });
});
