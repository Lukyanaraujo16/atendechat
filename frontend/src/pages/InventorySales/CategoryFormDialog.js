import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@material-ui/core";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import {
  createInventoryCategory,
  updateInventoryCategory,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const emptyForm = {
  name: "",
  description: "",
  parentId: "",
  position: "0",
  active: true,
};

export default function CategoryFormDialog({
  open,
  onClose,
  category,
  categories,
  onSaved,
}) {
  const isEdit = category?.id != null;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        name: category.name || "",
        description: category.description || "",
        parentId:
          category.parentId != null ? String(category.parentId) : "",
        position:
          category.position != null ? String(category.position) : "0",
        active: category.active !== false,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, isEdit, category]);

  const setField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const parentOptions = (categories || []).filter(
    (c) => !isEdit || c.id !== category.id
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(i18n.t("inventorySales.categories.validation.name"));
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      parentId: form.parentId ? Number(form.parentId) : null,
      position: Number(form.position) || 0,
      active: form.active,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateInventoryCategory(category.id, payload);
        toast.success(i18n.t("inventorySales.categories.toasts.updated"));
      } else {
        await createInventoryCategory(payload);
        toast.success(i18n.t("inventorySales.categories.toasts.created"));
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <AppDialogTitle>
          {isEdit
            ? i18n.t("inventorySales.categories.editTitle")
            : i18n.t("inventorySales.categories.newTitle")}
        </AppDialogTitle>
        <AppDialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
            <TextField
              label={i18n.t("inventorySales.categories.fields.name")}
              value={form.name}
              onChange={setField("name")}
              variant="outlined"
              size="small"
              fullWidth
              required
            />
            <TextField
              label={i18n.t("inventorySales.categories.fields.description")}
              value={form.description}
              onChange={setField("description")}
              variant="outlined"
              size="small"
              fullWidth
              multiline
              rows={2}
            />
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="category-parent-label">
                {i18n.t("inventorySales.categories.fields.parent")}
              </InputLabel>
              <Select
                labelId="category-parent-label"
                value={form.parentId}
                onChange={setField("parentId")}
                label={i18n.t("inventorySales.categories.fields.parent")}
              >
                <MenuItem value="">
                  <em>{i18n.t("inventorySales.common.none")}</em>
                </MenuItem>
                {parentOptions.map((cat) => (
                  <MenuItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={i18n.t("inventorySales.categories.fields.position")}
              value={form.position}
              onChange={setField("position")}
              variant="outlined"
              size="small"
              fullWidth
              type="number"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.active}
                  onChange={setField("active")}
                  color="primary"
                />
              }
              label={i18n.t("inventorySales.categories.fields.active")}
            />
          </Box>
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton type="button" onClick={onClose} disabled={saving}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton type="submit" disabled={saving}>
            {i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}
