import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import usePlans from "./usePlans";
import {
  buildEffectiveModuleFlagsFromFeatureMap,
  mergeLiveEffectiveFeatures,
} from "../components/ModuleSettings/moduleSync";
import { countPostLogin } from "../utils/postLoginDebug";

const PlanFlagsContext = createContext(null);

function readUserEffectiveFeatures(user) {
  const userFx = user?.effectiveUserFeatures;
  if (userFx && typeof userFx === "object" && Object.keys(userFx).length > 0) {
    return userFx;
  }
  return null;
}

function applyCampaignsShowOverride(base) {
  if (typeof window === "undefined" || !localStorage.getItem("cshow")) {
    return base;
  }
  return {
    ...base,
    useCampaigns: true,
    useFlowbuilders: true,
    effectiveFeatures: {
      ...base.effectiveFeatures,
      "campaigns.sends": true,
      "campaigns.lists": true,
      "automation.chatbot": true,
      "automation.keywords": true,
    },
  };
}

function flagsPayloadEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.loaded === b.loaded &&
    a.useCampaigns === b.useCampaigns &&
    a.useFlowbuilders === b.useFlowbuilders &&
    a.useKanban === b.useKanban &&
    a.useOpenAi === b.useOpenAi &&
    a.useIntegrations === b.useIntegrations &&
    a.useSchedules === b.useSchedules &&
    a.useExternalApi === b.useExternalApi &&
    a.useGroups === b.useGroups &&
    a.useInternalChat === b.useInternalChat &&
    JSON.stringify(a.effectiveFeatures || {}) ===
      JSON.stringify(b.effectiveFeatures || {})
  );
}

function usePlanFlagsState() {
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const lastCompanyIdRef = useRef(undefined);
  const inFlightRef = useRef(false);
  const [flags, setFlags] = useState({
    useCampaigns: false,
    useFlowbuilders: false,
    useKanban: false,
    useOpenAi: false,
    useIntegrations: false,
    useSchedules: false,
    useExternalApi: false,
    useGroups: true,
    useInternalChat: true,
    loaded: false,
    planTierEffectiveFeatures: {},
    effectiveFeatures: {},
  });

  const userFxKey = useMemo(
    () => JSON.stringify(user?.effectiveUserFeatures || {}),
    [user?.effectiveUserFeatures]
  );

  const modulePermsKey = useMemo(
    () => JSON.stringify(user?.company?.modulePermissions || {}),
    [user?.company?.modulePermissions]
  );

  useEffect(() => {
    countPostLogin("usePlanFlags effect");

    if (!user?.companyId) {
      lastCompanyIdRef.current = undefined;
      setFlags((f) => {
        const next = applyCampaignsShowOverride({
          ...f,
          loaded: true,
          effectiveFeatures: {},
          planTierEffectiveFeatures: {},
        });
        return flagsPayloadEqual(f, next) ? f : next;
      });
      return undefined;
    }

    const cid = user.companyId;
    const companyChanged = lastCompanyIdRef.current !== cid;
    lastCompanyIdRef.current = cid;

    if (companyChanged) {
      setFlags((f) => (f.loaded ? { ...f, loaded: false } : f));
    }

    if (inFlightRef.current) {
      return undefined;
    }

    let cancelled = false;
    inFlightRef.current = true;

    (async () => {
      try {
        countPostLogin("usePlanFlags fetch listPlan");
        const planConfigs = await getPlanCompany(undefined, user.companyId);
        if (cancelled) return;

        const p = planConfigs?.plan;
        const planEffectiveFeatures = planConfigs?.effectiveFeatures || {};
        const effectiveFeatures = mergeLiveEffectiveFeatures(
          planEffectiveFeatures,
          user
        );
        const modulePerms = user?.company?.modulePermissions;
        const effFromFeatures = buildEffectiveModuleFlagsFromFeatureMap(
          effectiveFeatures,
          modulePerms ?? {}
        );

        const applyNext = (payload) => {
          setFlags((f) => {
            const next = applyCampaignsShowOverride(payload);
            return flagsPayloadEqual(f, next) ? f : next;
          });
        };

        if (!p) {
          applyNext({
            useCampaigns: false,
            useFlowbuilders: false,
            useKanban: false,
            useOpenAi: false,
            useIntegrations: false,
            useSchedules: false,
            useExternalApi: false,
            useGroups: true,
            useInternalChat: false,
            loaded: true,
            planTierEffectiveFeatures: planEffectiveFeatures,
            effectiveFeatures,
          });
          return;
        }

        applyNext({
          useCampaigns: !!effFromFeatures.useCampaigns,
          useFlowbuilders: !!effFromFeatures.useFlowbuilders,
          useKanban: !!effFromFeatures.useKanban,
          useOpenAi: !!effFromFeatures.useOpenAi,
          useIntegrations: !!effFromFeatures.useIntegrations,
          useSchedules: !!effFromFeatures.useSchedules,
          useExternalApi: !!effFromFeatures.useExternalApi,
          useGroups: effFromFeatures.useGroups !== false,
          useInternalChat: !!effFromFeatures.useInternalChat,
          loaded: true,
          planTierEffectiveFeatures: planEffectiveFeatures,
          effectiveFeatures,
        });
      } catch (err) {
        console.error("[DiagListPlan] usePlanFlags fetch failed", {
          status: err?.response?.status ?? null,
          error: err?.response?.data?.error ?? null,
          companyId: user?.companyId ?? null,
          path:
            typeof window !== "undefined" ? window.location.pathname : null,
        });
        if (!cancelled) {
          setFlags((f) => {
            const next = applyCampaignsShowOverride({ ...f, loaded: true });
            return flagsPayloadEqual(f, next) ? f : next;
          });
        }
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      inFlightRef.current = false;
    };
  }, [user?.companyId, userFxKey, modulePermsKey, getPlanCompany]);

  const userFxSync = useMemo(
    () => readUserEffectiveFeatures(user),
    [user?.effectiveUserFeatures]
  );

  const effectiveFeaturesOut = useMemo(() => {
    if (flags.loaded) {
      return flags.effectiveFeatures;
    }
    if (userFxSync) {
      return userFxSync;
    }
    return flags.effectiveFeatures;
  }, [flags.loaded, flags.effectiveFeatures, userFxSync]);

  const ready = flags.loaded || Boolean(userFxSync);

  return {
    ...flags,
    effectiveFeatures: effectiveFeaturesOut,
    loaded: flags.loaded,
    ready,
    permissionsReady: ready,
  };
}

export function PlanFlagsProvider({ children }) {
  const value = usePlanFlagsState();
  return (
    <PlanFlagsContext.Provider value={value}>{children}</PlanFlagsContext.Provider>
  );
}

export default function usePlanFlags() {
  const ctx = useContext(PlanFlagsContext);
  if (!ctx) {
    throw new Error("usePlanFlags deve ser usado dentro de PlanFlagsProvider");
  }
  return ctx;
}
