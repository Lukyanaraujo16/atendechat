/**
 * Testes do fluxo sonoro (mensagem inbound + novo atendimento + gates).
 */
import {
  buildNotificationDedupeKey,
  buildPendingAttendanceSoundDedupeKey,
  isNewWaitingAttendanceTicket,
  isRealtimeInboundMessage,
  resolveWhatsappInboundSoundType,
  shouldNotifyUserAboutTicket,
  shouldNotifyWhatsappMessage,
} from "../globalNotificationRules";
import {
  claimNotificationAlertId,
  clearNotificationAlertDedupe,
} from "../notificationAlertDedupe";
import {
  __resetNotificationTabLeaderForTests,
  buildNotificationLeaderStorageKey,
  forceStopNotificationTabLeader,
  initNotificationTabLeader,
  isNotificationTabLeader,
} from "../notificationTabLeader";
import {
  playNotificationSoundThrottled,
} from "../notificationSoundPlayback";
import { SocketManager } from "../../context/Socket/SocketContext";

describe("notification sound flow (fase som)", () => {
  beforeEach(() => {
    clearNotificationAlertDedupe();
    __resetNotificationTabLeaderForTests();
    localStorage.clear();
  });

  afterEach(() => {
    __resetNotificationTabLeaderForTests();
    try {
      SocketManager.disconnectSession();
    } catch {
      /* ignore */
    }
  });

  describe("relevância", () => {
    const agent = { id: 25, profile: "user", queues: [{ id: 3 }] };

    it("mensagem inbound relevante na fila", () => {
      expect(
        shouldNotifyWhatsappMessage(
          {
            action: "create",
            message: { fromMe: false, read: false, id: "m1" },
            ticket: {
              id: 10,
              queueId: 3,
              userId: null,
              isGroup: false,
              status: "pending",
            },
          },
          agent
        )
      ).toBe(true);
    });

    it("mensagem própria não notifica", () => {
      expect(
        shouldNotifyWhatsappMessage(
          {
            action: "create",
            message: { fromMe: true, read: true, id: "m2" },
            ticket: { id: 10, queueId: 3, userId: 25, isGroup: false },
          },
          agent
        )
      ).toBe(false);
    });

    it("outra empresa/fila invisível", () => {
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 99, userId: null, isGroup: false },
          agent
        )
      ).toBe(false);
    });

    it("admin sem filas recebe pending não atribuído (contrato backend)", () => {
      expect(
        shouldNotifyUserAboutTicket(
          {
            id: 10,
            queueId: 99,
            userId: null,
            isGroup: false,
            status: "pending",
          },
          { id: 1, profile: "admin", queues: [] }
        )
      ).toBe(true);
    });

    it("admin não recebe ticket atribuído a outro", () => {
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 1, userId: 99, isGroup: false },
          { id: 1, profile: "admin", queues: [] }
        )
      ).toBe(false);
    });
  });

  describe("realtime / createdAt", () => {
    const now = Date.now();

    it("aceita mensagem recente", () => {
      expect(
        isRealtimeInboundMessage(
          { createdAt: new Date(now - 1000).toISOString() },
          now
        )
      ).toBe(true);
    });

    it("aceita mensagem sem createdAt (evento socket live)", () => {
      expect(isRealtimeInboundMessage({ id: "x" }, now)).toBe(true);
    });

    it("rejeita mensagem antiga além do skew", () => {
      expect(
        isRealtimeInboundMessage(
          { createdAt: new Date(now - 20000).toISOString() },
          now
        )
      ).toBe(false);
    });
  });

  describe("dedupe sonoro", () => {
    it("não aceita id vazio", () => {
      expect(buildNotificationDedupeKey("whatsapp", null)).toBeNull();
      expect(buildNotificationDedupeKey("whatsapp", "")).toBeNull();
      expect(claimNotificationAlertId(null)).toBe(false);
      expect(claimNotificationAlertId("")).toBe(false);
    });

    it("bloqueia segundo alerta do mesmo messageId", () => {
      const key = buildNotificationDedupeKey("whatsapp", "msg-9");
      expect(claimNotificationAlertId(key)).toBe(true);
      expect(claimNotificationAlertId(key)).toBe(false);
    });
  });

  describe("tipo de som inbound / pending", () => {
    const pendingTicket = {
      id: 50,
      uuid: "p-50",
      status: "pending",
      userId: null,
      isGroup: false,
    };

    it("detecta novo atendimento aguardando", () => {
      expect(isNewWaitingAttendanceTicket(pendingTicket)).toBe(true);
      expect(
        isNewWaitingAttendanceTicket({
          ...pendingTicket,
          userId: 25,
        })
      ).toBe(false);
      expect(
        isNewWaitingAttendanceTicket({
          ...pendingTicket,
          status: "open",
        })
      ).toBe(false);
    });

    it("primeira vez pending → newPendingTicket; segunda → newMessage", () => {
      const seen = new Set();
      const claim = (key) => {
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      };
      expect(
        resolveWhatsappInboundSoundType({
          ticket: pendingTicket,
          pathname: "/dashboard",
          claimPendingFn: claim,
        })
      ).toBe("newPendingTicket");
      expect(
        resolveWhatsappInboundSoundType({
          ticket: pendingTicket,
          pathname: "/dashboard",
          claimPendingFn: claim,
        })
      ).toBe("newMessage");
    });

    it("ticket aberto na rota → openConversationMessage", () => {
      expect(
        resolveWhatsappInboundSoundType({
          ticket: {
            id: 7,
            uuid: "u7",
            status: "open",
            userId: 25,
            isGroup: false,
          },
          pathname: "/tickets/u7",
          claimPendingFn: () => false,
        })
      ).toBe("openConversationMessage");
    });

    it("chave pending estável", () => {
      expect(buildPendingAttendanceSoundDedupeKey(pendingTicket)).toBe(
        "pending-attendance:p-50"
      );
      expect(buildPendingAttendanceSoundDedupeKey({})).toBeNull();
    });
  });

  describe("throttle", () => {
    it("não dispara duas vezes no intervalo", async () => {
      const playFn = jest.fn(() => Promise.resolve({ played: true }));
      await playNotificationSoundThrottled(playFn, "newMessage");
      await playNotificationSoundThrottled(playFn, "newMessage");
      expect(playFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("aba líder", () => {
    it("uma aba assume liderança", () => {
      localStorage.setItem("companyId", "1");
      localStorage.setItem("userId", "25");
      initNotificationTabLeader({ companyId: 1, userId: 25 });
      expect(isNotificationTabLeader()).toBe(true);
    });

    it("logout limpa e login recria liderança", () => {
      localStorage.setItem("companyId", "1");
      localStorage.setItem("userId", "25");
      initNotificationTabLeader({ companyId: 1, userId: 25 });
      expect(isNotificationTabLeader()).toBe(true);
      forceStopNotificationTabLeader();
      expect(
        localStorage.getItem(buildNotificationLeaderStorageKey(1, 25))
      ).toBeNull();
      initNotificationTabLeader({ companyId: 1, userId: 25 });
      expect(isNotificationTabLeader()).toBe(true);
    });

    it("escopo por usuário evita chave cruzada", () => {
      const a = buildNotificationLeaderStorageKey(1, 25);
      const b = buildNotificationLeaderStorageKey(1, 26);
      expect(a).not.toBe(b);
    });
  });

  describe("SocketManager socketReady", () => {
    it("disconnectSession zera socketReady", () => {
      SocketManager.socketReady = true;
      SocketManager.currentCompanyId = "1";
      SocketManager.currentUserId = "25";
      SocketManager.disconnectSession();
      expect(SocketManager.socketReady).toBe(false);
      expect(SocketManager.currentCompanyId).toBe(-1);
    });

    it("DummySocket expõe connected=false", () => {
      const sock = SocketManager.getSocket(null);
      expect(sock.connected).toBe(false);
    });
  });
});
