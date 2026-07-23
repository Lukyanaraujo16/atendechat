import {
  assertCompanyIdFromAuth,
  assertResourceBelongsToCompany,
  assertSafeId,
  assertConfirmation,
  stripSecretsDeep,
  assertPayloadBounds
} from "./AgentOsResourceAuth";
import {
  assertAgentOsPlanFeature,
  assertAgentOsPlanFeatures
} from "./AgentOsPlanGate";
import {
  getAgentOsSecurityConfig,
  setAgentOsSecurityConfig,
  resetAgentOsSecurityConfig
} from "./AgentOsSecurityConfig";
import { toSafeAgentOsError, safePublicErrorBody } from "./AgentOsSafeError";
import * as BoundaryGuard from "./AgentOsBoundaryGuard";

export {
  assertCompanyIdFromAuth,
  assertResourceBelongsToCompany,
  assertSafeId,
  assertConfirmation,
  stripSecretsDeep,
  assertPayloadBounds,
  assertAgentOsPlanFeature,
  assertAgentOsPlanFeatures,
  getAgentOsSecurityConfig,
  setAgentOsSecurityConfig,
  resetAgentOsSecurityConfig,
  toSafeAgentOsError,
  safePublicErrorBody,
  BoundaryGuard
};
