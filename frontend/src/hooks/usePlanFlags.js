import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import usePlans from "./usePlans";
import { buildEffectiveModuleFlagsFromFeatureMap } from "../components/ModuleSettings/moduleSync";

function readUserEffectiveFeatures(user) {
  const userFx = user?.effectiveUserFeatures;
  if (userFx && typeof userFx === "object" && Object.keys(userFx).length > 0) {
    return userFx;
  }
  return null;
}

/** Alinha o override legado `cshow` ao mesmo instante em que o plano fica pronto (evita “saltar” campanhas). */
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

/**
 * Flags de plano (legado) + mapa granular `effectiveFeatures` (chaves config/features),
 * refinado com `user.effectiveUserFeatures` quando existir (backend já aplica plano ∧ utilizador).
 */
export default function usePlanFlags() {
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const lastCompanyIdRef = useRef(undefined);
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
    /** Só o teto do plano (sem camada de utilizador). */
    planTierEffectiveFeatures: {},
    effectiveFeatures: {},
  });

  useEffect(() => {
    if (!user?.companyId) {
      lastCompanyIdRef.current = undefined;
      setFlags((f) =>
        applyCampaignsShowOverride({
          ...f,
          loaded: true,
          effectiveFeatures: {},
          planTierEffectiveFeatures: {},
        })
      );
      return;
    }

    const cid = user.companyId;
    const companyChanged = lastCompanyIdRef.current !== cid;
    lastCompanyIdRef.current = cid;

    if (companyChanged) {
      setFlags((f) => ({ ...f, loaded: false }));
    }

    let cancelled = false;
    (async () => {
      try {
        const planConfigs = await getPlanCompany(undefined, user.companyId);
        if (cancelled) return;
        const p = planConfigs?.plan;
        const eff = planConfigs?.effectiveModules;
        const planEffectiveFeatures = planConfigs?.effectiveFeatures || {};
        const userFx = user?.effectiveUserFeatures;
        const hasUserFx =
          userFx &&
          typeof userFx === "object" &&
          Object.keys(userFx).length > 0;
        const effectiveFeatures = hasUserFx ? userFx : planEffectiveFeatures;
        const modulePerms = user?.company?.modulePermissions;
        const effFromFeatures = hasUserFx
          ? buildEffectiveModuleFlagsFromFeatureMap(
              effectiveFeatures,
              modulePerms ?? {}
            )
          : null;
        if (!p) {
          setFlags(
            applyCampaignsShowOverride({
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
            })
          );
          return;
        }
        if (effFromFeatures) {
          setFlags(
            applyCampaignsShowOverride({
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
            })
          );
          return;
        }
        if (eff) {
          setFlags(
            applyCampaignsShowOverride({
              useCampaigns: !!eff.useCampaigns,
              useFlowbuilders: !!eff.useFlowbuilders,
              useKanban: !!eff.useKanban,
              useOpenAi: !!eff.useOpenAi,
              useIntegrations: !!eff.useIntegrations,
              useSchedules: !!eff.useSchedules,
              useExternalApi: !!eff.useExternalApi,
              useGroups: eff.useGroups !== false,
              useInternalChat:
                eff.useInternalChat !== undefined
                  ? !!eff.useInternalChat
                  : p.useInternalChat !== false,
              loaded: true,
              planTierEffectiveFeatures: planEffectiveFeatures,
              effectiveFeatures,
            })
          );
        } else {
          setFlags(
            applyCampaignsShowOverride({
              useCampaigns: !!p.useCampaigns,
              useFlowbuilders: !!(p.useFlowbuilders ?? p.useCampaigns),
              useKanban: !!p.useKanban,
              useOpenAi: !!p.useOpenAi,
              useIntegrations: !!p.useIntegrations,
              useSchedules: !!p.useSchedules,
              useExternalApi: !!p.useExternalApi,
              useGroups: true,
              useInternalChat: p.useInternalChat !== false,
              loaded: true,
              planTierEffectiveFeatures: planEffectiveFeatures,
              effectiveFeatures,
            })
          );
        }
      } catch {
        if (!cancelled) {
          setFlags((f) => applyCampaignsShowOverride({ ...f, loaded: true }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.companyId,
    user?.effectiveUserFeatures,
    user?.company?.modulePermissions,
    getPlanCompany,
  ]);

  const userFxSync = useMemo(() => readUserEffectiveFeatures(user), [
    user?.effectiveUserFeatures,
  ]);

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
