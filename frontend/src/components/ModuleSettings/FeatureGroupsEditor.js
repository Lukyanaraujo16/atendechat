import React, { useMemo } from "react";
import { Box, LinearProgress, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { getAllFeatureKeys } from "../../config/features";
import PlanFeaturesTree from "../PlansManager/PlanFeaturesTree";
import { getCompanyEffectiveFeatureMap } from "./moduleSync";

const useStyles = makeStyles((theme) => ({
  featuresHero: {
    marginBottom: theme.spacing(2),
  },
  featuresTitle: {
    fontWeight: 700,
    fontSize: "1.125rem",
    letterSpacing: "-0.02em",
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.75),
  },
  featuresHint: {
    lineHeight: 1.55,
    maxWidth: 720,
    fontSize: "0.875rem",
  },
  featuresProgressLabel: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75),
  },
  featuresProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.success.main, 0.15),
    "& .MuiLinearProgress-bar": {
      borderRadius: 3,
      backgroundColor: theme.palette.success.main,
    },
  },
}));

/**
 * Editor partilhado de grupos de features (planos e overrides da empresa).
 * mode="plan" — edita planFeatures; mode="company" — edita modulePermissions.
 */
export default function FeatureGroupsEditor({
  mode = "plan",
  title,
  hint,
  value,
  onChange,
  plan,
  modulePermissions,
  onModulePermissionsChange,
}) {
  const classes = useStyles();
  const allKeys = getAllFeatureKeys();

  const displayMap = useMemo(() => {
    if (mode === "company") {
      return getCompanyEffectiveFeatureMap(plan, modulePermissions);
    }
    return value && typeof value === "object" ? value : {};
  }, [mode, plan, modulePermissions, value]);

  const totalFeat = allKeys.length;
  const activeFeat = allKeys.filter((k) => displayMap[k] === true).length;
  const featPct = totalFeat ? Math.round((activeFeat / totalFeat) * 100) : 0;

  return (
    <Box>
      <Box className={classes.featuresHero}>
        <Typography component="h3" className={classes.featuresTitle}>
          {title}
        </Typography>
        {hint ? (
          <Typography variant="body2" color="textSecondary" className={classes.featuresHint}>
            {hint}
          </Typography>
        ) : null}
        <Typography className={classes.featuresProgressLabel} style={{ marginTop: 16 }}>
          {i18n.t("plans.form.featuresProgressSummary", {
            active: activeFeat,
            total: totalFeat,
          })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={featPct}
          className={classes.featuresProgressTrack}
          color="primary"
        />
      </Box>
      <PlanFeaturesTree
        mode={mode}
        value={mode === "plan" ? value : displayMap}
        onChange={onChange}
        plan={plan}
        modulePermissions={modulePermissions}
        onModulePermissionsChange={onModulePermissionsChange}
      />
    </Box>
  );
}
