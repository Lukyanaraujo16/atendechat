import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import RefreshIcon from "@material-ui/icons/Refresh";
import EditIcon from "@material-ui/icons/Edit";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  titleWrap: {
    minWidth: 0,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
}));

export default function SimulatorHeader({
  agentName,
  provider,
  model,
  onBack,
  onRestart,
  onEdit,
}) {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <Box className={classes.titleWrap}>
        <Typography variant="h5" noWrap>
          {agentName}
        </Typography>
        <Box display="flex" flexWrap="wrap" gridGap={8} mt={0.5}>
          <Chip
            size="small"
            color="secondary"
            label={i18n.t("aiAgent.simulator.badge")}
          />
          {provider ? (
            <Chip size="small" variant="outlined" label={`${provider} · ${model || "—"}`} />
          ) : null}
        </Box>
      </Box>
      <Box className={classes.actions}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={onBack}>
          {i18n.t("aiAgent.simulator.buttons.back")}
        </Button>
        <Button size="small" startIcon={<RefreshIcon />} onClick={onRestart}>
          {i18n.t("aiAgent.simulator.buttons.restart")}
        </Button>
        <Button size="small" startIcon={<EditIcon />} onClick={onEdit}>
          {i18n.t("aiAgent.simulator.buttons.editAgent")}
        </Button>
      </Box>
    </Box>
  );
}
