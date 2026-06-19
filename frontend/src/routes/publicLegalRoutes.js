import PrivacyPolicy from "../pages/Legal/PrivacyPolicy";
import TermsOfService from "../pages/Legal/TermsOfService";

export const PUBLIC_LEGAL_PATHS = [
  "/privacy",
  "/privacy-policy",
  "/politica-de-privacidade",
  "/terms",
  "/terms-of-service",
  "/termos-de-uso",
];

export const PUBLIC_LEGAL_ROUTES = [
  { path: "/privacy", component: PrivacyPolicy },
  { path: "/privacy-policy", component: PrivacyPolicy },
  { path: "/politica-de-privacidade", component: PrivacyPolicy },
  { path: "/terms", component: TermsOfService },
  { path: "/terms-of-service", component: TermsOfService },
  { path: "/termos-de-uso", component: TermsOfService },
];

export function isPublicLegalPath(pathname) {
  return PUBLIC_LEGAL_PATHS.includes(pathname);
}
