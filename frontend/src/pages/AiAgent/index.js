import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { makeStyles } from "@material-ui/core/styles";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import AiAgentModal from "../../components/AiAgentModal";
import { AppEmptyState } from "../../ui";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { listAiAgents, deleteAiAgent, listAiAgentShadowSuggestions } from "../../services/aiAgentApi";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  phaseAlert: {
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  shadowSection: {
    marginTop: theme.spacing(3),
  },
  shadowBadge: {
    marginLeft: theme.spacing(1),
  },
  actionIcon: {
    opacity: 0.55,
    "&:hover": {
      opacity: 1,
    },
  },
}));

const AiAgent = () => {
  const classes = useStyles();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [shadowRows, setShadowRows] = useState([]);
  const [shadowLoading, setShadowLoading] = useState(true);
  const [shadowPage, setShadowPage] = useState(1);
  const [shadowHasMore, setShadowHasMore] = useState(false);

  const fetchShadowSuggestions = useCallback(async (page = 1, append = false) => {
    setShadowLoading(true);
    try {
      const { data } = await listAiAgentShadowSuggestions({ pageNumber: page });
      const records = Array.isArray(data?.records) ? data.records : [];
      setShadowRows((prev) => (append ? [...prev, ...records] : records));
      setShadowHasMore(!!data?.hasMore);
      setShadowPage(page);
    } catch (err) {
      toastError(err);
    } finally {
      setShadowLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await listAiAgents();
      setAgents(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchShadowSuggestions(1, false);
  }, [fetchAgents, fetchShadowSuggestions]);

  const handleOpenNew = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleEdit = (id) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  const handleAskDelete = (id) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAiAgent(deletingId);
      toast.success(i18n.t("aiAgent.toasts.deleted"));
      setConfirmOpen(false);
      setDeletingId(null);
      await fetchAgents();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={i18n.t("aiAgent.confirmDelete.title")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      >
        {i18n.t("aiAgent.confirmDelete.message")}
      </ConfirmationModal>

      <AiAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agentId={selectedId}
        onSaved={fetchAgents}
      />

      <MainHeader>
        <Box>
          <Title>{i18n.t("aiAgent.title")}</Title>
          <Typography variant="body2" className={classes.subtitle}>
            {i18n.t("aiAgent.subtitle")}
          </Typography>
        </Box>
        <MainHeaderButtonsWrapper>
          <Button variant="contained" color="primary" onClick={handleOpenNew}>
            {i18n.t("aiAgent.buttons.new")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Alert severity="info" className={classes.phaseAlert}>
          {i18n.t("aiAgent.phaseWarning")}
        </Alert>
        <Alert severity="warning" className={classes.phaseAlert}>
          {i18n.t("aiAgent.dryRunWarning")}
        </Alert>

        {loading ? (
          <Table size="small">
            <TableBody>
              <TableRowSkeleton columns={6} />
            </TableBody>
          </Table>
        ) : loadError ? (
          <AppEmptyState title={i18n.t("aiAgent.empty.loadError")}>
            <Button color="primary" variant="outlined" onClick={fetchAgents}>
              {i18n.t("aiAgent.buttons.retry")}
            </Button>
          </AppEmptyState>
        ) : agents.length === 0 ? (
          <AppEmptyState
            title={i18n.t("aiAgent.empty.title")}
            description={i18n.t("aiAgent.empty.description")}
          >
            <Button color="primary" variant="contained" onClick={handleOpenNew}>
              {i18n.t("aiAgent.buttons.new")}
            </Button>
          </AppEmptyState>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("aiAgent.table.name")}</TableCell>
                <TableCell>{i18n.t("aiAgent.table.model")}</TableCell>
                <TableCell align="center">
                  {i18n.t("aiAgent.table.enabled")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("aiAgent.table.temperature")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("aiAgent.table.maxTokens")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("aiAgent.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <Typography variant="body2">{agent.name}</Typography>
                    {agent.description ? (
                      <Typography variant="caption" color="textSecondary">
                        {agent.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{agent.model}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={
                        agent.enabled
                          ? i18n.t("aiAgent.status.active")
                          : i18n.t("aiAgent.status.inactive")
                      }
                      color={agent.enabled ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">{agent.temperature}</TableCell>
                  <TableCell align="right">{agent.maxTokens}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={i18n.t("aiAgent.buttons.edit")}>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(agent.id)}
                        className={classes.actionIcon}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("aiAgent.buttons.delete")}>
                      <IconButton
                        size="small"
                        onClick={() => handleAskDelete(agent.id)}
                        className={classes.actionIcon}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Divider className={classes.shadowSection} />
        <Box className={classes.shadowSection}>
          <Typography variant="h6" gutterBottom>
            {i18n.t("aiAgent.shadowSection.title")}
          </Typography>
          <Alert severity="warning" className={classes.phaseAlert}>
            {i18n.t("aiAgent.shadowSection.warning")}
          </Alert>
          {shadowLoading && shadowRows.length === 0 ? (
            <Table size="small">
              <TableBody>
                <TableRowSkeleton columns={8} />
              </TableBody>
            </Table>
          ) : shadowRows.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("aiAgent.shadowSection.empty")}
            </Typography>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.date")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.agent")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.ticket")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.status")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.messageType")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.suggestion")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.model")}</TableCell>
                    <TableCell align="right">{i18n.t("aiAgent.shadowSection.table.tokens")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shadowRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>{row.aiAgentName || row.aiAgentId || "-"}</TableCell>
                      <TableCell>#{row.ticketId ?? "-"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.shadowStatus || "-"} />
                        {row.notSentToClient ? (
                          <Chip
                            size="small"
                            color="default"
                            className={classes.shadowBadge}
                            label={i18n.t("aiAgent.shadowSection.notSentBadge")}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>{row.messageType || "-"}</TableCell>
                      <TableCell style={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={row.suggestedReply || ""}>
                          {row.suggestedReply || row.errorCode || "-"}
                        </Typography>
                        {row.suggestionSource === "fallback" ? (
                          <Typography variant="caption" color="textSecondary">
                            (fallback)
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.model || "-"}</TableCell>
                      <TableCell align="right">{row.totalTokens ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {shadowHasMore ? (
                <Box marginTop={2}>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={shadowLoading}
                    onClick={() => fetchShadowSuggestions(shadowPage + 1, true)}
                  >
                    {i18n.t("aiAgent.shadowSection.loadMore")}
                  </Button>
                </Box>
              ) : null}
            </>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default AiAgent;
