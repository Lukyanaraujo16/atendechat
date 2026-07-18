import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Box,
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import { resolveProviderLabel } from "../../config/aiProviderModels";
import {
  resolveCredentialSourceLabel,
  resolveShadowErrorLabel,
  resolveShadowStatusLabel,
} from "../../config/aiAgentShadowObservability";
import {
  extractShadowKnowledge,
  shadowKnowledgeSummary,
} from "../../utils/aiAgentKnowledgeObservability";

const DetailRow = ({ label, value }) => (
  <Grid item xs={12} sm={6}>
    <Typography variant="caption" color="textSecondary" display="block">
      {label}
    </Typography>
    <Typography variant="body2">{value ?? "-"}</Typography>
  </Grid>
);

function resolveKnowledgeStatus(status) {
  if (!status) return "-";
  const key = `aiAgent.knowledge.status.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}

function resolveKnowledgeSkipReason(reason) {
  if (!reason) return "-";
  const key = `aiAgent.knowledge.skipReasons.${reason}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : reason;
}

const AiAgentShadowDetailsModal = ({ open, onClose, row }) => {
  if (!row) return null;

  const shadowKnowledge = extractShadowKnowledge(row);
  const knowledgeInfo = shadowKnowledgeSummary(shadowKnowledge);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{i18n.t("aiAgent.shadowSection.details.title")}</DialogTitle>
      <DialogContent dividers>
        <Box mb={1}>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("aiAgent.shadowSection.warning")}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.status")}
            value={resolveShadowStatusLabel(row.shadowStatus)}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.error")}
            value={resolveShadowErrorLabel(row.errorCode)}
          />
          <DetailRow label={i18n.t("aiAgent.shadowSection.details.reason")} value={row.reason} />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.provider")}
            value={
              row.provider
                ? `${resolveProviderLabel(row.provider)}${row.model ? ` / ${row.model}` : ""}`
                : row.model || "-"
            }
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.details.credentialSource")}
            value={resolveCredentialSourceLabel(row.credentialSource)}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.details.suggestionSource")}
            value={row.suggestionSource || "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.tokens")}
            value={row.totalTokens ?? "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.latency")}
            value={row.latencyMs != null ? `${row.latencyMs} ms` : "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.details.contextMessages")}
            value={row.contextMessageCount ?? "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.messageType")}
            value={row.messageType || "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.details.evaluatorVersion")}
            value={row.evaluatorVersion || "-"}
          />
          <DetailRow
            label={i18n.t("aiAgent.shadowSection.table.date")}
            value={row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
          />
          {knowledgeInfo ? (
            <>
              <DetailRow
                label={i18n.t("aiAgent.knowledge.shadow.detailsTitle")}
                value={i18n.t("aiAgent.knowledge.shadow.used", {
                  count: knowledgeInfo.sourceCount ?? 0,
                  score:
                    knowledgeInfo.maxScore != null
                      ? Number(knowledgeInfo.maxScore).toFixed(3)
                      : "—",
                })}
              />
              <DetailRow
                label={i18n.t("aiAgent.knowledge.test.status")}
                value={resolveKnowledgeStatus(shadowKnowledge?.status)}
              />
              {shadowKnowledge?.queryUsed ? (
                <DetailRow
                  label={i18n.t("aiAgent.knowledge.test.queryUsed")}
                  value={shadowKnowledge.queryUsed}
                />
              ) : null}
              {shadowKnowledge?.skippedReason ? (
                <DetailRow
                  label={i18n.t("aiAgent.knowledge.test.skipReason")}
                  value={resolveKnowledgeSkipReason(shadowKnowledge.skippedReason)}
                />
              ) : null}
            </>
          ) : null}
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("aiAgent.shadowSection.table.suggestion")}
            </Typography>
            <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
              {row.suggestedReply || "-"}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("aiAgent.buttons.cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AiAgentShadowDetailsModal;
