import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  DeleteOutline,
  Edit,
  FileCopy,
  OpenInNew,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AppEmptyState } from "../../ui";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  duplicateKnowledgeBase,
  getKnowledgeBaseDashboard,
  listKnowledgeBases,
  updateKnowledgeBase,
} from "../../services/knowledgeBaseApi";
import { KNOWLEDGE_BASE_ROUTE_PATH } from "../../config/knowledgeBaseFeature";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  summaryCard: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    height: "100%",
  },
  filterBar: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(1),
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  actionIcon: {
    opacity: 0.55,
    "&:hover": { opacity: 1 },
  },
}));

function BaseFormDialog({ open, onClose, initial, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setEnabled(initial?.enabled !== false);
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(i18n.t("knowledgeBase.toasts.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        enabled,
      };
      if (initial?.id) {
        await updateKnowledgeBase(initial.id, payload);
        toast.success(i18n.t("knowledgeBase.toasts.baseUpdated"));
      } else {
        await createKnowledgeBase(payload);
        toast.success(i18n.t("knowledgeBase.toasts.baseCreated"));
      }
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial?.id
          ? i18n.t("knowledgeBase.modal.editBase")
          : i18n.t("knowledgeBase.modal.newBase")}
      </DialogTitle>
      <DialogContent>
        <TextField
          label={i18n.t("knowledgeBase.fields.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          margin="dense"
          variant="outlined"
          required
        />
        <TextField
          label={i18n.t("knowledgeBase.fields.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          margin="dense"
          variant="outlined"
          multiline
          rows={3}
        />
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              color="primary"
            />
          }
          label={i18n.t("knowledgeBase.fields.enabled")}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("knowledgeBase.buttons.cancel")}
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          {i18n.t("knowledgeBase.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const KnowledgeBase = () => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [bases, setBases] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, dashRes] = await Promise.all([
        listKnowledgeBases({ search: search.trim() || undefined }),
        getKnowledgeBaseDashboard(),
      ]);
      setBases(listRes.data?.bases || []);
      setDashboard(dashRes.data || null);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleDuplicate = async (base) => {
    try {
      await duplicateKnowledgeBase(base.id);
      toast.success(i18n.t("knowledgeBase.toasts.baseDuplicated"));
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    try {
      await deleteKnowledgeBase(confirmDelete.id);
      toast.success(i18n.t("knowledgeBase.toasts.baseDeleted"));
      setConfirmDelete(null);
      load();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggle = async (base) => {
    try {
      await updateKnowledgeBase(base.id, { enabled: !base.enabled });
      load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("knowledgeBase.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            {i18n.t("knowledgeBase.buttons.newBase")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {i18n.t("knowledgeBase.subtitle")}
        </Typography>

        {dashboard ? (
          <Grid container spacing={2} style={{ marginBottom: 16 }}>
            {[
              ["basesTotal", dashboard.basesTotal],
              ["documentsTotal", dashboard.documentsTotal],
              ["uploadsTotal", dashboard.uploadsTotal],
              ["websitesTotal", dashboard.websitesTotal],
              ["basesActive", dashboard.basesActive],
              ["basesInactive", dashboard.basesInactive],
              ["documentsProcessed", dashboard.documentsProcessed],
              ["documentsPending", dashboard.documentsPending],
              ["documentsProcessing", dashboard.documentsProcessing],
              ["documentsError", dashboard.documentsError],
            ].map(([key, value]) => (
              <Grid item xs={6} sm={4} md={2} key={key}>
                <Paper className={classes.summaryCard} variant="outlined">
                  <Typography variant="caption" color="textSecondary">
                    {i18n.t(`knowledgeBase.dashboard.${key}`)}
                  </Typography>
                  <Typography variant="h6">{value ?? 0}</Typography>
                </Paper>
              </Grid>
            ))}
            {dashboard.lastProcessingAt ? (
              <Grid item xs={12} sm={6} md={4}>
                <Paper className={classes.summaryCard} variant="outlined">
                  <Typography variant="caption" color="textSecondary">
                    {i18n.t("knowledgeBase.dashboard.lastProcessingAt")}
                  </Typography>
                  <Typography variant="body1">
                    {new Date(dashboard.lastProcessingAt).toLocaleString()}
                  </Typography>
                </Paper>
              </Grid>
            ) : null}
          </Grid>
        ) : null}

        <div className={classes.filterBar}>
          <TextField
            size="small"
            variant="outlined"
            placeholder={i18n.t("knowledgeBase.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>

        {loading ? (
          <TableRowSkeleton columns={5} />
        ) : bases.length === 0 ? (
          <AppEmptyState
            title={i18n.t("knowledgeBase.emptyTitle")}
            description={i18n.t("knowledgeBase.emptyDescription")}
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("knowledgeBase.fields.name")}</TableCell>
                <TableCell>{i18n.t("knowledgeBase.fields.status")}</TableCell>
                <TableCell align="right">
                  {i18n.t("knowledgeBase.fields.documents")}
                </TableCell>
                <TableCell>{i18n.t("knowledgeBase.fields.updatedAt")}</TableCell>
                <TableCell align="right">
                  {i18n.t("knowledgeBase.fields.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bases.map((base) => (
                <TableRow key={base.id} hover>
                  <TableCell>
                    <Typography variant="body2" style={{ fontWeight: 600 }}>
                      {base.name}
                    </Typography>
                    {base.description ? (
                      <Typography variant="caption" color="textSecondary">
                        {base.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={base.enabled ? "primary" : "default"}
                      label={
                        base.enabled
                          ? i18n.t("knowledgeBase.status.active")
                          : i18n.t("knowledgeBase.status.inactive")
                      }
                      onClick={() => handleToggle(base)}
                    />
                  </TableCell>
                  <TableCell align="right">{base.documentsCount ?? 0}</TableCell>
                  <TableCell>
                    {base.updatedAt
                      ? new Date(base.updatedAt).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={i18n.t("knowledgeBase.buttons.open")}>
                      <IconButton
                        size="small"
                        className={classes.actionIcon}
                        onClick={() =>
                          history.push(`${KNOWLEDGE_BASE_ROUTE_PATH}/${base.id}`)
                        }
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("knowledgeBase.buttons.edit")}>
                      <IconButton
                        size="small"
                        className={classes.actionIcon}
                        onClick={() => {
                          setEditing(base);
                          setFormOpen(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("knowledgeBase.buttons.duplicate")}>
                      <IconButton
                        size="small"
                        className={classes.actionIcon}
                        onClick={() => handleDuplicate(base)}
                      >
                        <FileCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("knowledgeBase.buttons.delete")}>
                      <IconButton
                        size="small"
                        className={classes.actionIcon}
                        onClick={() => setConfirmDelete(base)}
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
      </Paper>

      <BaseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSaved={load}
      />

      <ConfirmationModal
        title={i18n.t("knowledgeBase.confirmDeleteBaseTitle")}
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      >
        {i18n.t("knowledgeBase.confirmDeleteBaseMessage")}
      </ConfirmationModal>
    </MainContainer>
  );
};

export default KnowledgeBase;
