import { alpha, darken } from "@material-ui/core/styles";

/** Cor primária da marca (alinhada ao login / identidade). */
export const BRAND_PRIMARY = "#24c776";

/**
 * Opções de tema (palette + overrides de componentes) por modo claro/escuro.
 * Botões: padrão SaaS — texto legível, sombras leves, hover consistente.
 */
export function getThemeOptions(mode) {
  const isLight = mode === "light";
  const primaryMain = BRAND_PRIMARY;
  const bgDefault = isLight ? "#fafafa" : "#121212";
  const bgPaper = isLight ? "#ffffff" : "#1e1e1e";
  const textOnSurface = isLight ? "rgba(0, 0, 0, 0.87)" : "#ffffff";
  const textSecondary = isLight ? "rgba(0, 0, 0, 0.54)" : "rgba(255, 255, 255, 0.7)";
  const borderNeutral = isLight ? "rgba(0, 0, 0, 0.23)" : "rgba(255, 255, 255, 0.23)";
  const dividerColor = isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)";
  /** Separadores de modal (título / corpo / ações). */
  const dialogDivider = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.12)";
  const errorMain = isLight ? "#d32f2f" : "#f44336";
  /** Transição curta para hover/active em componentes interativos (SaaS premium, sem exagero). */
  const interactionMs = 200;
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
  const transitionButton = `background-color ${interactionMs}ms ${ease}, color ${interactionMs}ms ${ease}, border-color ${interactionMs}ms ${ease}, box-shadow ${interactionMs}ms ${ease}`;
  const transitionSurface = `background-color ${interactionMs}ms ${ease}, box-shadow ${interactionMs}ms ${ease}`;
  const tableRowHoverBg = alpha(isLight ? "#000000" : "#ffffff", 0.06);

  return {
    typography: {
      fontFamily:
        "'Montserrat', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica', 'Arial', sans-serif",
      h1: { fontWeight: 600 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 500 },
    },
    shape: {
      borderRadius: 10,
    },
    scrollbarStyles: {
      "&::-webkit-scrollbar": {
        width: "8px",
        height: "8px",
      },
      "&::-webkit-scrollbar-thumb": {
        boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
        backgroundColor: BRAND_PRIMARY,
      },
    },
    scrollbarStylesSoft: {
      "&::-webkit-scrollbar": {
        width: "8px",
      },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: isLight ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.2)",
      },
    },
    palette: {
      type: mode,
      background: {
        default: bgDefault,
        paper: bgPaper,
      },
      divider: dividerColor,
      text: {
        primary: textOnSurface,
        secondary: textSecondary,
        disabled: isLight ? "rgba(0, 0, 0, 0.38)" : "rgba(255, 255, 255, 0.5)",
      },
      action: {
        active: isLight ? "rgba(0, 0, 0, 0.54)" : "rgba(255, 255, 255, 0.56)",
        hover: isLight ? "rgba(0, 0, 0, 0.04)" : "rgba(255, 255, 255, 0.08)",
        selected: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.16)",
        disabled: isLight ? "rgba(0, 0, 0, 0.26)" : "rgba(255, 255, 255, 0.3)",
        disabledBackground: isLight ? "rgba(0, 0, 0, 0.12)" : "rgba(255, 255, 255, 0.12)",
      },
      primary: {
        main: primaryMain,
        contrastText: "#ffffff",
      },
      error: {
        main: errorMain,
        contrastText: "#ffffff",
      },
      textPrimary: isLight ? BRAND_PRIMARY : "#FFFFFF",
      borderPrimary: isLight ? BRAND_PRIMARY : BRAND_PRIMARY,
      dark: { main: isLight ? "#333333" : "#F3F3F3" },
      light: { main: isLight ? "#F3F3F3" : "#333333" },
      tabHeaderBackground: isLight ? "#EEE" : "#2a2a2a",
      optionsBackground: isLight ? "#fafafa" : "#2a2a2a",
      options: isLight ? "#fafafa" : "#3a3a3a",
      fontecor: isLight ? "#128c7e" : "#fff",
      fancyBackground: bgDefault,
      bordabox: isLight ? "#eee" : dividerColor,
      newmessagebox: isLight ? "#eee" : "#2a2a2a",
      inputdigita: isLight ? "#fff" : "#2a2a2a",
      contactdrawer: isLight ? "#fff" : bgPaper,
      announcements: isLight ? "#ededed" : "#2a2a2a",
      login: isLight ? "#fff" : "#1C1C1C",
      announcementspopover: isLight ? "#fff" : bgPaper,
      chatlist: isLight ? "#eee" : "#2a2a2a",
      boxlist: isLight ? "#ededed" : "#2a2a2a",
      boxchatlist: isLight ? "#ededed" : "#2a2a2a",
      total: isLight ? "#fff" : bgDefault,
      messageIcons: isLight ? "grey" : "#F3F3F3",
      inputBackground: isLight ? "#FFFFFF" : "#2a2a2a",
      barraSuperior: isLight ? "#2c3145" : "#2c3145",
      boxticket: isLight ? "#EEE" : "#3a3a3a",
      campaigntab: isLight ? "#ededed" : "#2a2a2a",
      mediainput: isLight ? "#ededed" : "#1c1c1c",
    },
    overrides: {
      MuiCssBaseline: {
        "@global": {
          body: {
            backgroundColor: bgDefault,
          },
        },
      },
      MuiAppBar: {
        colorDefault: {
          backgroundColor: bgPaper,
          color: textOnSurface,
        },
      },
      MuiDrawer: {
        paper: {
          backgroundColor: bgPaper,
          backgroundImage: "none",
        },
      },
      MuiDialog: {
        paper: {
          borderRadius: 12,
        },
      },
      MuiDialogTitle: {
        root: {
          padding: "16px 24px",
        },
      },
      MuiDialogContent: {
        root: {
          padding: "20px 24px",
        },
      },
      MuiDialogActions: {
        root: {
          margin: 0,
          padding: "12px 24px",
          borderTop: `1px solid ${dialogDivider}`,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        },
      },
      MuiButton: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          borderRadius: 10,
          paddingLeft: 16,
          paddingRight: 16,
          boxShadow: "none",
          transition: transitionButton,
          "&:active": {
            transition: transitionButton,
          },
          "&:hover": {
            boxShadow: "none",
          },
        },
        contained: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
          "&:active": {
            boxShadow: "none",
          },
        },
        containedPrimary: {
          color: "#ffffff",
          backgroundColor: primaryMain,
          "&:hover": {
            backgroundColor: darken(primaryMain, 0.12),
            color: "#ffffff",
          },
        },
        outlinedPrimary: {
          color: primaryMain,
          border: `1px solid ${primaryMain}`,
          backgroundColor: "transparent",
          "&:hover": {
            backgroundColor: alpha(primaryMain, 0.08),
            color: primaryMain,
            border: `1px solid ${primaryMain}`,
          },
        },
        outlined: {
          borderColor: borderNeutral,
        },
        /** Neutro: outlined ou text com color="default" */
        colorDefault: {
          "&.MuiButton-outlined": {
            color: textOnSurface,
            border: `1px solid ${borderNeutral}`,
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: alpha(isLight ? "#000000" : "#ffffff", 0.06),
              border: `1px solid ${borderNeutral}`,
              color: textOnSurface,
            },
          },
          "&.MuiButton-text": {
            color: textOnSurface,
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: alpha(isLight ? "#000000" : "#ffffff", 0.06),
            },
          },
        },
        sizeSmall: {
          padding: "6px 12px",
        },
        containedSizeSmall: {
          padding: "6px 12px",
        },
      },
      MuiIconButton: {
        root: {
          transition: transitionSurface,
          '&[data-app-danger="true"]': {
            color: errorMain,
            "&:hover": {
              backgroundColor: alpha(errorMain, 0.08),
            },
          },
        },
      },
      MuiTab: {
        root: {
          transition: `color ${interactionMs}ms ${ease}, background-color ${interactionMs}ms ${ease}`,
        },
      },
      MuiFab: {
        root: {
          transition: `background-color ${interactionMs}ms ${ease}, box-shadow ${interactionMs}ms ${ease}, transform ${interactionMs}ms ${ease}`,
        },
      },
      MuiTableRow: {
        root: {
          transition: `background-color ${interactionMs}ms ${ease}`,
          /** Só linhas com prop `hover` — evita conflito com hovers customizados em outras linhas */
          "&.MuiTableRow-hover:hover": {
            backgroundColor: tableRowHoverBg,
          },
        },
      },
      MuiPaper: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 18,
          transition: `box-shadow ${interactionMs}ms ${ease}`,
        },
        elevation1: {
          boxShadow:
            mode === "light"
              ? "0 10px 30px rgba(15, 23, 42, 0.08)"
              : "0 10px 30px rgba(0,0,0,0.7)",
          transition: `box-shadow ${interactionMs}ms ${ease}`,
        },
      },
      MuiOutlinedInput: {
        root: {
          borderRadius: 10,
        },
      },
    },
    mode,
  };
}
