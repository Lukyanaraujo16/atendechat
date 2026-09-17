/* eslint-disable import/first */
const mockGetWbot = jest.fn();
const mockShowWhatsAppService = jest.fn();
const mockListParticipating = jest.fn();
const mockCreateGroup = jest.fn();
const mockJoinGroup = jest.fn();
const mockLeaveGroup = jest.fn();
const mockOpenConversation = jest.fn();
const mockInbox = jest.fn();
const mockAssertOpen = jest.fn();

jest.mock("../../libs/wbot", () => ({
  getWbot: (...args: unknown[]) => mockGetWbot(...args)
}));

jest.mock("../../services/WhatsappService/ShowWhatsAppService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockShowWhatsAppService(...args)
}));

jest.mock(
  "../../services/GroupServices/ListParticipatingGroupsService",
  () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockListParticipating(...args),
    assertGroupContactAccessibleForOpen: (...args: unknown[]) =>
      mockAssertOpen(...args)
  })
);

jest.mock("../../services/GroupServices/CreateWhatsAppGroupService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockCreateGroup(...args)
}));

jest.mock("../../services/GroupServices/JoinWhatsAppGroupService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockJoinGroup(...args),
  normalizeInviteCode: (raw: string) => String(raw || "")
}));

jest.mock("../../services/GroupServices/LeaveWhatsAppGroupService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockLeaveGroup(...args)
}));

jest.mock("../../services/GroupServices/GroupOpenConversationService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockOpenConversation(...args)
}));

jest.mock("../../services/GroupServices/ListGroupsInboxService", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockInbox(...args)
}));

jest.mock(
  "../../services/GroupServices/GroupPreviewParticipantsService",
  () => ({
    __esModule: true,
    default: jest.fn()
  })
);
jest.mock(
  "../../services/GroupServices/GroupExportParticipantsService",
  () => ({
    __esModule: true,
    default: jest.fn()
  })
);
jest.mock(
  "../../services/GroupServices/GroupImportParticipantsService",
  () => ({
    __esModule: true,
    default: jest.fn()
  })
);

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import AppError from "../../errors/AppError";
import { ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY } from "../../modules/whatsapp/groups/groupsErrors";
import * as GroupController from "../GroupController";

function mockRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 1, companyId: 19, profile: "admin", supportMode: false },
    params: {},
    body: {},
    ...overrides
  };
}

describe("GroupController JSON público", () => {
  beforeEach(() => {
    mockGetWbot.mockReset();
    mockListParticipating.mockReset();
    mockCreateGroup.mockReset();
    mockJoinGroup.mockReset();
    mockLeaveGroup.mockReset();
    mockOpenConversation.mockReset();
    mockAssertOpen.mockReset();
  });

  it("list devolve groups no contrato do frontend", async () => {
    mockListParticipating.mockResolvedValue({
      groups: [
        {
          id: "120363111@g.us",
          name: "Time",
          participantCount: 2,
          adminCount: 1,
          adminPreview: ["Ana"],
          contactId: 8,
          groupVisible: true,
          authorizedQueueIds: [1]
        }
      ]
    });
    const res = mockRes();
    await GroupController.list(
      mockReq({ params: { whatsappId: "5" } }) as never,
      res as never
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      groups: [
        expect.objectContaining({
          id: "120363111@g.us",
          name: "Time",
          participantCount: 2,
          adminCount: 1,
          adminPreview: ["Ana"]
        })
      ]
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("create/join/leave preservam JSON público", async () => {
    mockCreateGroup.mockResolvedValue({
      id: "120363999@g.us",
      name: "Novo",
      participantCount: 1
    });
    mockJoinGroup.mockResolvedValue({ groupJid: "120363888@g.us" });
    mockLeaveGroup.mockResolvedValue({ ok: true });

    const created = mockRes();
    await GroupController.create(
      mockReq({
        body: {
          whatsappId: 5,
          name: "Novo",
          participants: ["5511999887766"]
        }
      }) as never,
      created as never
    );
    expect(created.json).toHaveBeenCalledWith({
      id: "120363999@g.us",
      name: "Novo",
      participantCount: 1
    });

    const joined = mockRes();
    await GroupController.join(
      mockReq({ body: { whatsappId: 5, inviteCode: "ABC" } }) as never,
      joined as never
    );
    expect(joined.json).toHaveBeenCalledWith({ groupJid: "120363888@g.us" });

    const left = mockRes();
    await GroupController.leave(
      mockReq({ body: { whatsappId: 5, groupId: "120363888@g.us" } }) as never,
      left as never
    );
    expect(left.json).toHaveBeenCalledWith({ ok: true });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });

  it("Evolution NOT_READY não é sessão desconectada", async () => {
    mockListParticipating.mockRejectedValue(
      new AppError(
        ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY,
        503,
        "Gestão de grupos deste provider ainda não está disponível."
      )
    );
    const res = mockRes();
    await GroupController.list(
      mockReq({ params: { whatsappId: "8" } }) as never,
      res as never
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY,
      message: "Gestão de grupos deste provider ainda não está disponível."
    });
    expect(mockGetWbot).not.toHaveBeenCalled();
  });
});
