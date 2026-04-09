import React from "react";
import clsx from "clsx";
import TableContainer from "@material-ui/core/TableContainer";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  /** Dentro de AppSectionCard: sem segunda caixa, só o scroll da tabela */
  nested: {
    border: "none",
    borderRadius: 0,
    backgroundColor: "transparent",
  },
}));

/**
 * Container de tabela com borda suave e cantos do tema.
 * @param {boolean} nested — quando true, sem borda extra (uso dentro de AppSectionCard).
 */
const AppTableContainer = ({ className, nested, ...rest }) => {
  const classes = useStyles();
  return (
    <TableContainer
      className={clsx(classes.root, nested && classes.nested, className)}
      {...rest}
    />
  );
};

export default AppTableContainer;
