import React from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import SelectableOptionCard from "../AiAgentWizard/SelectableOptionCard";
import { i18n } from "../../translate/i18n";

export default function AiAgentCreateChoiceModal({
  open,
  onClose,
  onChooseGuided,
  onChooseAdvanced,
  showLegacyConvert = false,
  onChooseLegacyConvert,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{i18n.t("aiAgent.wizard.choice.title")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("aiAgent.wizard.choice.description")}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <SelectableOptionCard
              title={i18n.t("aiAgent.wizard.choice.guidedTitle")}
              description={i18n.t("aiAgent.wizard.choice.guidedDescription")}
              onClick={onChooseGuided}
            />
          </Grid>
          <Grid item xs={12}>
            <SelectableOptionCard
              title={i18n.t("aiAgent.wizard.choice.advancedTitle")}
              description={i18n.t("aiAgent.wizard.choice.advancedDescription")}
              onClick={onChooseAdvanced}
            />
          </Grid>
          {showLegacyConvert ? (
            <Grid item xs={12}>
              <SelectableOptionCard
                title={i18n.t("aiAgent.wizard.choice.convertTitle")}
                description={i18n.t("aiAgent.wizard.choice.convertDescription")}
                onClick={onChooseLegacyConvert}
              />
            </Grid>
          ) : null}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("aiAgent.buttons.cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
}
