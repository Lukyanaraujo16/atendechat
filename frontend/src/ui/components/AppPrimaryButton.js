import React from "react";
import Button from "@material-ui/core/Button";

/** Botão principal: contained + primary (ação mais importante na secção). */
const AppPrimaryButton = React.forwardRef(function AppPrimaryButton(
  { size = "medium", variant = "contained", color = "primary", ...rest },
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

export default AppPrimaryButton;
