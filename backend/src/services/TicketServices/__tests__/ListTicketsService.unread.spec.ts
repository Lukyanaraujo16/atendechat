jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    count: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { name: "Contact" }
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { name: "Message" }
}));

jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: { name: "Queue" }
}));

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { name: "Tag" }
}));

jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../../../models/ContactLabelRelation", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { name: "Whatsapp" }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { name: "AiAgent" }
}));

jest.mock("../../../models/InstagramAccount", () => ({
  __esModule: true,
  default: { name: "InstagramAccount" }
}));

jest.mock("../../UserServices/ShowUserService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/ticketOrphan", () => ({
  attachTicketIsOrphanFlag: jest.fn((tickets: unknown) => tickets)
}));

jest.mock("../../../helpers/ticketPinned", () => ({
  attachTicketPinnedFlagsFromList: jest.fn(),
  buildPinnedTicketOrderClause: jest.fn(() => []),
  isPinnedTicketsTableMissingError: jest.fn(() => false),
  loadPinnedTicketsForUser: jest.fn(async () => []),
  logListTicketsQueryError: jest.fn()
}));

jest.mock("../../../helpers/groupVisibility", () => {
  const actual = jest.requireActual("../../../helpers/groupVisibility");
  return {
    ...actual,
    loadUserQueueIds: jest.fn()
  };
});

jest.mock("../../../helpers/unassignedTicketsVisibility", () => {
  const actual = jest.requireActual(
    "../../../helpers/unassignedTicketsVisibility"
  );
  return {
    ...actual,
    loadCompanyUnassignedTicketsQueueId: jest.fn()
  };
});

import { Op } from "sequelize";
import Ticket from "../../../models/Ticket";
import User from "../../../models/User";
import ShowUserService from "../../UserServices/ShowUserService";
import { loadUserQueueIds } from "../../../helpers/groupVisibility";
import { loadCompanyUnassignedTicketsQueueId } from "../../../helpers/unassignedTicketsVisibility";
import ListTicketsService from "../ListTicketsService";

const ticketCount = Ticket.count as jest.Mock;
const userFindByPk = User.findByPk as jest.Mock;
const showUser = ShowUserService as jest.Mock;
const loadQueues = loadUserQueueIds as jest.Mock;
const loadContingency = loadCompanyUnassignedTicketsQueueId as jest.Mock;

function walk(node: unknown, visit: (value: unknown) => void): void {
  visit(node);
  if (!node || typeof node !== "object") return;
  Object.keys(node as object).forEach(key => {
    walk((node as Record<string, unknown>)[key], visit);
  });
  Object.getOwnPropertySymbols(node as object).forEach(sym => {
    walk((node as Record<symbol, unknown>)[sym], visit);
  });
}

function whereHas(
  where: unknown,
  predicate: (value: unknown) => boolean
): boolean {
  let found = false;
  walk(where, value => {
    if (predicate(value)) found = true;
  });
  return found;
}

async function countWhere(params: Record<string, unknown>) {
  ticketCount.mockResolvedValue(0);
  await ListTicketsService({
    userId: "10",
    companyId: 1,
    queueIds: [3],
    tags: [],
    users: [],
    userProfile: "user",
    countOnly: true,
    ...params
  } as any);
  expect(ticketCount).toHaveBeenCalled();
  return ticketCount.mock.calls[0][0].where;
}

describe("ListTicketsService — withUnreadMessages composition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindByPk.mockResolvedValue({ allTicket: "disabled" });
    loadQueues.mockResolvedValue([3, 7]);
    loadContingency.mockResolvedValue(null);
    ticketCount.mockResolvedValue(0);
  });

  it("unread + open entra (status e unreadMessages > 0)", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true"
    });
    expect(where.status).toBe("open");
    expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
    expect(showUser).not.toHaveBeenCalled();
  });

  it("unread + pending entra", async () => {
    const where = await countWhere({
      status: "pending",
      withUnreadMessages: "true"
    });
    expect(where.status).toBe("pending");
    expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
  });

  it("consulta do badge (open/pending) não usa status closed", async () => {
    const openWhere = await countWhere({
      status: "open",
      withUnreadMessages: "true"
    });
    ticketCount.mockClear();
    const pendingWhere = await countWhere({
      status: "pending",
      withUnreadMessages: "true"
    });
    expect(openWhere.status).toBe("open");
    expect(pendingWhere.status).toBe("pending");
    expect(openWhere.status).not.toBe("closed");
    expect(pendingWhere.status).not.toBe("closed");
  });

  it("unreadMessages = 0 não entra (filtro > 0)", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true"
    });
    expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
  });

  it("isGroup=true não entra na consulta padrão do badge", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true"
    });
    expect(where.isGroup).toBe(false);
  });

  it("ticket invisível ao usuário não entra — assignee/fila continuam no where", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true",
      queueIds: [3]
    });
    expect(
      whereHas(where, value => {
        const rec = value as Record<string, unknown>;
        return rec?.userId === 10 || rec?.userId === "10";
      })
    ).toBe(true);
    expect(
      whereHas(where, value => {
        const rec = value as Record<string, unknown>;
        const queueId = rec?.queueId as { [key: symbol]: number[] } | undefined;
        if (!queueId || typeof queueId !== "object") return false;
        return Object.getOwnPropertySymbols(queueId).some(sym => {
          const ids = (queueId as any)[sym];
          return Array.isArray(ids) && ids.includes(3);
        });
      })
    ).toBe(true);
  });

  it("withUnreadMessages não destrói filtros anteriores (status + company + group)", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true",
      searchParam: "cliente"
    });
    expect(where.status).toBe("open");
    expect(where.companyId).toBe(1);
    expect(where.isGroup).toBe(false);
    expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
    expect(whereHas(where, value => value === "%cliente%")).toBe(true);
  });

  it("callers sem withUnreadMessages não recebem filtro de unread", async () => {
    const where = await countWhere({ status: "open" });
    expect(where.unreadMessages).toBeUndefined();
    expect(where.status).toBe("open");
    expect(showUser).not.toHaveBeenCalled();
  });

  it("não reconstrói visibilidade via ShowUserService", async () => {
    await countWhere({
      status: "pending",
      withUnreadMessages: "true"
    });
    expect(showUser).not.toHaveBeenCalled();
  });

  it("usuário comum com showAll=true continua na visão de agente", async () => {
    const where = await countWhere({
      status: "open",
      withUnreadMessages: "true",
      showAll: "true",
      userProfile: "user",
      queueIds: []
    });
    expect(
      whereHas(where, value => {
        const rec = value as Record<string, unknown>;
        return rec?.userId === 10 || rec?.userId === "10";
      })
    ).toBe(true);
    expect(where.status).toBe("open");
    expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
    expect(where.isGroup).toBe(false);
  });

  it.each([
    ["admin", { userProfile: "admin" }],
    ["supervisor", { userProfile: "supervisor" }],
    ["support", { userProfile: "user", supportMode: true }]
  ])(
    "%s com showAll=true amplia visibilidade (sem filtro de assignee)",
    async (_label, profileParams) => {
      const where = await countWhere({
        status: "open",
        withUnreadMessages: "true",
        showAll: "true",
        queueIds: [],
        ...profileParams
      });
      expect(
        whereHas(where, value => {
          const rec = value as Record<string, unknown>;
          return rec?.userId === 10 || rec?.userId === "10";
        })
      ).toBe(false);
      expect(where.status).toBe("open");
      expect(where.unreadMessages).toEqual({ [Op.gt]: 0 });
      expect(where.isGroup).toBe(false);
      expect(where.companyId).toBe(1);
    }
  );
});
