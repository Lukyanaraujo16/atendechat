import React from "react";
import { Box, Chip, Tooltip, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { summarizePlanFeatures } from "./planFeatureUiUtils";

const useStyles = makeStyles((theme) => ({
  countLine: {
    fontWeight: 500,
    fontSize: "0.8125rem",
    color: theme.palette.text.primary,
    marginBottom: 6,
  },
  chipRow: {
    gap: 6,
    marginTop: 2,
  },
  outlineChip: {
    height: 22,
    fontSize: "0.7rem",
    fontWeight: 500,
    borderColor: alpha(theme.palette.text.secondary, theme.palette.type === "dark" ? 0.45 : 0.35),
    color: theme.palette.text.primary,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.default, 0.45)
        : alpha(theme.palette.common.white, 0.85),
    "&:focus": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.background.default, 0.55)
          : alpha(theme.palette.common.white, 0.95),
    },
  },
  moreChip: {
    height: 22,
    fontSize: "0.7rem",
    fontWeight: 600,
    borderColor: alpha(theme.palette.text.secondary, 0.4),
    color: theme.palette.text.secondary,
    backgroundColor: "transparent",
  },
  tooltipList: {
    maxWidth: 280,
    fontSize: "0.75rem",
    lineHeight: 1.45,
  },
}));

const DEFAULT_MAX = 4;

/**
 * Resumo compacto para célula da tabela: contagem + até N chips + tooltip com o restante.
 */
export default function PlanFeatureSummaryChips({ planFeatures, maxChips = DEFAULT_MAX }) {
  const classes = useStyles();
  const { count, groups } = summarizePlanFeatures(planFeatures);

  if (!count) {
    return (
      <Typography variant="body2" color="textSecondary">
        {i18n.t("plans.table.featureSummaryEmpty")}
      </Typography>
    );
  }

  const visible = groups.slice(0, maxChips);
  const restCount = Math.max(0, groups.length - visible.length);
  const hiddenLabels = groups.slice(maxChips).map((g) => i18n.t(`plans.featureGroups.${g}`));
  const tooltipText =
    hiddenLabels.length > 0
      ? `${i18n.t("plans.table.featureTooltipIntro")}\n${hiddenLabels.join(" · ")}`
      : groups.map((g) => i18n.t(`plans.featureGroups.${g}`)).join(" · ");

  return (
    <Box>
      <Typography className={classes.countLine} component="div">
        {i18n.t("plans.table.activeFeaturesCount", { count })}
      </Typography>
      <Box display="flex" flexWrap="wrap" alignItems="center" className={classes.chipRow}>
        {visible.map((g) => (
          <Chip
            key={g}
            size="small"
            variant="outlined"
            className={classes.outlineChip}
            label={i18n.t(`plans.featureGroups.${g}`)}
          />
        ))}
        {restCount > 0 ? (
          <Tooltip
            title={<span className={classes.tooltipList}>{tooltipText}</span>}
            arrow
            enterDelay={400}
          >
            <Chip
              size="small"
              variant="outlined"
              className={classes.moreChip}
              label={i18n.t("plans.table.moreFeatureGroups", { count: restCount })}
            />
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}
