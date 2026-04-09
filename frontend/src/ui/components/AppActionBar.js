import React from "react";
import clsx from "clsx";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    minHeight: 0,
  },
  end: {
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  between: {
    justifyContent: "space-between",
  },
}));

/**
 * Barra genérica de ações (filtros, botões de página, etc.).
 * Não confundir com TicketConversationActionBar (ações do ticket).
 */
const AppActionBar = ({
  children,
  className,
  align = "start",
}) => {
  const classes = useStyles();
  return (
    <Box
      className={clsx(
        classes.root,
        align === "end" && classes.end,
        align === "between" && classes.between,
        className
      )}
      component="div"
      data-app-action-bar
    >
      {children}
    </Box>
  );
};

export default AppActionBar;
