import React from "react";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    fontWeight: 600,
  },
}));

const TONE_COLOR = {
  off: "default",
  shadow: "primary",
  live: "secondary",
  paused: "default",
};

export default function AiAgentModeBadge({ modeMeta }) {
  const classes = useStyles();
  if (!modeMeta) return null;
  const mode = modeMeta.mode || "off";
  return (
    <Chip
      className={classes.root}
      size="small"
      color={TONE_COLOR[mode] || "default"}
      label={i18n.t(modeMeta.labelKey)}
      aria-label={i18n.t("aiAgentProduct.mode.aria", {
        mode: i18n.t(modeMeta.labelKey),
      })}
    />
  );
}
