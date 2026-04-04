import React from "react";
import { Link, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  /** Área do módulo: respiro abaixo da AppBar e antes do conteúdo */
  moduleWrap: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    paddingTop: theme.spacing(2),
    paddingBottom: 0,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    [theme.breakpoints.up("md")]: {
      paddingLeft: theme.spacing(3),
      paddingRight: theme.spacing(3),
    },
  },
  /** Faixa de cabeçalho (reserva visual antes das tabs) */
  headerSpacer: {
    minHeight: theme.spacing(0.5),
    marginBottom: theme.spacing(1.5),
  },
  tabsPaper: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflow: "hidden",
    marginBottom: theme.spacing(2),
    boxShadow: "none",
  },
  tabs: {
    minHeight: 48,
    "& .MuiTabs-indicator": {
      height: 3,
      borderRadius: "3px 3px 0 0",
    },
    "& .MuiTab-root": {
      minHeight: 48,
      paddingTop: theme.spacing(1.25),
      paddingBottom: theme.spacing(1.25),
      textTransform: "none",
      fontWeight: 500,
      fontSize: "0.875rem",
      lineHeight: 1.3,
      letterSpacing: "0.01em",
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      fontWeight: 600,
    },
  },
  /** Conteúdo abaixo das abas — separado da barra de tabs */
  contentBelow: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(3),
    minHeight: 0,
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

  return (
    <Box className={classes.moduleWrap}>
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
      <Box className={classes.contentBelow}>{children}</Box>
    </Box>
  );
}
