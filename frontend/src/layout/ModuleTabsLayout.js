import React from "react";
import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  /** Área do módulo: respiro moderado; conteúdo com mais peso visual que a barra de tabs */
  moduleWrap: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    paddingTop: theme.spacing(1),
    paddingBottom: 0,
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    [theme.breakpoints.up("md")]: {
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },
  },
  headerSpacer: {
    minHeight: 0,
    marginBottom: theme.spacing(1),
  },
  tabsPaper: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflow: "hidden",
    marginBottom: theme.spacing(1.25),
    boxShadow: "none",
  },
  tabs: {
    minHeight: 38,
    "& .MuiTabs-indicator": {
      height: 2,
      borderRadius: "2px 2px 0 0",
    },
    "& .MuiTab-root": {
      minHeight: 38,
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
      paddingLeft: theme.spacing(1.25),
      paddingRight: theme.spacing(1.25),
      textTransform: "none",
      fontWeight: 500,
      fontSize: "0.8125rem",
      lineHeight: 1.25,
      letterSpacing: "0.01em",
      color: theme.palette.text.secondary,
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      fontWeight: 600,
      color: theme.palette.primary.main,
    },
  },
  contentBelow: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(2),
    minHeight: 0,
  },
  /** Rota /tickets: preenche altura útil e confina scroll nos painéis internos */
  moduleWrapTicketsFill: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    height: "100%",
  },
  contentBelowTicketsFill: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    paddingTop: theme.spacing(1),
    paddingBottom: 0,
  },
}));

/**
 * Abas de módulo: navegação por rota (URLs inalteradas).
 * Layout: [respiro] → [tabs em Paper] → [conteúdo com padding próprio]
 */
export default function ModuleTabsLayout({ tabs, children }) {
  const location = useLocation();
  const classes = useStyles();
  const pathname = location.pathname;

  let activeIndex = 0;
  let bestLen = -1;
  tabs.forEach((tab, i) => {
    const p = tab.path;
    const match =
      p === "/"
        ? pathname === "/" || pathname === ""
        : pathname === p || pathname.startsWith(`${p}/`);
    if (match) {
      const len = p.length;
      if (len > bestLen) {
        bestLen = len;
        activeIndex = i;
      }
    }
  });

  if (tabs.length === 0) {
    return <>{children}</>;
  }

  const isTicketsRoute =
    pathname === "/tickets" || pathname.startsWith("/tickets/");

  return (
    <Box
      className={clsx(
        classes.moduleWrap,
        isTicketsRoute && classes.moduleWrapTicketsFill
      )}
    >
      <Box className={classes.headerSpacer} aria-hidden />
      <Paper className={classes.tabsPaper} elevation={0} square={false}>
        <Tabs
          value={activeIndex}
          aria-label="module-tabs"
          className={classes.tabs}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.path} label={tab.label} component={Link} to={tab.path} />
          ))}
        </Tabs>
      </Paper>
      <Box
        className={clsx(
          classes.contentBelow,
          isTicketsRoute && classes.contentBelowTicketsFill
        )}
      >
        {children}
      </Box>
    </Box>
  );
}
