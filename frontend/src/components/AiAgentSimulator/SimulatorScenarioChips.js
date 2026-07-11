import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    overflowX: "auto",
    paddingBottom: theme.spacing(0.5),
  },
  chip: {
    flexShrink: 0,
  },
}));

export default function SimulatorScenarioChips({ prompts, onSelect, disabled }) {
  const classes = useStyles();
  if (!prompts.length) return null;

  return (
    <Box>
      <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
        {i18n.t("aiAgent.simulator.scenarios.title")}
      </Typography>
      <div className={classes.root}>
        {prompts.map((item) => (
          <Chip
            key={item.key}
            className={classes.chip}
            size="small"
            variant="outlined"
            clickable={!disabled}
            disabled={disabled}
            label={i18n.t(item.labelKey)}
            onClick={() => onSelect(i18n.t(item.labelKey))}
          />
        ))}
      </div>
    </Box>
  );
}
