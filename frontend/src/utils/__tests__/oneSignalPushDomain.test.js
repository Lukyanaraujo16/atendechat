/**
 * OneSignal Web Push — domínio, opt-in e feedback do banner (Fase 2.12).
 */
import {
  PUSH_DOMAIN_STATES,
  derivePushDomainState,
  isEffectivelySubscribed,
  normalizeSubscriptionChangeEvent,
  shouldShowPushDeniedHelp,
  shouldShowPushOptInBanner,
} from "../oneSignalPushDomain";

describe("oneSignalPushDomain", () => {
  describe("isEffectivelySubscribed", () => {
    it("exige optedIn e canal (id ou token)", () => {
      expect(isEffectivelySubscribed({ optedIn: true, subscriptionId: "abc" })).toBe(true);
      expect(isEffectivelySubscribed({ optedIn: true, token: "tok" })).toBe(true);
      expect(isEffectivelySubscribed({ optedIn: true })).toBe(false);
      expect(isEffectivelySubscribed({ optedIn: false, subscriptionId: "abc" })).toBe(false);
      expect(isEffectivelySubscribed({ optedIn: false })).toBe(false);
    });

    it("não trata permission granted como inscrição", () => {
      expect(
        isEffectivelySubscribed({
          optedIn: false,
          subscriptionId: null,
          token: null,
        })
      ).toBe(false);
    });
  });

  describe("derivePushDomainState", () => {
    const base = {
      onesignalEnabled: true,
      onesignalAppId: "app-123",
      pushSupported: true,
      sdkReady: true,
      sdkLoading: false,
      permissionNative: "default",
      optedIn: false,
      subscriptionId: null,
      token: null,
      subscribing: false,
      errorCode: null,
    };

    it("push desabilitado / App ID ausente", () => {
      expect(
        derivePushDomainState({ ...base, onesignalEnabled: false })
      ).toBe(PUSH_DOMAIN_STATES.NOT_CONFIGURED);
      expect(
        derivePushDomainState({ ...base, onesignalAppId: "" })
      ).toBe(PUSH_DOMAIN_STATES.NOT_CONFIGURED);
    });

    it("sdk loading", () => {
      expect(
        derivePushDomainState({ ...base, sdkReady: false, sdkLoading: true })
      ).toBe(PUSH_DOMAIN_STATES.SDK_LOADING);
    });

    it("permission default", () => {
      expect(derivePushDomainState(base)).toBe(PUSH_DOMAIN_STATES.PERMISSION_DEFAULT);
    });

    it("permission denied", () => {
      expect(
        derivePushDomainState({ ...base, permissionNative: "denied" })
      ).toBe(PUSH_DOMAIN_STATES.PERMISSION_DENIED);
    });

    it("granted sem subscription", () => {
      expect(
        derivePushDomainState({
          ...base,
          permissionNative: "granted",
          optedIn: false,
        })
      ).toBe(PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED);
    });

    it("subscribing e subscribed", () => {
      expect(
        derivePushDomainState({ ...base, subscribing: true })
      ).toBe(PUSH_DOMAIN_STATES.SUBSCRIBING);
      expect(
        derivePushDomainState({
          ...base,
          permissionNative: "granted",
          optedIn: true,
          subscriptionId: "sub-1",
        })
      ).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    });

    it("unsupported e error", () => {
      expect(
        derivePushDomainState({ ...base, pushSupported: false })
      ).toBe(PUSH_DOMAIN_STATES.UNSUPPORTED);
      expect(
        derivePushDomainState({ ...base, errorCode: "opt_in_failed" })
      ).toBe(PUSH_DOMAIN_STATES.ERROR);
    });
  });

  describe("banner visibility", () => {
    it("mostra opt-in em default e granted_unsubscribed; não em subscribed", () => {
      expect(
        shouldShowPushOptInBanner(PUSH_DOMAIN_STATES.PERMISSION_DEFAULT)
      ).toBe(true);
      expect(
        shouldShowPushOptInBanner(PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED)
      ).toBe(true);
      expect(shouldShowPushOptInBanner(PUSH_DOMAIN_STATES.SUBSCRIBED)).toBe(false);
      expect(
        shouldShowPushOptInBanner(PUSH_DOMAIN_STATES.PERMISSION_DEFAULT, {
          dismissed: true,
        })
      ).toBe(false);
    });

    it("mostra ajuda quando denied", () => {
      expect(shouldShowPushDeniedHelp(PUSH_DOMAIN_STATES.PERMISSION_DENIED)).toBe(true);
      expect(shouldShowPushDeniedHelp(PUSH_DOMAIN_STATES.PERMISSION_DEFAULT)).toBe(false);
    });

    it("não oculta banner só porque permission é granted", () => {
      expect(
        shouldShowPushOptInBanner(PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED)
      ).toBe(true);
    });
  });

  describe("normalizeSubscriptionChangeEvent", () => {
    it("lê current do evento e faz fallback na API", () => {
      expect(
        normalizeSubscriptionChangeEvent(
          {
            current: { optedIn: true, id: "1", token: "t" },
            previous: {},
          },
          null
        )
      ).toEqual({
        optedIn: true,
        subscriptionId: "1",
        token: "t",
      });

      expect(
        normalizeSubscriptionChangeEvent(
          {},
          { User: { PushSubscription: { optedIn: true, id: "2", token: "u" } } }
        )
      ).toEqual({
        optedIn: true,
        subscriptionId: "2",
        token: "u",
      });
    });
  });
});
