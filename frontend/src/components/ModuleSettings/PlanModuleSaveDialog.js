import React from "react";
import { Box, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import { getFeatureLabel } from "../../config/features";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../ui";
function moduleLabel(key) {
  if (key && String(key).includes(".")) {
    return getFeatureLabel(key);
  }
  if (key === "useInternalChat") {
    return i18n.t("plans.form.internalChat");
  }
  const k = `settings.company.form.modules.${key}`;
  const t = i18n.t(k);
  return t !== k ? t : key;
}

export default function PlanModuleSaveDialog({
  open,
  onClose,
  diff,
  loading,
  onChoose,
}) {
  return (
    <AppDialog
      open={open}
      onClose={() => !loading && onClose()}
      maxWidth="sm"
      fullWidth
      aria-labelledby="plan-module-save-dialog"
    >
      <AppDialogTitle id="plan-module-save-dialog">
        {i18n.t("platform.plans.moduleSave.title")}
      </AppDialogTitle>
      <AppDialogContent dividers>
        <Typography variant="body2" component="p" paragraph>
          {i18n.t("platform.plans.moduleSave.summaryIntro")}
        </Typography>
        <Box component="ul" style={{ margin: 0, paddingLeft: 20 }}>
          {diff.map((row) => (
            <li key={row.key}>
              <Typography variant="body2" component="span">
                {row.after
                  ? i18n.t("platform.plans.moduleSave.lineOn", {
                      module: moduleLabel(row.key),
                    })
                  : i18n.t("platform.plans.moduleSave.lineOff", {
                      module: moduleLabel(row.key),
                    })}
              </Typography>
            </li>
          ))}
        </Box>
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 16 }}>
          {i18n.t("platform.plans.moduleSave.choosePropagation")}
        </Typography>
      </AppDialogContent>
      <AppDialogActions
        style={{
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "flex-end",
          padding: 16,
        }}
      >
        <AppNeutralButton disabled={loading} onClick={() => onChoose("none")}>
          {i18n.t("platform.plans.moduleSave.applyNone")}
        </AppNeutralButton>
        <AppNeutralButton
          disabled={loading}
          onClick={() => onChoose("respectOverride")}
        >
          {i18n.t("platform.plans.moduleSave.applyNoOverride")}
        </AppNeutralButton>
        <AppPrimaryButton
          disabled={loading}
          onClick={() => onChoose("forceAll")}
        >
          {i18n.t("platform.plans.moduleSave.applyAll")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
