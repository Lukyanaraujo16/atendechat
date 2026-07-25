import React, { useContext, useMemo, useState } from "react";
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
import Drawer from "@material-ui/core/Drawer";
import IconButton from "@material-ui/core/IconButton";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import MenuIcon from "@material-ui/icons/Menu";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";

import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import {
  AGENTOS_CONSOLE_NAV_GROUPS,
  AGENTOS_CONSOLE_NAV_ITEMS,
  getNavGroupById,
  getNavItemByPath,
} from "../../config/agentOsConsoleNavigation";
import { TECHNICAL_CONSOLE_ROOT_PATH } from "../../config/agentOsConsoleRoutes";

const DRAWER_WIDTH = 260;

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
    height: "100%",
    maxHeight: "100%",
  },
  navMobilePaper: {
    width: DRAWER_WIDTH,
    boxSizing: "border-box",
  },
  navHeader: {
    padding: theme.spacing(1.5, 2, 1),
  },
  navTitle: {
    fontWeight: 700,
    fontSize: "1rem",
    letterSpacing: "0.02em",
  },
  navSubtitle: {
    marginTop: theme.spacing(0.5),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
  },
  tenantLine: {
    marginTop: theme.spacing(0.75),
    fontSize: "0.7rem",
    color: theme.palette.text.secondary,
  },
  supportChip: {
    display: "inline-block",
    marginTop: theme.spacing(0.5),
    fontSize: "0.65rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: theme.palette.warning.dark,
  },
  list: {
    flex: 1,
    overflowY: "auto",
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
    WebkitOverflowScrolling: "touch",
  },
  groupLabel: {
    padding: theme.spacing(1.25, 2, 0.5),
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
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
  mainColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  topBar: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  breadcrumb: {
    flex: 1,
    minWidth: 0,
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  breadcrumbStrong: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: 0,
    boxSizing: "border-box",
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    backgroundColor: theme.palette.background.default,
    "& .agentos-table-scroll": {
      width: "100%",
      maxWidth: "100%",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    },
    "& .agentos-json-scroll": {
      display: "block",
      width: "100%",
      maxWidth: "100%",
      maxHeight: 320,
      overflow: "auto",
      WebkitOverflowScrolling: "touch",
      whiteSpace: "pre",
      fontSize: 12,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
  },
  footer: {
    padding: theme.spacing(1, 1.5, 1.5),
  },
}));

function NavList({ onNavigate, activePath }) {
  const classes = useStyles();
  const groups = AGENTOS_CONSOLE_NAV_GROUPS;

  return (
    <List
      className={classes.list}
      component="nav"
      aria-label={i18n.t("technicalConsole.shell.navAria")}
      data-testid="agentos-console-nav"
    >
      <ListItem
        button
        dense
        component={Link}
        to={TECHNICAL_CONSOLE_ROOT_PATH}
        className={`${classes.listItem} ${
          activePath === TECHNICAL_CONSOLE_ROOT_PATH
            ? classes.listItemSelected
            : ""
        }`}
        selected={activePath === TECHNICAL_CONSOLE_ROOT_PATH}
        onClick={onNavigate}
        data-testid="agentos-nav-home"
      >
        <ListItemText
          primary={i18n.t("technicalConsole.shell.home")}
          primaryTypographyProps={{
            variant: "body2",
            style: {
              fontWeight:
                activePath === TECHNICAL_CONSOLE_ROOT_PATH ? 600 : 500,
            },
          }}
        />
      </ListItem>
      {groups.map((group) => {
        const items = AGENTOS_CONSOLE_NAV_ITEMS.filter(
          (item) => item.group === group.id
        );
        if (!items.length) return null;
        return (
          <React.Fragment key={group.id}>
            <Typography
              className={classes.groupLabel}
              component="div"
              data-testid={`agentos-nav-group-${group.id}`}
            >
              {i18n.t(group.labelKey)}
            </Typography>
            {items.map((item) => {
              const Icon = item.icon;
              const selected = item.path === activePath;
              return (
                <ListItem
                  key={item.id}
                  button
                  dense
                  component={Link}
                  to={item.path}
                  className={`${classes.listItem} ${
                    selected ? classes.listItemSelected : ""
                  }`}
                  selected={selected}
                  onClick={onNavigate}
                  data-testid={`agentos-nav-item-${item.id}`}
                >
                  <ListItemIcon style={{ minWidth: 36 }}>
                    <Icon
                      fontSize="small"
                      color={selected ? "primary" : "inherit"}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={i18n.t(item.labelKey)}
                    primaryTypographyProps={{
                      variant: "body2",
                      style: { fontWeight: selected ? 600 : 500 },
                    }}
                  />
                </ListItem>
              );
            })}
          </React.Fragment>
        );
      })}
    </List>
  );
}

