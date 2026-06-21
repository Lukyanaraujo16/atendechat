import { INSTAGRAM_INTEGRATION_FEATURE_KEY } from "../config/instagramIntegrationFeature";

export { INSTAGRAM_INTEGRATION_FEATURE_KEY };

export const canUseInstagramIntegration = (planFlags) =>
  planFlags?.effectiveFeatures?.[INSTAGRAM_INTEGRATION_FEATURE_KEY] === true;