/**
 * Notificações globais de novas mensagens — regras, dedupe, visibilidade, desktop API.
 */
import {
  shouldNotifyWhatsappMessage,
  shouldNotifyUserAboutTicket,
  isTicketOpenInRoute,
  getWhatsappToastVariant,
  buildWhatsappMessagePreview,
  buildNotificationDedupeKey,
  isRealtimeInboundMessage,
} from "../globalNotificationRules";
import {
  isPageHidden,
  shouldDeferUiNotification,
  queueBackgroundNotification,
  flushDeferredNotifications,
  registerNotificationFlushHandlers,
} from "../pageVisibilityNotifications";
import {
  claimNotificationAlertId,
  clearNotificationAlertDedupe,
  __notificationAlertDedupeSizeForTests,
} from "../notificationAlertDedupe";
import {
  getDesktopNotificationPermission,
  isDesktopNotificationSupported,
  readDesktopNotificationPrefEnabled,
  persistDesktopNotificationPrefEnabled,
  showDesktopMessageNotification,
} from "../browserDesktopNotification";
import {
  syncPendingMessageTabIndicators,
  resetPendingMessageTabIndicators,
  __getTabIndicatorStateForTests,
} from "../notificationTabIndicators";

describe("global message notifications", () => {
  beforeEach(() => {
    clearNotificationAlertDedupe();
    resetPendingMessageTabIndicators();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  describe("mensagem notificável", () => {
    const user = {
      id: 7,
      profile: "user",
      queues: [{ id: 1 }],
    };

    it("aceita inbound create unread na fila do usuário", () => {
      expect(
        shouldNotifyWhatsappMessage(
          {
            action: "create",
            message: { fromMe: false, read: false, id: 1 },
            ticket: { id: 10, queueId: 1, userId: null, isGroup: false },
          },
          user
        )
      ).toBe(true);
    });

    it("ignora mensagem própria", () => {
      expect(
        shouldNotifyWhatsappMessage(
          {
            action: "create",
            message: { fromMe: true, read: false, id: 2 },
            ticket: { id: 10, queueId: 1, userId: 7, isGroup: false },
          },
          user
        )
      ).toBe(false);
    });

    it("ignora ticket de outra empresa/fila (sem assignee e fila alheia)", () => {
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 99, userId: null, isGroup: false },
          user
        )
      ).toBe(false);
    });

    it("ignora ticket atribuído a outro", () => {
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 1, userId: 99, isGroup: false },
          user
        )
      ).toBe(false);
    });

    it("admin/supervisor sem filas notificam pending não atribuído", () => {
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 99, userId: null, isGroup: false },
          { id: 1, profile: "admin", queues: [] }
        )
      ).toBe(true);
      expect(
        shouldNotifyUserAboutTicket(
          { id: 10, queueId: 1, userId: null, isGroup: false },
          { id: 1, profile: "admin", queues: [{ id: 1 }] }
        )
      ).toBe(true);
    });
  });

  describe("ticket aberto vs outra rota", () => {
    const ticket = { id: 55, uuid: "abc-55" };

    it("detecta ticket aberto na rota", () => {
      expect(isTicketOpenInRoute(ticket, "/tickets/abc-55")).toBe(true);
      expect(isTicketOpenInRoute(ticket, "/tickets/55")).toBe(true);
      expect(isTicketOpenInRoute(ticket, "/crm")).toBe(false);
    });

    it("toast none no ticket aberto; normal em Dashboard", () => {
      expect(getWhatsappToastVariant("/tickets/abc-55", ticket)).toBe("none");
      expect(getWhatsappToastVariant("/", ticket)).toBe("normal");
      expect(getWhatsappToastVariant("/tickets", ticket)).toBe("discrete");
    });
  });

  describe("preview de mídia", () => {
    it("usa rótulos para áudio/imagem/documento", () => {
      expect(buildWhatsappMessagePreview({ mediaType: "audio" })).toMatch(/Áudio/);
      expect(buildWhatsappMessagePreview({ mediaType: "image" })).toMatch(/Imagem/);
      expect(buildWhatsappMessagePreview({ mediaType: "document" })).toMatch(/Documento/);
      expect(
        buildWhatsappMessagePreview({ mediaType: "chat", body: "olá mundo" })
      ).toBe("olá mundo");
    });
  });

  describe("dedupe", () => {
    it("chave estável por message id", () => {
      expect(buildNotificationDedupeKey("whatsapp", 42)).toBe("whatsapp:42");
    });

    it("claim impede segundo alerta", () => {
      expect(claimNotificationAlertId("whatsapp:1")).toBe(true);
      expect(claimNotificationAlertId("whatsapp:1")).toBe(false);
      expect(__notificationAlertDedupeSizeForTests()).toBeGreaterThan(0);
    });
  });

  describe("realtime filter", () => {
    it("aceita mensagem recente e rejeita antiga", () => {
      const start = Date.now();
      expect(
        isRealtimeInboundMessage(
          { createdAt: new Date(start + 100).toISOString() },
          start
        )
      ).toBe(true);
      expect(
        isRealtimeInboundMessage(
          { createdAt: new Date(start - 60_000).toISOString() },
          start
        )
      ).toBe(false);
    });
  });

  describe("visibilidade", () => {
    it("página visível não adia toast", () => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      expect(isPageHidden()).toBe(false);
      expect(shouldDeferUiNotification()).toBe(false);
    });

    it("página oculta adia toast (não o pipeline de som)", () => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      expect(isPageHidden()).toBe(true);
      expect(shouldDeferUiNotification()).toBe(true);
    });

    it("fila de background deduplica messageId e flush mostra resumo", () => {
      const summary = jest.fn();
      registerNotificationFlushHandlers({ showSummaryToast: summary });
      expect(queueBackgroundNotification({ messageId: "m1" })).toBe(true);
      expect(queueBackgroundNotification({ messageId: "m1" })).toBe(false);
      expect(queueBackgroundNotification({ messageId: "m2" })).toBe(true);
      flushDeferredNotifications();
      expect(summary).toHaveBeenCalledWith(2);
      summary.mockClear();
      flushDeferredNotifications();
      expect(summary).not.toHaveBeenCalled();
    });
  });

  describe("desktop notification API", () => {
    afterEach(() => {
      // restaura Notification padrão do jsdom se existir
    });

    it("unsupported quando API ausente", () => {
      const desc = Object.getOwnPropertyDescriptor(window, "Notification");
      try {
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: undefined,
        });
        expect(isDesktopNotificationSupported()).toBe(false);
        expect(getDesktopNotificationPermission()).toBe("unsupported");
      } finally {
        if (desc) {
          Object.defineProperty(window, "Notification", desc);
        }
      }
    });

    it("respeita permission default/granted/denied", () => {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: { permission: "default" },
      });
      expect(getDesktopNotificationPermission()).toBe("default");
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: { permission: "granted" },
      });
      expect(getDesktopNotificationPermission()).toBe("granted");
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: { permission: "denied" },
      });
      expect(getDesktopNotificationPermission()).toBe("denied");
    });

    it("não cria Notification se permission não granted", () => {
      const ctor = jest.fn();
      ctor.permission = "default";
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: ctor,
      });
      expect(
        showDesktopMessageNotification({ title: "t", body: "b" })
      ).toBeNull();
      expect(ctor).not.toHaveBeenCalled();
    });

    it("cria Notification quando granted e pref ligada", () => {
      const instances = [];
      function FakeNotification(title, opts) {
        this.title = title;
        this.opts = opts;
        this.close = jest.fn();
        instances.push(this);
      }
      FakeNotification.permission = "granted";
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: FakeNotification,
      });
      persistDesktopNotificationPrefEnabled(true);
      expect(readDesktopNotificationPrefEnabled()).toBe(true);
      const n = showDesktopMessageNotification({
        title: "Contato",
        body: "oi",
        tag: "ticket-1",
      });
      expect(n).toBeTruthy();
      expect(instances).toHaveLength(1);
      expect(instances[0].title).toBe("Contato");
    });
  });

  describe("título da aba", () => {
    it("aplica contagem com página oculta e restaura", () => {
      document.title = "StreamHUB Chat";
      syncPendingMessageTabIndicators({
        count: 3,
        pageHidden: true,
        systemName: "StreamHUB Chat",
      });
      const state = __getTabIndicatorStateForTests();
      expect(state.pendingCount).toBe(3);
      expect(state.blinkActive).toBe(true);
      expect(document.title).toMatch(/3|Nova/);

      syncPendingMessageTabIndicators({
        count: 3,
        pageHidden: false,
        systemName: "StreamHUB Chat",
      });
      expect(document.title).toBe("StreamHUB Chat");
      expect(__getTabIndicatorStateForTests().blinkActive).toBe(false);

      resetPendingMessageTabIndicators();
    });
  });
});