function ShellChrome({ onOpenMobileNav, isMobile }) {
  const classes = useStyles();
  const location = useLocation();
  const activeItem = getNavItemByPath(location.pathname);
  const group = activeItem ? getNavGroupById(activeItem.group) : null;

  const crumbParts = useMemo(() => {
    const parts = [i18n.t("technicalConsole.shell.title")];
    if (group) parts.push(i18n.t(group.labelKey));
    if (activeItem) parts.push(i18n.t(activeItem.labelKey));
    else if (location.pathname === TECHNICAL_CONSOLE_ROOT_PATH) {
      parts.push(i18n.t("technicalConsole.shell.home"));
    }
    return parts;
  }, [group, activeItem, location.pathname]);

  return (
    <Box className={classes.topBar} data-testid="agentos-console-topbar">
      {isMobile && (
        <IconButton
          edge="start"
          size="small"
          onClick={onOpenMobileNav}
          aria-label={i18n.t("technicalConsole.shell.openModules")}
          data-testid="agentos-console-mobile-menu"
        >
          <MenuIcon />
        </IconButton>
      )}
      <Typography
        className={classes.breadcrumb}
        component="nav"
        aria-label="breadcrumb"
        data-testid="agentos-console-breadcrumb"
      >
        {crumbParts.map((part, idx) => (
          <React.Fragment key={`${part}-${idx}`}>
            {idx > 0 ? " / " : null}
            <span
              className={
                idx === crumbParts.length - 1 ? classes.breadcrumbStrong : undefined
              }
            >
              {part}
            </span>
          </React.Fragment>
        ))}
      </Typography>
      <Button
        size="small"
        color="primary"
        component={Link}
        to="/tickets"
        startIcon={<ArrowBackIcon fontSize="small" />}
        data-testid="agentos-console-back-product"
      >
        {i18n.t("technicalConsole.shell.backToProduct")}
      </Button>
    </Box>
  );
}

/**
 * Shell interno do Console Técnico — sidebar desktop / drawer mobile.
 */
export default function AgentOsConsoleLayout({ children }) {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activePath = useMemo(() => {
    const item = getNavItemByPath(location.pathname);
    return item ? item.path : location.pathname;
  }, [location.pathname]);

  const companyName =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? `#${user.companyId}` : null);

  const closeMobile = () => setMobileOpen(false);

  const navHeader = (
    <Box className={classes.navHeader}>
      <Typography className={classes.navTitle} component="h1">
        {i18n.t("technicalConsole.shell.title")}
      </Typography>
      <Typography className={classes.navSubtitle} component="p">
        {i18n.t("technicalConsole.shell.internalBadge")}
      </Typography>
      {companyName && (
        <Typography className={classes.tenantLine} component="p">
          {i18n.t("technicalConsole.shell.activeCompany", {
            name: companyName,
          })}
        </Typography>
      )}
      {user?.supportMode === true && (
        <Typography
          className={classes.supportChip}
          component="p"
          data-testid="agentos-support-context"
        >
          {i18n.t("technicalConsole.shell.supportContext")}
        </Typography>
      )}
    </Box>
  );

  const navBody = (
    <>
      {navHeader}
      <Divider />
      <NavList onNavigate={closeMobile} activePath={activePath} />
      <Divider />
      <Box className={classes.footer}>
        <Button
          fullWidth
          variant="outlined"
          color="primary"
          size="small"
          component={Link}
          to="/tickets"
          onClick={closeMobile}
        >
          {i18n.t("technicalConsole.shell.backToProduct")}
        </Button>
      </Box>
    </>
  );

  return (
    <Box className={classes.root} data-testid="agentos-console-layout">
      {!isMobile && (
        <Paper className={classes.nav} elevation={0} square component="aside">
          {navBody}
        </Paper>
      )}
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: false }}
          classes={{ paper: classes.navMobilePaper }}
          data-testid="agentos-console-mobile-drawer"
        >
          {navBody}
        </Drawer>
      )}
      <Box className={classes.mainColumn}>
        <ShellChrome
          isMobile={isMobile}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <Box className={classes.main} component="main">
          {children}
        </Box>
      </Box>
    </Box>
  );
}
