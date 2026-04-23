import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import Button from "@material-ui/core/Button";
import Badge from "@material-ui/core/Badge";
import { makeStyles } from "@material-ui/core/styles";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import BusinessIcon from "@material-ui/icons/Business";
import LayersIcon from "@material-ui/icons/Layers";
import EuroSymbolIcon from "@material-ui/icons/EuroSymbol";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import PaletteOutlinedIcon from "@material-ui/icons/PaletteOutlined";
import SecurityIcon from "@material-ui/icons/Security";
import AssignmentTurnedInIcon from "@material-ui/icons/AssignmentTurnedIn";
import BackupIcon from "@material-ui/icons/Backup";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import AccountCircleOutlinedIcon from "@material-ui/icons/AccountCircleOutlined";

import { toast } from "react-toastify";

import { AuthContext } from "../context/Auth/AuthContext";
import { SocketContext } from "../context/Socket/SocketContext";
import { i18n } from "../translate/i18n";
import api from "../services/api";
import {
  SIGNUP_SUMMARY_STALE_EVENT,
  dispatchSignupRealtimePayload,
} from "../helpers/signupSummaryBus";

const DRAWER_WIDTH = 268;

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    display: "flex",
    width: "100%",
    minHeight: 0,
    alignItems: "stretch",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  nav: {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 0,
  },
  navHeader: {
    padding: theme.spacing(2, 2, 1),
  },
  navTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    letterSpacing: "0.02em",
    color: theme.palette.text.primary,
  },
  navSubtitle: {
    marginTop: theme.spacing(0.5),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
  },
  list: {
    flex: 1,
    overflowY: "auto",
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
  },
  listItem: {
    borderRadius: theme.shape.borderRadius,
    marginLeft: theme.spacing(0.75),
    marginRight: theme.spacing(0.75),
    marginBottom: theme.spacing(0.25),
  },
  listItemSelected: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(36, 199, 118, 0.12)",
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    paddingLeft: theme.spacing(2) - 3,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: theme.spacing(1.5, 2, 2),
    boxSizing: "border-box",
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
  },
  footer: {
    padding: theme.spacing(1, 1.5, 1.5),
  },
  navItemBadge: {
    fontSize: "0.65rem",
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    lineHeight: "18px",
  },
  navItemBadgeError: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  navItemBadgeWarning: {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.getContrastText(theme.palette.warning.main),
  },
}));

function navItems() {
  return [
    { path: "/saas", label: i18n.t("platform.tabs.dashboard"), icon: DashboardOutlinedIcon },
    { path: "/saas/companies", label: i18n.t("platform.tabs.companies"), icon: BusinessIcon },
    {
      path: "/saas/signup-requests",
      label: i18n.t("platform.tabs.signupRequests"),
      icon: AssignmentTurnedInIcon,
    },
    { path: "/saas/plans", label: i18n.t("platform.tabs.plans"), icon: LayersIcon },
    { path: "/saas/finance", label: i18n.t("platform.tabs.financial"), icon: EuroSymbolIcon },
    {
      path: "/saas/billing-automation",
      label: i18n.t("platform.tabs.billingAutomation"),
      icon: AutorenewIcon,
    },
    { path: "/saas/branding", label: i18n.t("platform.tabs.branding"), icon: PaletteOutlinedIcon },
    { path: "/saas/admins", label: i18n.t("platform.tabs.superAdmins"), icon: SecurityIcon },
    { path: "/saas/backup", label: i18n.t("platform.tabs.backup"), icon: BackupIcon },
    { path: "/saas/helps", label: i18n.t("platform.tabs.helps"), icon: HelpOutlineIcon },
    { path: "/saas/announcements", label: i18n.t("platform.tabs.announcements"), icon: AnnouncementIcon },
    { path: "/saas/account", label: i18n.t("platform.tabs.myAccount"), icon: AccountCircleOutlinedIcon },
  ];
}

const SIGNUP_REQUESTS_PATH = "/saas/signup-requests";

const EMPTY_SIGNUP_MENU_SUMMARY = {
  newCount: 0,
  pendingCount: 0,
  awaitingActivationCount: 0,
  criticalCount: 0,
  rejectedCount: 0,
};

function signupSocketDedupeKey(payload) {
  if (!payload || !payload.action) return null;
  if (payload.action === "new_request" && payload.requestId != null) {
    return `n-${payload.requestId}`;
  }
  if (
    payload.action === "critical_escalation" &&
    Array.isArray(payload.requestIds) &&
    payload.requestIds.length > 0
  ) {
    return `c-${[...payload.requestIds].sort((a, b) => a - b).join(",")}`;
  }
  return null;
}

function consumeSignupSocketDedupe(key) {
  if (!key || typeof sessionStorage === "undefined") return true;
  const sk = `ps-soc-${key}`;
  if (sessionStorage.getItem(sk)) return false;
  sessionStorage.setItem(sk, "1");
  return true;
}

/** Prioridade: críticos (error) > pendentes (warning); sem badge se zero. */
function menuBadgeFromSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const critical = Number(summary.criticalCount);
  const pending = Number(summary.pendingCount);
  if (Number.isFinite(critical) && critical > 0) {
    return { count: critical, kind: "error" };
  }
  if (Number.isFinite(pending) && pending > 0) {
    return { count: pending, kind: "warning" };
  }
  return null;
}

