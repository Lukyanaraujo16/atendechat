import React from "react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { i18n } from "../../../translate/i18n";

export default function ActiveAgentIdentitySuccess({
  formState,
  summary,
  onBackToHub,
}) {
  return (
    <Box
      textAlign="center"
      py={3}
      data-testid="active-agent-identity-success"
    >
      <CheckCircleOutlineIcon
        color="primary"
        style={{ fontSize: 56, marginBottom: 16 }}
      />
      <Typography variant="h5" gutterBottom>
        {i18n.t("aiAgent.wizard.activeIdentity.successTitle")}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {i18n.t("aiAgent.wizard.activeIdentity.successDescription")}
      </Typography>

      <Box my={2} textAlign="left">
        <Typography variant="body2">
          <strong>{i18n.t("aiAgent.wizard.activeIdentity.name")}:</strong>{" "}
          {formState.identityName}
        </Typography>
        {formState.identityDescription ? (
          <Typography variant="body2">
            <strong>
              {i18n.t("aiAgent.wizard.activeIdentity.description")}:
            </strong>{" "}
            {formState.identityDescription}
          </Typography>
        ) : null}
      </Box>

      <Alert severity="success" style={{ textAlign: "left", marginBottom: 16 }}>
        {i18n.t("aiAgent.wizard.activeIdentity.stillActive", {
          status: summary?.status || "active",
        })}
      </Alert>

      <Button variant="contained" color="primary" onClick={onBackToHub}>
        {i18n.t("aiAgent.wizard.buttons.backToList")}
      </Button>
    </Box>
  );
}
