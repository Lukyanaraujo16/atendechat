import React from "react";
import Button from "@material-ui/core/Button";

/** Botão secundário: outlined + primary. */
const AppSecondaryButton = React.forwardRef(function AppSecondaryButton(
  { size = "medium", variant = "outlined", color = "primary", ...rest },
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

export default AppSecondaryButton;
