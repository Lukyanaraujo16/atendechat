/* eslint-disable import/first */
const mockGetWbot = jest.fn();
const mockGetProvider = jest.fn();
const mockTicketFindAll = jest.fn();
const mockContactFindAll = jest.fn();
const mockWhatsappFindByPk = jest.fn();
const mockLoadAuthorizedQueueIdsByContact = jest.fn(
  async () => new Map<number, number[]>()
);
const mockLoadUserQueueIds = jest.fn(async () => []);
const mockCanUserAccessGroupContact = jest.fn(() => true);
const mockIsGroupVisibilityPrivileged = jest.fn(() => true);
const mockCanUserAccessTicketByWhatsapp = jest.fn(() => true);

jest.mock("../../../libs/wbot", () => ({
  getWbot: mockGetWbot
}));

jest.mock(
  "../../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider",
  () => ({
    getWhatsAppGroupsProviderForWhatsapp: mockGetProvider
  })
);

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findAll: mockTicketFindAll
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: {
    findAll: mockContactFindAll
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
  loadUserQueueIds: mockLoadUserQueueIds,
  loadAuthorizedQueueIdsByContact: mockLoadAuthorizedQueueIdsByContact,
  canUserAccessGroupContact: mockCanUserAccessGroupContact
}));

jest.mock("../../../helpers/whatsappTicketVisibility", () => ({
  canUserAccessTicketByWhatsapp: mockCanUserAccessTicketByWhatsapp
}));

import AppError from "../../../errors/AppError";
import { ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY } from "../../../modules/whatsapp/groups/groupsErrors";
import ListGroupsInboxService from "../ListGroupsInboxService";

describe("ListGroupsInboxService", () => {
  beforeEach(() => {
    mockGetWbot.mockReset();
    mockGetProvider.mockReset();
    mockTicketFindAll.mockResolvedValue([]);
    mockContactFindAll.mockReset();
    mockWhatsappFindByPk.mockReset();
  });

  it("Evolution sem GroupsProvider usa fallback local e não chama getWbot", async () => {
    const contact = {
      id: 3,
      name: "120363111",
      number: "120363111",
      profilePicUrl: null,
      whatsappId: 8,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      groupVisible: true,
      isGroup: true,
      whatsapp: { id: 8, name: "Evo", ticketVisibility: "all" },
      update: jest.fn()
    };
    mockContactFindAll.mockResolvedValue([contact]);
    mockWhatsappFindByPk.mockResolvedValue({
      id: 8,
      companyId: 19,
      connectionProvider: "evolution"
    });
    mockGetProvider.mockImplementation(() => {
      throw new AppError(ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY, 503);
    });

    const data = await ListGroupsInboxService({
      companyId: 19,
      actor: { id: 1, profile: "admin", companyId: 19 }
    });

    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].name).toBe("120363111");
    expect(data.groups[0].name).not.toBe("João");
    expect(contact.update).not.toHaveBeenCalled();
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("Evolution com GroupsProvider resolve subject remoto e não chama getWbot", async () => {
    const contact = {
      id: 5,
      name: "120363111",
      number: "120363111",
      profilePicUrl: null,
      whatsappId: 8,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      groupVisible: true,
      isGroup: true,
      whatsapp: { id: 8, name: "Evo", ticketVisibility: "all" },
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockContactFindAll.mockResolvedValue([contact]);
    mockWhatsappFindByPk.mockResolvedValue({
      id: 8,
      companyId: 19,
      connectionProvider: "evolution"
    });
    mockGetProvider.mockResolvedValue({
      provider: "evolution",
      getGroupMetadata: jest.fn().mockResolvedValue({
        subject: "Grupo teste"
      })
    });

    const data = await ListGroupsInboxService({
      companyId: 19,
      actor: { id: 1, profile: "admin", companyId: 19 }
    });

    expect(data.groups[0].name).toBe("Grupo teste");
    expect(contact.update).toHaveBeenCalledWith({ name: "Grupo teste" });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("Baileys pode resolver subject remoto via provider", async () => {
    const contact = {
      id: 4,
      name: "120363222",
      number: "120363222",
      profilePicUrl: null,
      whatsappId: 5,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      groupVisible: true,
      isGroup: true,
      whatsapp: { id: 5, name: "Baileys", ticketVisibility: "all" },
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockContactFindAll.mockResolvedValue([contact]);
    mockWhatsappFindByPk.mockResolvedValue({
      id: 5,
      companyId: 19,
      connectionProvider: "baileys"
    });
    mockGetProvider.mockResolvedValue({
      getGroupMetadata: jest.fn().mockResolvedValue({
        subject: "Grupo Real"
      })
    });

    const data = await ListGroupsInboxService({
      companyId: 19,
      actor: { id: 1, profile: "admin", companyId: 19 }
    });

    expect(data.groups[0].name).toBe("Grupo Real");
    expect(contact.update).toHaveBeenCalledWith({ name: "Grupo Real" });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });
});