function activeNavIndex(pathname, items) {
  let best = 0;
  let bestLen = -1;
  items.forEach((item, i) => {
    const p = item.path;
    const match =
      p === "/saas"
        ? pathname === "/saas" || pathname === "/saas/"
        : pathname === p || pathname.startsWith(`${p}/`);
    if (match && p.length > bestLen) {
      bestLen = p.length;
      best = i;
    }
  });
  return best;
}

/**
 * Layout do módulo de gestão SaaS: navegação vertical (sem tabs horizontais).
 * Rotas filhas vivem em /saas/...
 */
export default function SaaSModuleLayout({ children }) {
  const classes = useStyles();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [signupMenuSummary, setSignupMenuSummary] = useState(null);

  const fetchSignupSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/platform/signup-requests/summary");
      if (data && typeof data === "object") {
        setSignupMenuSummary({ ...EMPTY_SIGNUP_MENU_SUMMARY, ...data });
      }
    } catch {
      /* menu continua sem badge; não bloquear operação */
    }
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith("/saas")) {
      return;
    }
    fetchSignupSummary();
  }, [location.pathname, fetchSignupSummary]);

  useEffect(() => {
    const id = setInterval(fetchSignupSummary, 60000);
    return () => clearInterval(id);
  }, [fetchSignupSummary]);

  useEffect(() => {
    const onStale = () => fetchSignupSummary();
    window.addEventListener(SIGNUP_SUMMARY_STALE_EVENT, onStale);
    return () => window.removeEventListener(SIGNUP_SUMMARY_STALE_EVENT, onStale);
  }, [fetchSignupSummary]);

  useEffect(() => {
    if (!user?.super || !location.pathname.startsWith("/saas")) {
      return undefined;
    }
    const socketKey = user.companyId != null ? user.companyId : `saas-${user.id}`;
    const socket = socketManager.getSocket(socketKey);
    const onPlatformSignup = (payload) => {
      if (payload?.summary && typeof payload.summary === "object") {
        setSignupMenuSummary({ ...EMPTY_SIGNUP_MENU_SUMMARY, ...payload.summary });
      }
      dispatchSignupRealtimePayload(payload);

      const dk = signupSocketDedupeKey(payload);
      if (dk && !consumeSignupSocketDedupe(dk)) {
        return;
      }
      if (payload?.action === "new_request") {
        const name = payload.companyName || `#${payload.requestId ?? ""}`;
        toast.info(i18n.t("platform.signupRequests.socketToastNew", { company: name }));
      } else if (payload?.action === "critical_escalation") {
        const ids = payload.requestIds || [];
        if (ids.length === 1) {
          toast.warning(
            i18n.t("platform.signupRequests.socketToastCriticalOne", { id: ids[0] })
          );
        } else if (ids.length > 1) {
          toast.warning(
            i18n.t("platform.signupRequests.socketToastCriticalMany", { count: ids.length })
          );
        }
      }
    };
    socket.on("platformSignupRequest", onPlatformSignup);
    return () => {
      socket.off("platformSignupRequest", onPlatformSignup);
    };
  }, [user?.super, user?.id, user?.companyId, location.pathname, socketManager]);

  const items = useMemo(() => navItems(), [i18n.language]);
  const activeIdx = activeNavIndex(location.pathname, items);
  const signupNavBadge = menuBadgeFromSummary(signupMenuSummary);

  const canReturnToProduct = user?.companyId != null || user?.supportMode;

  return (
    <Box className={classes.root}>
      <Paper className={classes.nav} elevation={0} square component="aside">
        <Box className={classes.navHeader}>
          <Typography className={classes.navTitle} component="h1">
            {i18n.t("saas.shell.moduleTitle")}
          </Typography>
          <Typography className={classes.navSubtitle} component="p">
            {i18n.t("saas.shell.moduleSubtitle")}
          </Typography>
        </Box>
        <Divider />
        <List className={classes.list} component="nav" aria-label={i18n.t("saas.shell.navAria")}>
          {items.map((item, index) => {
            const Icon = item.icon;
            const selected = index === activeIdx;
            const isSignupItem = item.path === SIGNUP_REQUESTS_PATH;
            const showSignupBadge = isSignupItem && signupNavBadge;
            const iconEl = <Icon fontSize="small" color={selected ? "primary" : "inherit"} />;
            return (
              <ListItem
                key={item.path}
                button
                dense
                component={Link}
                to={item.path}
                className={`${classes.listItem} ${selected ? classes.listItemSelected : ""}`}
                selected={selected}
              >
                <ListItemIcon style={{ minWidth: 40 }}>
                  {showSignupBadge ? (
                    <Badge
                      badgeContent={signupNavBadge.count}
                      invisible={false}
                      anchorOrigin={{ vertical: "top", horizontal: "right" }}
                      classes={{
                        badge: `${classes.navItemBadge} ${
                          signupNavBadge.kind === "error"
                            ? classes.navItemBadgeError
                            : classes.navItemBadgeWarning
                        }`,
                      }}
                    >
                      {iconEl}
                    </Badge>
                  ) : (
                    iconEl
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: "body2",
                    style: { fontWeight: selected ? 600 : 500 },
                  }}
                />
              </ListItem>
            );
          })}
        </List>
        {canReturnToProduct && (
          <>
            <Divider />
            <Box className={classes.footer}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                size="small"
                component={Link}
                to="/tickets"
              >
                {i18n.t("saas.shell.backToProduct")}
              </Button>
            </Box>
          </>
        )}
      </Paper>
      <Box className={classes.main} component="main">
        {children}
      </Box>
    </Box>
  );
}
