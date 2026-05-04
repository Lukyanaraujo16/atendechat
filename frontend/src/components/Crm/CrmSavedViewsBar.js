import React, { useState, useCallback, useMemo } from "react";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import Divider from "@material-ui/core/Divider";
import MoreVertIcon from "@material-ui/icons/MoreVert";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { getErrorToastOptions } from "../../errors/feedbackToasts";

const CREATE_VALUE = "__create__";

function canMutateView(user, view) {
  if (!view) return false;
  if (user?.profile === "admin" || user?.supportMode) return true;
  if (user?.id == null || view.createdBy == null) return false;
  return String(user.id) === String(view.createdBy);
}

export default function CrmSavedViewsBar({
  views,
  selectedViewId,
  onSelectedViewIdChange,
  onApplyParsedFilters,
  onClearAllFilters,
  currentFiltersPayload,
  user,
  onReloadViews,
  disabled,
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDefault, setEditDefault] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedView = useMemo(
    () => views.find((v) => v.id === selectedViewId) || null,
    [views, selectedViewId]
  );

  const openMenu = Boolean(menuAnchor);

  const handleSelect = useCallback(
    (e) => {
      const v = e.target.value;
      if (v === CREATE_VALUE) {
        setSaveName("");
        setSaveDefault(false);
        setSaveOpen(true);
        return;
      }
      if (v === "") {
        onSelectedViewIdChange(null);
        onClearAllFilters();
        return;
      }
      const id = Number(v);
      const view = views.find((x) => x.id === id);
      if (!view) return;
      onSelectedViewIdChange(id);
      onApplyParsedFilters(view.filters);
    },
    [views, onSelectedViewIdChange, onApplyParsedFilters, onClearAllFilters]
  );

  const handleSaveNew = async () => {
    const name = String(saveName || "").trim();
    if (!name) {
      toast.error(i18n.t("crm.savedViews.nameRequired"), getErrorToastOptions());
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/crm/views", {
        name,
        filters: currentFiltersPayload,
        isDefault: saveDefault,
      });
      toast.success(i18n.t("crm.savedViews.saveSuccess"), getErrorToastOptions());
      setSaveOpen(false);
      await onReloadViews();
      if (data?.id) {
        onSelectedViewIdChange(data.id);
      }
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!selectedView) return;
    setEditName(selectedView.name);
    setEditDefault(Boolean(selectedView.isDefault));
    setEditOpen(true);
    setMenuAnchor(null);
  };

  const handleEditSave = async () => {
    if (!selectedView) return;
    const name = String(editName || "").trim();
    if (!name) {
      toast.error(i18n.t("crm.savedViews.nameRequired"), getErrorToastOptions());
      return;
    }
    setSaving(true);
    try {
      await api.put(`/crm/views/${selectedView.id}`, {
        name,
        isDefault: editDefault,
      });
      toast.success(i18n.t("crm.savedViews.saveSuccess"), getErrorToastOptions());
      setEditOpen(false);
      await onReloadViews();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFilters = async () => {
    if (!selectedView || !canMutateView(user, selectedView)) return;
    setSaving(true);
    setMenuAnchor(null);
    try {
      await api.put(`/crm/views/${selectedView.id}`, {
        filters: currentFiltersPayload,
      });
      toast.success(i18n.t("crm.savedViews.updateFiltersSuccess"), getErrorToastOptions());
      await onReloadViews();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedView || !canMutateView(user, selectedView)) return;
    if (
      !window.confirm(
        i18n.t("crm.savedViews.deleteConfirm", { name: selectedView.name })
      )
    ) {
      setMenuAnchor(null);
      return;
    }
    setMenuAnchor(null);
    try {
      await api.delete(`/crm/views/${selectedView.id}`);
      toast.success(i18n.t("crm.savedViews.deleteSuccess"), getErrorToastOptions());
      onSelectedViewIdChange(null);
      onClearAllFilters();
      await onReloadViews();
    } catch (e) {
      toastError(e);
    }
  };

  const selectValue =
    selectedViewId != null ? String(selectedViewId) : "";

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 8 }}>
      <FormControl variant="outlined" size="small" style={{ minWidth: 220 }}>
        <InputLabel>{i18n.t("crm.savedViews.selectLabel")}</InputLabel>
        <Select
          label={i18n.t("crm.savedViews.selectLabel")}
          value={selectValue}
          onChange={handleSelect}
          disabled={disabled}
        >
          <MenuItem value="">
            <em>{i18n.t("crm.savedViews.all")}</em>
          </MenuItem>
          {views.length === 0 ? (
            <MenuItem disabled value="__none__">
              {i18n.t("crm.savedViews.noneSaved")}
            </MenuItem>
          ) : null}
          {views.map((v) => (
            <MenuItem key={v.id} value={String(v.id)}>
              {v.name}
              {v.isDefault ? ` (${i18n.t("crm.savedViews.defaultBadge")})` : ""}
            </MenuItem>
          ))}
          <Divider style={{ margin: "4px 0" }} />
          <MenuItem value={CREATE_VALUE}>{i18n.t("crm.savedViews.newView")}</MenuItem>
        </Select>
      </FormControl>

      {selectedView ? (
        <Typography variant="body2" color="textSecondary" style={{ maxWidth: 200 }} noWrap>
          {i18n.t("crm.savedViews.activeLabel")}: {selectedView.name}
        </Typography>
      ) : null}

      {selectedView && canMutateView(user, selectedView) ? (
        <>
          <IconButton
            size="small"
            aria-label={i18n.t("crm.savedViews.viewMenu")}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={openMenu}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem onClick={openEdit}>{i18n.t("crm.savedViews.editView")}</MenuItem>
            <MenuItem onClick={handleUpdateFilters}>
              {i18n.t("crm.savedViews.updateWithCurrent")}
            </MenuItem>
            <MenuItem onClick={handleDelete} style={{ color: "#c62828" }}>
              {i18n.t("crm.savedViews.deleteView")}
            </MenuItem>
          </Menu>
        </>
      ) : null}

      <Button
        size="small"
        variant="outlined"
        disabled={disabled}
        onClick={() => {
          setSaveName("");
          setSaveDefault(false);
          setSaveOpen(true);
        }}
      >
        {i18n.t("crm.savedViews.saveFilters")}
      </Button>

      {selectedViewId != null ? (
        <Button
          size="small"
          onClick={() => {
            onSelectedViewIdChange(null);
            onClearAllFilters();
          }}
        >
          {i18n.t("crm.savedViews.clearView")}
        </Button>
      ) : null}

      <Dialog open={saveOpen} onClose={() => !saving && setSaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{i18n.t("crm.savedViews.newViewTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={i18n.t("crm.savedViews.viewName")}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <FormControlLabel
            control={
              <Switch
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                color="primary"
              />
            }
            label={i18n.t("crm.savedViews.setAsDefault")}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)} disabled={saving}>
            {i18n.t("crm.common.cancel")}
          </Button>
          <Button onClick={handleSaveNew} color="primary" variant="contained" disabled={saving}>
            {i18n.t("crm.common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{i18n.t("crm.savedViews.editViewTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label={i18n.t("crm.savedViews.viewName")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            variant="outlined"
          />
          <FormControlLabel
            control={
              <Switch
                checked={editDefault}
                onChange={(e) => setEditDefault(e.target.checked)}
                color="primary"
              />
            }
            label={i18n.t("crm.savedViews.setAsDefault")}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            {i18n.t("crm.common.cancel")}
          </Button>
          <Button onClick={handleEditSave} color="primary" variant="contained" disabled={saving}>
            {i18n.t("crm.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export { canMutateView };
