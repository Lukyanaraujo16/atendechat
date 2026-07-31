/**
 * Autorização Configurações / Conexões WhatsApp (settings.connections).
 */
import {
  SETTINGS_CONNECTIONS_FEATURE_KEY,
  SETTINGS_API_FEATURE_KEY,
  canManageWhatsAppConnections,
  canAccessMessagesApiSettings,
  canAccessCompanySettingsPage,
  getConfiguracoesAccess,
} from "../settingsConnectionsAccess";

function planFlagsWith(features, extras = {}) {
  return {
    loaded: true,
    useExternalApi: features[SETTINGS_API_FEATURE_KEY] === true,
    useGroups: true,
    effectiveFeatures: { ...features },
    planTierEffectiveFeatures: { ...features },
    ...extras,
  };
}

describe("settingsConnectionsAccess", () => {
  describe("chave oficial", () => {
    it("usa settings.connections", () => {
      expect(SETTINGS_CONNECTIONS_FEATURE_KEY).toBe("settings.connections");
      expect(SETTINGS_API_FEATURE_KEY).toBe("settings.api");
    });
  });

  describe("usuário comum com permissão", () => {
    const user = { id: 10, profile: "user", companyId: 1 };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: true,
      [SETTINGS_API_FEATURE_KEY]: false,
    });

    it("pode gerenciar conexões WhatsApp", () => {
      expect(canManageWhatsAppConnections(planFlags, user)).toBe(true);
    });

    it("vê menu pai Configurações e só Conexões", () => {
      const access = getConfiguracoesAccess(planFlags, user);
      expect(access.visible).toBe(true);
      expect(access.showConnections).toBe(true);
      expect(access.showApi).toBe(false);
      expect(access.showCompanySettings).toBe(false);
      expect(access.showMediaManager).toBe(false);
      expect(access.showGroups).toBe(false);
      expect(access.defaultPath).toBe("/connections");
    });

    it("não acessa demais itens administrativos", () => {
      expect(canAccessCompanySettingsPage(user)).toBe(false);
      expect(canAccessMessagesApiSettings(planFlags, user)).toBe(false);
    });
  });

  describe("usuário comum sem permissão", () => {
    const user = { id: 11, profile: "user", companyId: 1 };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: false,
      [SETTINGS_API_FEATURE_KEY]: false,
      "team.users": false,
    });

    it("não gerencia conexões", () => {
      expect(canManageWhatsAppConnections(planFlags, user)).toBe(false);
    });

    it("não vê menu Configurações", () => {
      const access = getConfiguracoesAccess(planFlags, user);
      expect(access.visible).toBe(false);
      expect(access.showConnections).toBe(false);
    });
  });

  describe("usuário comum só com conexões (sem outras admin)", () => {
    const user = { id: 12, profile: "user", companyId: 1 };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: true,
      [SETTINGS_API_FEATURE_KEY]: false,
      "team.users": false,
      "finance.subscription": false,
    });

    it("Configurações contém apenas Conexões WhatsApp", () => {
      const access = getConfiguracoesAccess(planFlags, user);
      expect(access.visible).toBe(true);
      expect(access.showConnections).toBe(true);
      expect(access.showApi).toBe(false);
      expect(access.showCompanySettings).toBe(false);
      expect(access.showMediaManager).toBe(false);
      expect(access.showGroups).toBe(false);
    });
  });

  describe("administrador", () => {
    const user = { id: 1, profile: "admin", companyId: 1 };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: true,
      [SETTINGS_API_FEATURE_KEY]: true,
      "team.groups": true,
    });

    it("mantém acesso a conexões e demais configurações privilegiadas", () => {
      expect(canManageWhatsAppConnections(planFlags, user)).toBe(true);
      const access = getConfiguracoesAccess(planFlags, user);
      expect(access.visible).toBe(true);
      expect(access.showConnections).toBe(true);
      expect(access.showApi).toBe(true);
      expect(access.showCompanySettings).toBe(true);
      expect(access.showMediaManager).toBe(true);
      expect(access.showGroups).toBe(true);
    });
  });

  describe("plano sem o recurso", () => {
    const user = {
      id: 13,
      profile: "user",
      companyId: 1,
      effectiveUserFeatures: { [SETTINGS_CONNECTIONS_FEATURE_KEY]: true },
    };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: false,
    });

    it("permissão individual não ultrapassa limitação do plano", () => {
      expect(canManageWhatsAppConnections(planFlags, user)).toBe(false);
      expect(getConfiguracoesAccess(planFlags, user).showConnections).toBe(
        false
      );
    });
  });

  describe("supervisor privilegiado", () => {
    const user = { id: 2, profile: "supervisor", companyId: 1 };
    const planFlags = planFlagsWith({
      [SETTINGS_CONNECTIONS_FEATURE_KEY]: false,
      [SETTINGS_API_FEATURE_KEY]: false,
    });

    it("vê Configurações via página da empresa mesmo sem connections", () => {
      const access = getConfiguracoesAccess(planFlags, user);
      expect(access.showCompanySettings).toBe(true);
      expect(access.showConnections).toBe(false);
      expect(access.visible).toBe(true);
      expect(access.defaultPath).toBe("/settings");
    });

    it("com settings.connections gerencia conexões", () => {
      const withConn = planFlagsWith({
        [SETTINGS_CONNECTIONS_FEATURE_KEY]: true,
      });
      expect(canManageWhatsAppConnections(withConn, user)).toBe(true);
    });
  });
});
