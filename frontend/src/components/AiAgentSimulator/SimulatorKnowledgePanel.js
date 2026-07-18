import React, { useState } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
  },
  sourceItem: {
    marginTop: theme.spacing(0.5),
    paddingTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

function resolveStatusLabel(status) {
  if (!status) return "—";
  const key = `aiAgent.knowledge.status.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}

function resolveSkipReason(reason) {
  if (!reason) return "—";
  const key = `aiAgent.knowledge.skipReasons.${reason}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : reason;
}

export function extractMessageKnowledge(message) {
  return message?.knowledge || message?.metadata?.knowledge || null;
}

export default function SimulatorKnowledgePanel({ knowledge }) {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  if (!knowledge) return null;

  const sources = knowledge.sources || [];
  const metrics = knowledge.metrics || {};

  return (
    <Box className={classes.root}>
      <div
        className={classes.header}
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((prev) => !prev);
        }}
      >
        <Typography variant="caption" color="primary">
          {i18n.t("aiAgent.simulator.knowledge.title")}
          {knowledge.sourceCount != null
            ? ` (${knowledge.sourceCount})`
            : sources.length
              ? ` (${sources.length})`
              : ""}
        </Typography>
        <IconButton size="small" tabIndex={-1}>
          {open ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
      </div>
      <Collapse in={open}>
        <Typography variant="caption" display="block">
          {i18n.t("aiAgent.simulator.knowledge.status")}:{" "}
          {resolveStatusLabel(knowledge.status)}
        </Typography>
        {knowledge.skippedReason ? (
          <Typography variant="caption" display="block" color="textSecondary">
            {i18n.t("aiAgent.simulator.knowledge.skipReason")}:{" "}
            {resolveSkipReason(knowledge.skippedReason)}
          </Typography>
        ) : null}
        {knowledge.queryUsed ? (
          <Typography variant="caption" display="block" color="textSecondary">
            {i18n.t("aiAgent.simulator.knowledge.queryUsed")}: {knowledge.queryUsed}
          </Typography>
        ) : null}
        {knowledge.maxScore != null ? (
          <Typography variant="caption" display="block" color="textSecondary">
            {i18n.t("aiAgent.simulator.knowledge.maxScore")}:{" "}
            {Number(knowledge.maxScore).toFixed(3)}
          </Typography>
        ) : null}
        {knowledge.errorCode ? (
          <Typography variant="caption" display="block" color="error">
            {i18n.t("aiAgent.simulator.knowledge.error")}: {knowledge.errorCode}
          </Typography>
        ) : null}
        {metrics.durationMs != null ? (
          <Typography variant="caption" display="block" color="textSecondary">
            {i18n.t("aiAgent.simulator.knowledge.metrics")}:{" "}
            {metrics.returnedChunkCount ?? 0}{" "}
            {i18n.t("aiAgent.knowledge.test.chunks")}, {metrics.durationMs}ms
          </Typography>
        ) : null}
        {sources.length > 0 ? (
          <Box marginTop={0.5}>
            {sources.map((source) => (
              <Box
                key={`${source.documentId}-${source.chunkId}`}
                className={classes.sourceItem}
              >
                <Typography variant="caption" display="block">
                  {source.documentTitle || `#${source.documentId}`}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {source.knowledgeBaseName || source.knowledgeBaseId} ·{" "}
                  {Number(source.similarityScore).toFixed(3)}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}
      </Collapse>
    </Box>
  );
}
