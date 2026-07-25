/**
 * Navegação interna do Console Técnico (Fase 1.5).
 * Não autoriza — o AgentOsRouteGuard continua sendo a segurança real.
 */
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import TimelineIcon from "@material-ui/icons/Timeline";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import SettingsEthernetIcon from "@material-ui/icons/SettingsEthernet";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";
import RateReviewOutlinedIcon from "@material-ui/icons/RateReviewOutlined";
import VerifiedUserOutlinedIcon from "@material-ui/icons/VerifiedUserOutlined";
import FeedbackOutlinedIcon from "@material-ui/icons/FeedbackOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import MemoryOutlinedIcon from "@material-ui/icons/MemoryOutlined";
import SchoolOutlinedIcon from "@material-ui/icons/SchoolOutlined";
import GroupWorkOutlinedIcon from "@material-ui/icons/GroupWorkOutlined";
import BuildOutlinedIcon from "@material-ui/icons/BuildOutlined";
import ExtensionOutlinedIcon from "@material-ui/icons/ExtensionOutlined";
import FlightTakeoffIcon from "@material-ui/icons/FlightTakeoff";
import LocalShippingIcon from "@material-ui/icons/LocalShipping";

import {
  AGENTOS_TECHNICAL_ROUTE_ENTRIES,
  TECHNICAL_CONSOLE_ROOT_PATH,
} from "./agentOsConsoleRoutes";
import { AGENTOS_PLATFORM_PERMISSION_KEYS } from "./agentOsPlatformPermissions";

const byPageKey = AGENTOS_TECHNICAL_ROUTE_ENTRIES.reduce((acc, e) => {
  acc[e.pageKey] = e;
  return acc;
}, {});

function entry(pageKey, group, labelKey, icon, writePermission = null) {
  const route = byPageKey[pageKey];
  if (!route) {
    throw new Error(`agentOsConsoleNavigation: pageKey desconhecido: ${pageKey}`);
  }
  return {
    id: pageKey,
    pageKey,
    labelKey,
    path: route.canonicalPath,
    group,
    icon,
    writePermission,
    matchPaths: [route.canonicalPath, route.legacyPath],
    legacyPaths: [route.legacyPath],
  };
}

export const AGENTOS_CONSOLE_NAV_GROUPS = [
  {
    id: "operation",
    labelKey: "technicalConsole.groups.operation",
  },
  {
    id: "quality",
    labelKey: "technicalConsole.groups.quality",
  },
  {
    id: "intelligence",
    labelKey: "technicalConsole.groups.intelligence",
  },
  {
    id: "tools",
    labelKey: "technicalConsole.groups.tools",
  },
  {
    id: "delivery",
    labelKey: "technicalConsole.groups.delivery",
  },
];

/** Itens de navegação — paths canônicos apenas. */
export const AGENTOS_CONSOLE_NAV_ITEMS = [
  entry(
    "monitor",
    "operation",
    "technicalConsole.nav.monitor",
    DashboardOutlinedIcon
  ),
  entry(
    "observability",
    "operation",
    "technicalConsole.nav.observability",
    TimelineIcon
  ),
  entry(
    "execution-sessions",
    "operation",
    "technicalConsole.nav.executionSessions",
    PlayCircleOutlineIcon
  ),
  entry(
    "runtime",
    "operation",
    "technicalConsole.nav.runtime",
    SettingsEthernetIcon
  ),
  entry("actions", "operation", "technicalConsole.nav.actions", FlashOnIcon),
  entry(
    "analytics",
    "quality",
    "technicalConsole.nav.analytics",
    AssessmentOutlinedIcon
  ),
  entry(
    "evaluation",
    "quality",
    "technicalConsole.nav.evaluation",
    RateReviewOutlinedIcon
  ),
  entry(
    "evidence",
    "quality",
    "technicalConsole.nav.evidence",
    VerifiedUserOutlinedIcon
  ),
  entry(
    "feedback",
    "quality",
    "technicalConsole.nav.feedback",
    FeedbackOutlinedIcon
  ),
  entry(
    "shadow-fc",
    "quality",
    "technicalConsole.nav.shadowFc",
    VisibilityOutlinedIcon
  ),
  entry(
    "planning",
    "intelligence",
    "technicalConsole.nav.planning",
    AccountTreeOutlinedIcon
  ),
  entry(
    "memory",
    "intelligence",
    "technicalConsole.nav.memory",
    MemoryOutlinedIcon
  ),
  entry(
    "learning",
    "intelligence",
    "technicalConsole.nav.learning",
    SchoolOutlinedIcon
  ),
  entry(
    "multi-agent",
    "intelligence",
    "technicalConsole.nav.multiAgent",
    GroupWorkOutlinedIcon
  ),
  entry("tools", "tools", "technicalConsole.nav.tools", BuildOutlinedIcon),
  entry("mcp", "tools", "technicalConsole.nav.mcp", ExtensionOutlinedIcon),
  entry(
    "rollout",
    "delivery",
    "technicalConsole.nav.rollout",
    FlightTakeoffIcon,
    AGENTOS_PLATFORM_PERMISSION_KEYS.ROLLOUT_MANAGE
  ),
  entry(
    "production",
    "delivery",
    "technicalConsole.nav.production",
    LocalShippingIcon,
    AGENTOS_PLATFORM_PERMISSION_KEYS.PRODUCTION_MANAGE
  ),
];

export function getNavItemByPath(pathname) {
  if (!pathname) return null;
  if (pathname === TECHNICAL_CONSOLE_ROOT_PATH) return null;
  return (
    AGENTOS_CONSOLE_NAV_ITEMS.find(
      (item) =>
        item.path === pathname ||
        (item.matchPaths && item.matchPaths.includes(pathname))
    ) || null
  );
}

export function getNavGroupById(groupId) {
  return AGENTOS_CONSOLE_NAV_GROUPS.find((g) => g.id === groupId) || null;
}

export function getNavItemsByGroup(groupId) {
  return AGENTOS_CONSOLE_NAV_ITEMS.filter((item) => item.group === groupId);
}

export function listCanonicalNavPaths() {
  return AGENTOS_CONSOLE_NAV_ITEMS.map((item) => item.path);
}

export function getCommercialPathsExcludedFromConsole() {
  return [
    "/flowbuilders",
    "/phrase-lists",
    "/queue-integration",
    "/ai-agent",
    "/ai-agent/wizard",
    "/knowledge-base",
    "/prompts",
    "/quick-messages",
  ];
}
