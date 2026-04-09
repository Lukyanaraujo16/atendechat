import React from "react";
import Button from "@material-ui/core/Button";

/** Botão neutro: outlined, cor default (ações auxiliares). */
const AppNeutralButton = React.forwardRef(function AppNeutralButton(
  { size = "medium", variant = "outlined", color = "default", ...rest },
  ref
) {
  return (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      color={color}
      {...rest}
    />
  );
});

export default AppNeutralButton;
