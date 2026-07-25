import { makeStyles } from "@material-ui/core/styles";

/**
 * Classes compartilhadas do Console (tabelas / JSON) — Fase 1.6.
 */
export const useAgentOsConsoleContentStyles = makeStyles((theme) => ({
  tableScroll: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    marginBottom: theme.spacing(1),
  },
  jsonScroll: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: 320,
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre",
    wordBreak: "normal",
    margin: 0,
    padding: theme.spacing(1),
    boxSizing: "border-box",
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
}));
