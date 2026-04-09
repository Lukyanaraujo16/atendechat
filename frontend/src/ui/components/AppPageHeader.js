import React from "react";
import clsx from "clsx";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  titleBlock: {
    flex: "1 1 200px",
    minWidth: 0,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
    flex: "0 1 auto",
  },
}));

/**
 * Cabeçalho de página padrão: título + área de ações alinhada.
 * Uso progressivo: pode envolver Title + MainHeaderButtonsWrapper ou slots equivalentes.
 */
const AppPageHeader = ({ title, subtitle, actions, children, className }) => {
  const classes = useStyles();
  return (
    <Box className={clsx(classes.root, className)} component="header">
      {(title || subtitle) && (
        <Box className={classes.titleBlock}>
          {title}
          {subtitle}
        </Box>
      )}
      {actions && <Box className={classes.actions}>{actions}</Box>}
      {children}
    </Box>
  );
};

export default AppPageHeader;
