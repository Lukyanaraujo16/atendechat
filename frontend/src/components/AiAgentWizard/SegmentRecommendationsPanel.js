import React, { useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Collapse from "@material-ui/core/Collapse";
import Alert from "@material-ui/lab/Alert";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ConfirmationModal from "../ConfirmationModal";
import { getSegmentTemplate } from "../../config/aiAgentSegmentTemplates";
import {
  applySegmentRecommendations,
  buildBusinessInfoChecklist,
  buildQualificationHints,
  previewApplySegmentRecommendations,
} from "./aiAgentWizardSegmentHelpers";
import { i18n } from "../../translate/i18n";
import { AI_AGENT_BUSINESS_SEGMENTS } from "../../config/aiAgentProfileOptions";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(144, 202, 249, 0.06)"
        : "rgba(25, 118, 210, 0.03)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
    cursor: "pointer",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  list: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
}));

export default function SegmentRecommendationsPanel({
  segment,
  formState,
  onApply,
  segmentChanged = false,
  onDismissSegmentChange,
  showChecklist = false,
}) {
  const classes = useStyles();
  const [open, setOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const template = useMemo(() => getSegmentTemplate(segment), [segment]);
  const segmentLabel =
    AI_AGENT_BUSINESS_SEGMENTS.find((item) => item.value === segment)?.label ||
    (segment === "other" && formState.customBusinessSegment) ||
    i18n.t("aiAgent.segmentTemplates.other.title");

  const preview = useMemo(
    () => previewApplySegmentRecommendations(formState, segment),
    [formState, segment]
  );

  const qualificationHints = useMemo(
    () => buildQualificationHints(segment),
    [segment]
  );

  const checklist = useMemo(
    () => (showChecklist ? buildBusinessInfoChecklist(formState, segment) : []),
    [formState, segment, showChecklist]
  );

  if (!segment) return null;

  const totalAdds =
    preview.departments +
    preview.allowedActions +
    preview.forbiddenActions +
    preview.handoffRules +
    (preview.attendantRole ? 1 : 0);

  const handleConfirmApply = () => {
    onApply(applySegmentRecommendations(formState, segment));
    setConfirmOpen(false);
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("aiAgent.wizard.segment.applyConfirmTitle")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmApply}
      >
        {i18n.t("aiAgent.wizard.segment.applyConfirmMessage", {
          departments: preview.departments,
          actions: preview.allowedActions,
          handoffs: preview.handoffRules,
        })}
      </ConfirmationModal>

      <Paper className={classes.root} variant="outlined">
        {segmentChanged ? (
          <Alert
            severity="info"
            style={{ marginBottom: 12 }}
            onClose={onDismissSegmentChange}
          >
            {i18n.t("aiAgent.wizard.segment.changedWarning")}
          </Alert>
        ) : null}

        <div className={classes.header} onClick={() => setOpen((v) => !v)}>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("aiAgent.wizard.segment.panelTitle", { segment: segmentLabel })}
          </Typography>
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </div>

        <Typography variant="body2" color="textSecondary">
          {i18n.t("aiAgent.wizard.segment.panelHint")}
        </Typography>

        {segment === "other" ? (
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
            {i18n.t("aiAgent.wizard.segment.otherCustomHint")}
          </Typography>
        ) : null}

        <Collapse in={open}>
          <div className={classes.chips}>
            {preview.departments > 0 ? (
              <Chip
                size="small"
                label={i18n.t("aiAgent.wizard.segment.chipDepartments", {
                  count: preview.departments,
                })}
              />
            ) : null}
            {preview.allowedActions > 0 ? (
              <Chip
                size="small"
                label={i18n.t("aiAgent.wizard.segment.chipActions", {
                  count: preview.allowedActions,
                })}
              />
            ) : null}
            {preview.handoffRules > 0 ? (
              <Chip
                size="small"
                label={i18n.t("aiAgent.wizard.segment.chipHandoffs", {
                  count: preview.handoffRules,
                })}
              />
            ) : null}
            {qualificationHints.length > 0 ? (
              <Chip
                size="small"
                label={i18n.t("aiAgent.wizard.segment.chipQuestions", {
                  count: qualificationHints.length,
                })}
              />
            ) : null}
          </div>

          {qualificationHints.length > 0 ? (
            <>
              <Typography variant="body2" style={{ fontWeight: 600 }}>
                {i18n.t("aiAgent.wizard.segment.qualificationTitle")}
              </Typography>
              <ul className={classes.list}>
                {qualificationHints.map((item) => (
                  <li key={item.key}>{i18n.t(item.labelKey)}</li>
                ))}
              </ul>
            </>
          ) : null}

          {showChecklist && checklist.length > 0 ? (
            <>
              <Typography variant="body2" style={{ fontWeight: 600, marginTop: 8 }}>
                {i18n.t("aiAgent.wizard.segment.checklistTitle")}
              </Typography>
              <Box mt={1}>
                {checklist.map((item) => (
                  <Chip
                    key={item.key}
                    size="small"
                    style={{ margin: 4 }}
                    color={item.informed ? "primary" : "default"}
                    label={`${i18n.t(item.labelKey)} — ${
                      item.informed
                        ? i18n.t("aiAgent.wizard.segment.checklistDone")
                        : i18n.t("aiAgent.wizard.segment.checklistPending")
                    }`}
                  />
                ))}
              </Box>
            </>
          ) : null}

          <Button
            variant="outlined"
            color="primary"
            size="small"
            disabled={totalAdds === 0}
            onClick={() => setConfirmOpen(true)}
            style={{ marginTop: 12 }}
          >
            {i18n.t("aiAgent.wizard.segment.applyButton")}
          </Button>
        </Collapse>
      </Paper>
    </>
  );
}
