import React from "react";
import { Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../ui";

export default function CompanyPlanChangeDialog({
  open,
  onClose,
  onKeepModules,
  onApplyPlanModules,
}) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="company-plan-change-dialog"
    >
      <AppDialogTitle id="company-plan-change-dialog">
        {i18n.t("platform.moduleSettings.planChange.title")}
      </AppDialogTitle>
      <AppDialogContent dividers>
        <Typography variant="body2" component="p">
          {i18n.t("platform.moduleSettings.planChange.message")}
        </Typography>
      </AppDialogContent>
      <AppDialogActions>
        <AppNeutralButton type="button" onClick={onKeepModules}>
          {i18n.t("platform.moduleSettings.planChange.keepModules")}
        </AppNeutralButton>
        <AppPrimaryButton type="button" onClick={onApplyPlanModules}>
          {i18n.t("platform.moduleSettings.planChange.applyPlanModules")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
