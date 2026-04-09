import React from "react";
import clsx from "clsx";
import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    color: theme.palette.error.main,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

/**
 * Ação destrutiva compacta (ex.: excluir em tabela).
 * Preferir IconButton; para texto usar Button color="secondary" + erro no tema.
 */
const AppDangerAction = React.forwardRef(function AppDangerAction(
  { size = "small", className, ...rest },
  ref
) {
  const classes = useStyles();
  return (
    <IconButton
      ref={ref}
      size={size}
      className={clsx(classes.root, className)}
      {...rest}
    />
  );
});

export default AppDangerAction;
