/**
 * @jest-environment node
 */
import {
  buildWhatsAppMutationPayload,
  connectionProviderBadgeKey,
  isPlatformSuperAdmin,
  listConnectionActionKeys,
  shouldCloseQrcodeModalOnSession,
  CONNECTION_PROVIDER_EVOLUTION,
  CONNECTION_PROVIDER_STANDARD,
} from "../whatsappEvolutionUi";

describe("whatsappEvolutionUi — Super Admin", () => {
  it("identifica Super Admin por user.super", () => {
    expect(isPlatformSuperAdmin({ super: true })).toBe(true);
    expect(isPlatformSuperAdmin({ super: false, profile: "admin" })).toBe(
      false
    );
    expect(isPlatformSuperAdmin({ profile: "superadmin" })).toBe(false);
    expect(isPlatformSuperAdmin(null)).toBe(false);
  });
});

describe("whatsappEvolutionUi — WhatsAppModal payload", () => {
  const baseValues = {
    name: "Conn",
    provider: "beta",
    connectionProvider: CONNECTION_PROVIDER_STANDARD,
    greetingMessage: "oi",
  };

  it("tenant create não inclui connectionProvider=evolution", () => {
    const payload = buildWhatsAppMutationPayload({
      values: {
        ...baseValues,
        connectionProvider: CONNECTION_PROVIDER_EVOLUTION,
      },
      queueIds: [],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: true,
      isSuperAdmin: false,
    });
    expect(payload.connectionProvider).toBeUndefined();
    expect(payload.provider).toBe("beta");
  });

  it("Super Admin create padrão envia baileys", () => {
    const payload = buildWhatsAppMutationPayload({
      values: baseValues,
      queueIds: [1],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: true,
      isSuperAdmin: true,
    });
    expect(payload.connectionProvider).toBe(CONNECTION_PROVIDER_STANDARD);
  });

  it("Super Admin create Evolution envia connectionProvider=evolution", () => {
    const payload = buildWhatsAppMutationPayload({
      values: {
        ...baseValues,
        connectionProvider: CONNECTION_PROVIDER_EVOLUTION,
      },
      queueIds: [],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: true,
      isSuperAdmin: true,
    });
    expect(payload.connectionProvider).toBe(CONNECTION_PROVIDER_EVOLUTION);
  });

  it("POST/create nunca inclui baseUrl/apiKey/instanceName/instanceId", () => {
    const payload = buildWhatsAppMutationPayload({
      values: {
        ...baseValues,
        connectionProvider: CONNECTION_PROVIDER_EVOLUTION,
        baseUrl: "https://evil",
        apiKey: "secret",
        instanceName: "evil-inst",
        instanceId: "id-1",
        evolution: { apiKey: "x" },
        apiKeyMasked: "sec•••",
        apiKeyEncrypted: "evo1:xxx",
      },
      queueIds: [],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: true,
      isSuperAdmin: true,
    });
    expect(payload.baseUrl).toBeUndefined();
    expect(payload.apiKey).toBeUndefined();
    expect(payload.instanceName).toBeUndefined();
    expect(payload.instanceId).toBeUndefined();
    expect(payload.evolution).toBeUndefined();
    expect(payload.apiKeyMasked).toBeUndefined();
    expect(payload.apiKeyEncrypted).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/secret|evil|evo1:/);
  });

  it("edit não permite trocar provider (remove connectionProvider)", () => {
    const payload = buildWhatsAppMutationPayload({
      values: {
        ...baseValues,
        connectionProvider: CONNECTION_PROVIDER_EVOLUTION,
      },
      queueIds: [],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: false,
      isSuperAdmin: true,
    });
    expect(payload.connectionProvider).toBeUndefined();
  });

  it("preserva provider legado beta separado de connectionProvider", () => {
    const payload = buildWhatsAppMutationPayload({
      values: baseValues,
      queueIds: [],
      transferQueueId: null,
      promptId: null,
      integrationId: null,
      flowIdWelcome: null,
      flowIdNotPhrase: null,
      isCreate: true,
      isSuperAdmin: true,
    });
    expect(payload.provider).toBe("beta");
    expect(payload.connectionProvider).toBe(CONNECTION_PROVIDER_STANDARD);
  });
});

describe("whatsappEvolutionUi — QR false-success fix", () => {
  it("CONNECTED fecha corretamente", () => {
    expect(
      shouldCloseQrcodeModalOnSession({ status: "CONNECTED", qrcode: "" })
    ).toBe(true);
  });

  it("qrcode vazio + DISCONNECTED não fecha como sucesso", () => {
    expect(
      shouldCloseQrcodeModalOnSession({
        status: "DISCONNECTED",
        qrcode: "",
      })
    ).toBe(false);
  });

  it("qrcode vazio + OPENING não fecha", () => {
    expect(
      shouldCloseQrcodeModalOnSession({ status: "OPENING", qrcode: "" })
    ).toBe(false);
  });

  it("qrcode presente sem CONNECTED não fecha", () => {
    expect(
      shouldCloseQrcodeModalOnSession({
        status: "qrcode",
        qrcode: "2@abc",
      })
    ).toBe(false);
  });

  it("socket update substitui QR mantendo sessão aberta até CONNECTED", () => {
    expect(
      shouldCloseQrcodeModalOnSession({
        status: "qrcode",
        qrcode: "2@new",
      })
    ).toBe(false);
    expect(
      shouldCloseQrcodeModalOnSession({
        status: "CONNECTED",
        qrcode: "",
      })
    ).toBe(true);
  });
});

describe("whatsappEvolutionUi — RBAC session actions", () => {
  it("desktop/mobile com permissão: ações de sessão + edit/delete", () => {
    expect(
      listConnectionActionKeys({
        status: "DISCONNECTED",
        canManageConnections: true,
      })
    ).toEqual(["tryAgain", "newQr", "edit", "delete"]);
    expect(
      listConnectionActionKeys({
        status: "qrcode",
        canManageConnections: true,
      })
    ).toEqual(["qrcode", "edit", "delete"]);
    expect(
      listConnectionActionKeys({
        status: "CONNECTED",
        canManageConnections: true,
      })
    ).toEqual(["disconnect", "edit", "delete"]);
  });

  it("desktop/mobile sem permissão: nenhuma ação", () => {
    expect(
      listConnectionActionKeys({
        status: "DISCONNECTED",
        canManageConnections: false,
      })
    ).toEqual([]);
    expect(
      listConnectionActionKeys({
        status: "CONNECTED",
        canManageConnections: false,
      })
    ).toEqual([]);
  });

  it("Super Admin bypass: identity usa user.super (não profile)", () => {
    expect(isPlatformSuperAdmin({ super: true, profile: "user" })).toBe(true);
    expect(isPlatformSuperAdmin({ super: false, profile: "admin" })).toBe(
      false
    );
  });
});

describe("whatsappEvolutionUi — badge", () => {
  it("Evolution e padrão usam labels de produto", () => {
    expect(connectionProviderBadgeKey("evolution")).toBe("evolution");
    expect(connectionProviderBadgeKey("baileys")).toBe("standard");
    expect(connectionProviderBadgeKey(undefined)).toBe("standard");
  });
});
