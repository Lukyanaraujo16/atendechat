import React, { useCallback, useEffect, useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import Paper from "@material-ui/core/Paper";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import DragIndicatorIcon from "@material-ui/icons/DragIndicator";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { getErrorToastOptions } from "../../errors/feedbackToasts";

const useStyles = makeStyles((theme) => ({
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
  },
  dragHandle: {
    marginTop: theme.spacing(1.5),
    cursor: "grab",
    color: theme.palette.text.secondary,
  },
  fields: {
    flex: 1,
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    minWidth: 0,
  },
}));

function pipelineRowsFromServer(stages) {
  return (stages || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => ({
      id: s.id,
      name: String(s.name || ""),
      color: String(s.color || "#90caf9"),
      kind: s.isWon ? "won" : s.isLost ? "lost" : "normal",
      tempId: null,
    }));
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {object | null} props.pipeline — pipeline com `stages` (como em listPipelines)
 * @param {function} props.onSaved — chamado após gravar com sucesso
 */
export default function CrmPipelineEditDialog({ open, onClose, pipeline, onSaved }) {
  const classes = useStyles();
  const [draft, setDraft] = useState([]);
  const [initialRows, setInitialRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && pipeline) {
      const rows = pipelineRowsFromServer(pipeline.stages);
      setInitialRows(rows.map((r) => ({ ...r })));
      setDraft(rows.map((r) => ({ ...r })));
    }
  }, [open, pipeline]);

  const handleAdd = useCallback(() => {
    setDraft((d) => [
      ...d,
      {
        tempId: `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: "",
        color: "#90caf9",
        kind: "normal",
      },
    ]);
  }, []);

  const handleRemove = useCallback((index) => {
    setDraft((d) => d.filter((_, i) => i !== index));
  }, []);

  const onDragEnd = useCallback((result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    setDraft((prev) => {
      const next = [...prev];
      const [removed] = next.splice(source.index, 1);
      next.splice(destination.index, 0, removed);
      return next;
    });
  }, []);

  const updateRow = useCallback((index, patch) => {
    setDraft((d) => {
      const next = [...d];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!pipeline?.id) return;

    const wonN = draft.filter((r) => r.kind === "won").length;
    const lostN = draft.filter((r) => r.kind === "lost").length;
    if (wonN > 1 || lostN > 1) {
      toast.error(i18n.t("crm.pipelineEdit.duplicateWonLost"), getErrorToastOptions());
      return;
    }

    for (const row of draft) {
      if (!String(row.name || "").trim()) {
        toast.error(i18n.t("crm.pipelineEdit.nameRequired"), getErrorToastOptions());
        return;
      }
    }

    const initialIds = new Set(initialRows.map((r) => r.id).filter(Boolean));
    const currentNumericIds = new Set(
      draft.map((r) => r.id).filter((id) => id != null && Number.isFinite(id))
    );

    setSaving(true);
    try {
      const working = draft.map((r) => ({ ...r }));

      for (const row of working) {
        if (row.tempId) {
          const { data } = await api.post(`/crm/pipelines/${pipeline.id}/stages`, {
            name: String(row.name).trim(),
            color: row.color,
            kind: row.kind,
          });
          row.id = data.id;
          delete row.tempId;
        }
      }

      const initialById = new Map(initialRows.map((r) => [r.id, r]));
      for (const row of working) {
        if (!row.id) continue;
        const orig = initialById.get(row.id);
        if (!orig) continue;
        if (
          orig.name !== row.name ||
          orig.color !== row.color ||
          orig.kind !== row.kind
        ) {
          await api.put(`/crm/stages/${row.id}`, {
            name: String(row.name).trim(),
            color: row.color,
            kind: row.kind,
          });
        }
      }

      for (const id of initialIds) {
        if (!currentNumericIds.has(id)) {
          await api.delete(`/crm/stages/${id}`);
        }
      }

      await api.put("/crm/stages/reorder", {
        pipelineId: pipeline.id,
        stageIds: working.map((r) => r.id),
      });

      toast.success(i18n.t("crm.pipelineEdit.saveSuccess"), getErrorToastOptions());
      if (onSaved) await onSaved();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }, [draft, initialRows, pipeline, onClose, onSaved]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{i18n.t("crm.pipelineEdit.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="textSecondary" display="block" paragraph>
          {i18n.t("crm.pipelineEdit.reorderHint")}
        </Typography>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="crm-pipeline-stages-edit">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {draft.map((row, index) => {
                  const dndId = row.tempId ? String(row.tempId) : `id-${row.id}`;
                  return (
                  <Draggable key={dndId} draggableId={dndId} index={index}>
                    {(dragProvided, snapshot) => (
                      <Paper
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={classes.row}
                        elevation={snapshot.isDragging ? 4 : 0}
                      >
                        <Box {...dragProvided.dragHandleProps} className={classes.dragHandle}>
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                        <Box className={classes.fields}>
                          <TextField
                            size="small"
                            label={i18n.t("crm.pipelineEdit.stageName")}
                            value={row.name}
                            onChange={(e) => updateRow(index, { name: e.target.value })}
                            variant="outlined"
                            style={{ flex: "2 1 200px", minWidth: 160 }}
                          />
                          <TextField
                            size="small"
                            label={i18n.t("crm.pipelineEdit.color")}
                            type="color"
                            value={row.color}
                            onChange={(e) => updateRow(index, { color: e.target.value })}
                            variant="outlined"
                            style={{ width: 72, minWidth: 72 }}
                          />
                          <FormControl size="small" variant="outlined" style={{ minWidth: 140 }}>
                            <InputLabel>{i18n.t("crm.pipelineEdit.type")}</InputLabel>
                            <Select
                              label={i18n.t("crm.pipelineEdit.type")}
                              value={row.kind}
                              onChange={(e) =>
                                updateRow(index, { kind: e.target.value })
                              }
                            >
                              <MenuItem value="normal">
                                {i18n.t("crm.pipelineEdit.typeNormal")}
                              </MenuItem>
                              <MenuItem value="won">
                                {i18n.t("crm.pipelineEdit.typeWon")}
                              </MenuItem>
                              <MenuItem value="lost">
                                {i18n.t("crm.pipelineEdit.typeLost")}
                              </MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("crm.pipelineEdit.deleteStage")}
                          onClick={() => handleRemove(index)}
                          disabled={draft.length <= 1}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Paper>
                    )}
                  </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <Box mt={2}>
          <Button variant="outlined" color="primary" onClick={handleAdd}>
            {i18n.t("crm.pipelineEdit.newStage")}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("crm.pipelineEdit.cancel")}
        </Button>
        <Button color="primary" variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? i18n.t("crm.pipelineEdit.saving") : i18n.t("crm.pipelineEdit.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
