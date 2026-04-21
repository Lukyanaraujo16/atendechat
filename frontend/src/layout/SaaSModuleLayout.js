import React, { useContext, useMemo } from "react";
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
import { makeStyles } from "@material-ui/core/styles";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import BusinessIcon from "@material-ui/icons/Business";
import LayersIcon from "@material-ui/icons/Layers";
import EuroSymbolIcon from "@material-ui/icons/EuroSymbol";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import PaletteOutlinedIcon from "@material-ui/icons/PaletteOutlined";
import SecurityIcon from "@material-ui/icons/Security";
import BackupIcon from "@material-ui/icons/Backup";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import AccountCircleOutlinedIcon from "@material-ui/icons/AccountCircleOutlined";

import { AuthContext } from "../context/Auth/AuthContext";
import { i18n } from "../translate/i18n";

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
  },
  footer: {
    padding: theme.spacing(1, 1.5, 1.5),
  },
}));

function navItems() {
  return [
    { path: "/saas", label: i18n.t("platform.tabs.dashboard"), icon: DashboardOutlinedIcon },
    { path: "/saas/companies", label: i18n.t("platform.tabs.companies"), icon: BusinessIcon },
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

  const items = useMemo(() => navItems(), [i18n.language]);
  const activeIdx = activeNavIndex(location.pathname, items);

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
                  <Icon fontSize="small" color={selected ? "primary" : "inherit"} />
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
