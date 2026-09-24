import {
  collectProtectedPendingIds,
  hasPendingColumnOverlap,
  reconcilePendingInboxColumns,
  toTicketIdSet,
} from "../reconcilePendingInboxColumns";

function ticket(id, extra = {}) {
  return {
    id,
    status: "pending",
    chatbot: false,
    isGroup: false,
    userId: null,
    ...extra,
  };
}

function idsOf(list) {
  return (list || []).map((t) => Number(t.id)).sort((a, b) => a - b);
}

function reconcile(partial) {
  return reconcilePendingInboxColumns({
    waitingPrev: [],
    chatbotPrev: [],
    lastWaitingApiIds: new Set(),
    lastChatbotApiIds: new Set(),
    protectedIds: new Set(),
    ...partial,
  });
}

describe("reconcilePendingInboxColumns", () => {
  it("1. IA Live: socket inicial em waiting + APIs waiting=[] AUTO=[ticket] → só AUTO", () => {
    const live = ticket(101, { chatbot: false });
    const result = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [live],
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([101]);
    expect(hasPendingColumnOverlap(result.waiting, result.chatbot)).toBe(false);
  });

  it("2. mesmo cenário com id em recentSocketPendingIdsRef NÃO ressuscita waiting", () => {
    const live = ticket(101, { chatbot: false });
    const result = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [live],
      protectedIds: new Set([101]),
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([101]);
    expect(hasPendingColumnOverlap(result.waiting, result.chatbot)).toBe(false);
  });

  it("3. pending humano: waiting=[ticket] AUTO=[] → só waiting", () => {
    const human = ticket(202);
    const result = reconcile({
      waitingPrev: [human],
      chatbotPrev: [],
      waitingApiTickets: [human],
      chatbotApiTickets: [],
    });
    expect(idsOf(result.waiting)).toEqual([202]);
    expect(idsOf(result.chatbot)).toEqual([]);
  });

  it("4. handoff: AUTO inicial → APIs waiting=[ticket] AUTO=[] → só waiting", () => {
    const afterHandoff = ticket(303, { chatbot: false, automationActive: false });
    const result = reconcile({
      waitingPrev: [],
      chatbotPrev: [ticket(303, { chatbot: false, automationActive: true })],
      waitingApiTickets: [afterHandoff],
      chatbotApiTickets: [],
    });
    expect(idsOf(result.waiting)).toEqual([303]);
    expect(idsOf(result.chatbot)).toEqual([]);
  });

  it("5. mesmo id nas duas listas internas antes da reconciliação → só uma coluna", () => {
    const dup = ticket(404, { chatbot: false });
    const result = reconcile({
      waitingPrev: [dup],
      chatbotPrev: [dup],
      waitingApiTickets: [],
      chatbotApiTickets: [dup],
      protectedIds: new Set([404]),
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([404]);
    expect(hasPendingColumnOverlap(result.waiting, result.chatbot)).toBe(false);
  });

  it("6. F5/fetch inicial e socket+sync convergem para a mesma classificação", () => {
    const live = ticket(505, { chatbot: false });
    const fromF5 = reconcile({
      waitingPrev: [],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [live],
    });
    const fromSocketThenSync = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [live],
      protectedIds: new Set([505]),
    });
    expect(idsOf(fromF5.waiting)).toEqual(idsOf(fromSocketThenSync.waiting));
    expect(idsOf(fromF5.chatbot)).toEqual(idsOf(fromSocketThenSync.chatbot));
    expect(idsOf(fromF5.chatbot)).toEqual([505]);
    expect(idsOf(fromF5.waiting)).toEqual([]);
  });

  it("7. proteção socket preserva ticket ausente das duas APIs", () => {
    const recent = ticket(606);
    const result = reconcile({
      waitingPrev: [recent],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [],
      protectedIds: new Set([606]),
    });
    expect(idsOf(result.waiting)).toEqual([606]);
    expect(idsOf(result.chatbot)).toEqual([]);
  });

  it("7b. proteção socket em AUTO não é movida para waiting sem evidência da API waiting", () => {
    const recentAuto = ticket(607, { chatbot: true });
    const result = reconcile({
      waitingPrev: [],
      chatbotPrev: [recentAuto],
      waitingApiTickets: [],
      chatbotApiTickets: [],
      protectedIds: new Set([607]),
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([607]);
  });

  it("8. Typebot/Flow chatbot=true continua AUTO e não waiting", () => {
    const typebot = ticket(708, { chatbot: true });
    const result = reconcile({
      waitingPrev: [],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [typebot],
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([708]);
  });

  it("9. ticket open/humano não entra nas duas pending", () => {
    const openHuman = ticket(809, { status: "open", userId: 12 });
    const result = reconcile({
      waitingPrev: [],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [],
    });
    expect(idsOf(result.waiting)).not.toContain(809);
    expect(idsOf(result.chatbot)).not.toContain(809);
    expect(openHuman.status).toBe("open");
  });

  it("10. grupos da API AUTO permanecem só em AUTO; grupos waiting só em waiting", () => {
    const groupAuto = ticket(910, { chatbot: true, isGroup: true });
    const groupWait = ticket(911, { chatbot: false, isGroup: true });
    const result = reconcile({
      waitingPrev: [],
      chatbotPrev: [],
      waitingApiTickets: [groupWait],
      chatbotApiTickets: [groupAuto],
    });
    expect(idsOf(result.waiting)).toEqual([911]);
    expect(idsOf(result.chatbot)).toEqual([910]);
    expect(hasPendingColumnOverlap(result.waiting, result.chatbot)).toBe(false);
  });

  it("11. sync concorrente / fora de ordem não duplica no estado final", () => {
    const live = ticket(111, { chatbot: false });

    const afterChatbotFirst = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: undefined,
      chatbotApiTickets: [live],
      lastWaitingApiIds: new Set(),
      lastChatbotApiIds: new Set(),
      protectedIds: new Set([111]),
    });
    expect(idsOf(afterChatbotFirst.waiting)).toEqual([]);
    expect(idsOf(afterChatbotFirst.chatbot)).toEqual([111]);

    const afterWaitingLater = reconcile({
      waitingPrev: afterChatbotFirst.waiting,
      chatbotPrev: afterChatbotFirst.chatbot,
      waitingApiTickets: [],
      chatbotApiTickets: undefined,
      lastWaitingApiIds: afterChatbotFirst.waitingApiIds,
      lastChatbotApiIds: afterChatbotFirst.chatbotApiIds,
      protectedIds: new Set([111]),
    });
    expect(idsOf(afterWaitingLater.waiting)).toEqual([]);
    expect(idsOf(afterWaitingLater.chatbot)).toEqual([111]);
    expect(hasPendingColumnOverlap(afterWaitingLater.waiting, afterWaitingLater.chatbot)).toBe(
      false
    );

    const afterWaitingFirst = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: undefined,
      lastWaitingApiIds: new Set(),
      lastChatbotApiIds: new Set(),
      protectedIds: new Set([111]),
    });
    expect(idsOf(afterWaitingFirst.waiting)).toEqual([111]);

    const afterChatbotLater = reconcile({
      waitingPrev: afterWaitingFirst.waiting,
      chatbotPrev: afterWaitingFirst.chatbot,
      waitingApiTickets: undefined,
      chatbotApiTickets: [live],
      lastWaitingApiIds: afterWaitingFirst.waitingApiIds,
      lastChatbotApiIds: afterWaitingFirst.chatbotApiIds,
      protectedIds: new Set([111]),
    });
    expect(idsOf(afterChatbotLater.waiting)).toEqual([]);
    expect(idsOf(afterChatbotLater.chatbot)).toEqual([111]);
    expect(hasPendingColumnOverlap(afterChatbotLater.waiting, afterChatbotLater.chatbot)).toBe(
      false
    );
  });

  it("APIs conflitantes: AUTO vence waiting", () => {
    const same = ticket(120);
    const result = reconcile({
      waitingPrev: [same],
      chatbotPrev: [same],
      waitingApiTickets: [same],
      chatbotApiTickets: [same],
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([120]);
  });

  it("socket posterior não devolve AUTO para waiting se lastChatbotApiIds já classificou", () => {
    const live = ticket(140, { chatbot: false });
    const result = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      lastWaitingApiIds: new Set(),
      lastChatbotApiIds: new Set([140]),
      protectedIds: new Set([140]),
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([140]);
  });

  it("retain privilegiado preserva waiting local só quando a API waiting veio vazia e AUTO não reivindicou", () => {
    const human = ticket(131);
    const result = reconcile({
      waitingPrev: [human],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [],
      retainLocalWhenColumnApiEmpty: true,
    });
    expect(idsOf(result.waiting)).toEqual([131]);
    expect(idsOf(result.chatbot)).toEqual([]);
  });

  it("retain privilegiado NÃO mantém em waiting um id autoritativo de AUTO", () => {
    const live = ticket(130, { chatbot: false });
    const result = reconcile({
      waitingPrev: [live],
      chatbotPrev: [],
      waitingApiTickets: [],
      chatbotApiTickets: [live],
      protectedIds: new Set([130]),
      retainLocalWhenColumnApiEmpty: true,
    });
    expect(idsOf(result.waiting)).toEqual([]);
    expect(idsOf(result.chatbot)).toEqual([130]);
  });
});

describe("collectProtectedPendingIds", () => {
  it("une socket recente e movimentos otimistas ainda válidos", () => {
    const now = 10_000;
    const moves = new Map([
      [1, { at: now - 500, status: "pending" }],
      [2, { at: now - 4000, status: "pending" }],
    ]);
    const ids = collectProtectedPendingIds({
      recentSocketIds: new Set([3, 1]),
      recentOptimisticMoves: moves,
      now,
      optimisticTtlMs: 2500,
    });
    expect([...ids].sort()).toEqual([1, 3]);
  });
});

describe("toTicketIdSet", () => {
  it("aceita tickets, ids e Set", () => {
    expect([...toTicketIdSet([ticket(1), ticket(2)])].sort()).toEqual([1, 2]);
    expect([...toTicketIdSet([3, 4])].sort()).toEqual([3, 4]);
    expect([...toTicketIdSet(new Set([5]))]).toEqual([5]);
  });
});
