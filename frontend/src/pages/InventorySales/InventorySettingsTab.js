import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSectionCard,
  AppSecondaryButton,
} from "../../ui";
import {
  getInventorySettings,
  updateInventorySettings,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

export default function InventorySettingsTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultCommissionRate: "0",
    allowNegativeStock: false,
    saleNumberPrefix: "",
    receiptTradeName: "",
    receiptLegalName: "",
    receiptDocument: "",
    receiptPhone: "",
    receiptAddress: "",
    receiptFooterMessage: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await getInventorySettings();
      setForm({
        defaultCommissionRate:
          data.defaultCommissionRate != null
            ? String(data.defaultCommissionRate)
            : "0",
        allowNegativeStock: data.allowNegativeStock === true,
        saleNumberPrefix: data.saleNumberPrefix || "",
        receiptTradeName: data.receiptTradeName || "",
        receiptLegalName: data.receiptLegalName || "",
        receiptDocument: data.receiptDocument || "",
        receiptPhone: data.receiptPhone || "",
        receiptAddress: data.receiptAddress || "",
        receiptFooterMessage: data.receiptFooterMessage || "",
      });
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const rate = Number(form.defaultCommissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error(i18n.t("inventorySales.settings.validation.commission"));
      return;
    }

    setSaving(true);
    try {
      await updateInventorySettings({
        defaultCommissionRate: rate,
        allowNegativeStock: form.allowNegativeStock,
        saleNumberPrefix: form.saleNumberPrefix.trim() || null,
        receiptTradeName: form.receiptTradeName.trim() || null,
        receiptLegalName: form.receiptLegalName.trim() || null,
        receiptDocument: form.receiptDocument.trim() || null,
        receiptPhone: form.receiptPhone.trim() || null,
        receiptAddress: form.receiptAddress.trim() || null,
        receiptFooterMessage: form.receiptFooterMessage.trim() || null,
      });
      toast.success(i18n.t("inventorySales.settings.toasts.saved"));
      load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppLoadingState message={i18n.t("inventorySales.common.loading")} />;
  }

  if (loadError) {
    return (
      <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
        <AppSecondaryButton onClick={load}>
          {i18n.t("inventorySales.common.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  return (
    <Box maxWidth={520}>
      <form onSubmit={handleSave}>
        <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 16 }}>
          {i18n.t("inventorySales.settings.title")}
        </Typography>
        <AppSectionCard variant="outlined">
          <Box display="flex" flexDirection="column" style={{ gap: 20 }}>
            <TextField
              label={i18n.t("inventorySales.settings.fields.defaultCommissionRate")}
              value={form.defaultCommissionRate}
              onChange={setField("defaultCommissionRate")}
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, max: 100, step: "0.01" }}
              helperText={i18n.t("inventorySales.settings.hints.commission")}
            />
            <TextField
              label={i18n.t("inventorySales.settings.fields.saleNumberPrefix")}
              value={form.saleNumberPrefix}
              onChange={setField("saleNumberPrefix")}
              variant="outlined"
              size="small"
              fullWidth
              inputProps={{ maxLength: 16 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.allowNegativeStock}
                  onChange={setField("allowNegativeStock")}
                  color="primary"
                />
              }
              label={i18n.t("inventorySales.settings.fields.allowNegativeStock")}
            />
          </Box>
        </AppSectionCard>
        <Box mt={3}>
          <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 8 }}>
            {i18n.t("inventorySales.settings.receiptData.title")}
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
            {i18n.t("inventorySales.settings.receiptData.hint")}
          </Typography>
          <AppSectionCard variant="outlined">
            <Box display="flex" flexDirection="column" style={{ gap: 20 }}>
              <TextField
                id="receipt-trade-name"
                label={i18n.t("inventorySales.settings.receiptData.fields.tradeName")}
                value={form.receiptTradeName}
                onChange={setField("receiptTradeName")}
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ maxLength: 120 }}
              />
              <TextField
                id="receipt-legal-name"
                label={i18n.t("inventorySales.settings.receiptData.fields.legalName")}
                value={form.receiptLegalName}
                onChange={setField("receiptLegalName")}
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ maxLength: 160 }}
              />
              <TextField
                id="receipt-document"
                label={i18n.t("inventorySales.settings.receiptData.fields.document")}
                value={form.receiptDocument}
                onChange={setField("receiptDocument")}
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                id="receipt-phone"
                label={i18n.t("inventorySales.settings.receiptData.fields.phone")}
                value={form.receiptPhone}
                onChange={setField("receiptPhone")}
                variant="outlined"
                size="small"
                fullWidth
                inputProps={{ maxLength: 32 }}
              />
              <TextField
                id="receipt-address"
                label={i18n.t("inventorySales.settings.receiptData.fields.address")}
                value={form.receiptAddress}
                onChange={setField("receiptAddress")}
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={3}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                id="receipt-footer-message"
                label={i18n.t("inventorySales.settings.receiptData.fields.footerMessage")}
                value={form.receiptFooterMessage}
                onChange={setField("receiptFooterMessage")}
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={3}
                inputProps={{ maxLength: 500 }}
              />
            </Box>
          </AppSectionCard>
        </Box>
        <Box mt={2}>
          <AppPrimaryButton type="submit" disabled={saving}>
            {i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </Box>
      </form>
    </Box>
  );
}
