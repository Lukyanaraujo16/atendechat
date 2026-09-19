import {
  allowsNullQueueVisibility
} from "../unassignedTicketsVisibility";
import { canAccessTicket } from "../ticketAccess";
import { buildNonAdminTicketListWhere } from "../agentTicketListWhere";

describe("unassignedTicketsVisibility", () => {
  it("permite null via allTicket", () => {
    expect(allowsNullQueueVisibility([1, 2], true, 99)).toBe(true);
    expect(allowsNullQueueVisibility([], true, null)).toBe(true);
  });

  it("permite null via setor de contingência na membership", () => {
    expect(allowsNullQueueVisibility([1, 5, 9], false, 5)).toBe(true);
  });

  it("nega null se contingência não está nas filas do utilizador", () => {
    expect(allowsNullQueueVisibility([1, 2], false, 5)).toBe(false);
    expect(allowsNullQueueVisibility([1, 2], false, null)).toBe(false);
  });
});

describe("canAccessTicket + null queue contingency", () => {
  const user = { id: 10, profile: "user" };

  it("admin sempre acessa", () => {
    expect(
      canAccessTicket(
        { id: 1, profile: "admin" },
        { userId: null, queueId: null },
        [],
        false
      )
    ).toBe(true);
  });

  it("usuário do setor de contingência acessa ticket sem setor", () => {
    expect(
      canAccessTicket(user, { userId: null, queueId: null }, [3, 7], true)
    ).toBe(true);
  });

  it("usuário de outro setor não acessa ticket sem setor", () => {
    expect(
      canAccessTicket(user, { userId: null, queueId: null }, [3, 7], false)
    ).toBe(false);
  });

  it("automação pending sem fila é visível mesmo sem allTicket", () => {
    expect(
      canAccessTicket(
        user,
        {
          userId: null,
          queueId: null,
          status: "pending",
          chatbot: true,
          isGroup: false
        },
        [3, 7],
        false
      )
    ).toBe(true);
  });

  it("órfão humano pending sem fila continua bloqueado", () => {
    expect(
      canAccessTicket(
        user,
        {
          userId: null,
          queueId: null,
          status: "pending",
          chatbot: false,
          isGroup: false
        },
        [3, 7],
        false
      )
    ).toBe(false);
  });

  it("ticket com setor real continua pela membership", () => {
    expect(
      canAccessTicket(user, { userId: null, queueId: 3 }, [3, 7], false)
    ).toBe(true);
    expect(
      canAccessTicket(user, { userId: null, queueId: 9 }, [3, 7], true)
    ).toBe(false);
  });

  it("ticket atribuído a outro usuário continua bloqueado", () => {
    expect(
      canAccessTicket(user, { userId: 99, queueId: null }, [3], true)
    ).toBe(false);
  });

  it("assignee próprio acessa mesmo com queue null", () => {
    expect(
      canAccessTicket(user, { userId: 10, queueId: null }, [], false)
    ).toBe(true);
  });
});

describe("buildNonAdminTicketListWhere null clause", () => {
  it("com allowNull e filas, cláusula inclui Op.or com null", () => {
    const where = buildNonAdminTicketListWhere(10, [1, 2], true) as any;
    const orKey = Object.getOwnPropertySymbols(where)[0];
    const branches = where[orKey];
    const poolAnd = branches[1];
    const andKey = Object.getOwnPropertySymbols(poolAnd)[0];
    const andParts = poolAnd[andKey];
    const queueClause = andParts[2];
    const queueOrKey = Object.getOwnPropertySymbols(queueClause)[0];
    expect(queueClause[queueOrKey]).toEqual(
      expect.arrayContaining([{ queueId: null }])
    );
  });

  it("sem allowNull usa apenas Op.in das filas no pool humano", () => {
    const where = buildNonAdminTicketListWhere(10, [1, 2], false) as any;
    const orKey = Object.getOwnPropertySymbols(where)[0];
    const poolAnd = where[orKey][1];
    const andKey = Object.getOwnPropertySymbols(poolAnd)[0];
    const queueClause = poolAnd[andKey][2];
    expect(queueClause).toEqual({
      queueId: { [Object.getOwnPropertySymbols(queueClause.queueId)[0]]: [1, 2] }
    });
  });

  it("inclui ramo AUTO para chatbot pending sem fila", () => {
    const where = buildNonAdminTicketListWhere(10, [1, 2], false) as any;
    const orKey = Object.getOwnPropertySymbols(where)[0];
    const autoBranch = where[orKey][2];
    expect(autoBranch).toEqual(
      expect.objectContaining({
        status: "pending",
        isGroup: false,
        chatbot: true
      })
    );
  });
});
