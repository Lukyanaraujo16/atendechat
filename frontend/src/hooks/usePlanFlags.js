import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import usePlans from "./usePlans";

/**
 * Flags de plano (legado) + mapa granular `effectiveFeatures` (chaves config/features).
 */
export default function usePlanFlags() {
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
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
    effectiveFeatures: {},
  });

  useEffect(() => {
    if (!user?.companyId) {
      setFlags((f) => ({ ...f, loaded: true, effectiveFeatures: {} }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const planConfigs = await getPlanCompany(undefined, user.companyId);
        if (cancelled) return;
        const p = planConfigs?.plan;
        const eff = planConfigs?.effectiveModules;
        const effectiveFeatures = planConfigs?.effectiveFeatures || {};
        if (!p) {
          setFlags({
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
            effectiveFeatures,
          });
          return;
        }
        if (eff) {
          setFlags({
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
            effectiveFeatures,
          });
        } else {
          setFlags({
            useCampaigns: !!p.useCampaigns,
            useFlowbuilders: !!p.useCampaigns,
            useKanban: !!p.useKanban,
            useOpenAi: !!p.useOpenAi,
            useIntegrations: !!p.useIntegrations,
            useSchedules: !!p.useSchedules,
            useExternalApi: !!p.useExternalApi,
            useGroups: true,
            useInternalChat: p.useInternalChat !== false,
            loaded: true,
            effectiveFeatures,
          });
        }
      } catch {
        if (!cancelled) setFlags((f) => ({ ...f, loaded: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.companyId, getPlanCompany]);

  useEffect(() => {
    if (localStorage.getItem("cshow")) {
      setFlags((f) => ({
        ...f,
        useCampaigns: true,
        useFlowbuilders: true,
        effectiveFeatures: {
          ...f.effectiveFeatures,
          "campaigns.sends": true,
          "campaigns.lists": true,
          "automation.chatbot": true,
          "automation.keywords": true,
        },
      }));
    }
  }, []);

  return flags;
}
