import { makeStyles } from "@material-ui/core/styles";

/**
 * Estilo unificado para abas de listagem (Atendimentos, etc.).
 * Indicador fino, cor primary, texto sem uppercase forçado pelo tema global.
 */
const useAppTabsStyles = makeStyles((theme) => ({
  root: {
    minHeight: 48,
    "& .MuiTab-root": {
      textTransform: "none",
      fontWeight: 500,
      minHeight: 48,
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },
  },
  indicator: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.palette.primary.main,
  },
}));

export default useAppTabsStyles;
