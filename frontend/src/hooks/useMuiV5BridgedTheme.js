import { useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { createTheme } from "@mui/material/styles";

/**
 * Tema MUI v5 espelhado do ThemeProvider v4 da app, para @mui/material e
 * @mui/x-date-pickers herdarem cores corretas em dark/light mode.
 */
export default function useMuiV5BridgedTheme() {
  const t = useTheme();
  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: t.palette.type === "dark" ? "dark" : "light",
          primary: t.palette.primary,
          secondary: t.palette.secondary,
          error: t.palette.error,
          warning: t.palette.warning,
          info: t.palette.info,
          success: t.palette.success,
          background: t.palette.background,
          text: t.palette.text,
          divider: t.palette.divider,
          action: t.palette.action
        },
        shape: t.shape,
        shadows: t.shadows,
        typography: t.typography
      }),
    [t]
  );
}
