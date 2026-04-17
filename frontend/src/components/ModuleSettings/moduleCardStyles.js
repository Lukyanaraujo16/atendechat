import { makeStyles, alpha } from "@material-ui/core/styles";

/** Estilo partilhado: cartão de módulo (Planos + Empresas). */
export const useModuleCardStyles = makeStyles((theme) => ({
  moduleCard: {
    height: "100%",
    padding: theme.spacing(2, 2, 2, 2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : theme.palette.grey[50],
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 200,
    }),
    "&:hover": {
      borderColor: alpha(theme.palette.primary.main, 0.35),
      boxShadow:
        theme.palette.type === "light"
          ? "0 1px 8px rgba(15, 23, 42, 0.06)"
          : "none",
    },
  },
  moduleRowInner: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    width: "100%",
  },
  moduleRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: theme.spacing(0.5),
  },
  moduleTitle: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    lineHeight: 1.4,
    marginBottom: theme.spacing(0.35),
  },
  moduleOrigin: {
    fontSize: "0.7rem",
    lineHeight: 1.35,
    fontWeight: 500,
    letterSpacing: "0.02em",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
    textTransform: "none",
  },
  moduleDescription: {
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: theme.palette.text.secondary,
    opacity: 0.92,
  },
}));
