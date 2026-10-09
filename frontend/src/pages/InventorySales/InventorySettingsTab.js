import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import { toast } from "react-toastify";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSectionCard,
  AppSecondaryButton,
} from "../../ui";
import ConfirmationModal from "../../components/ConfirmationModal";
import {
  deleteInventoryReceiptLogo,
  getInventorySettings,
  updateInventorySettings,
  uploadInventoryReceiptLogo,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { receiptLogoDisplayUrl, receiptPrintFormatFromPayload } from "./receiptBranding";
import { SALE_RECEIPT_PRINT_FORMAT_LIST } from "./saleReceiptPrintFormats";
import InventoryDeliveryMethodsSection from "./InventoryDeliveryMethodsSection";

const RECEIPT_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const useStyles = makeStyles((theme) => ({
  page: {
    maxWidth: 1120,
    width: "100%",
  },
  logoFrame: {
    width: 160,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: theme.spacing(1),
    backgroundColor:
      theme.palette.type === "light" ? "#f5f5f5" : theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
  },
  sectionHint: {
    marginBottom: theme.spacing(2),
  },
}));

function logoFileAllowed(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const typeOk = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(type);
  const nameOk = /\.(png|jpe?g|webp)$/.test(name);
  return typeOk && nameOk;
}

export default function InventorySettingsTab() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const logoInputRef = useRef(null);
  const [form, setForm] = useState({
    defaultCommissionRate: "0",
    allowNegativeStock: false,
    blockStoreCreditWhenOverdue: true,
    saleNumberPrefix: "",
    receiptTradeName: "",
    receiptLegalName: "",
    receiptDocument: "",
    receiptPhone: "",
    receiptAddress: "",
    receiptFooterMessage: "",
    receiptPrintFormat: receiptPrintFormatFromPayload(null),
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
        blockStoreCreditWhenOverdue: data.blockStoreCreditWhenOverdue !== false,
        saleNumberPrefix: data.saleNumberPrefix || "",
        receiptTradeName: data.receiptTradeName || "",
        receiptLegalName: data.receiptLegalName || "",
        receiptDocument: data.receiptDocument || "",
        receiptPhone: data.receiptPhone || "",
        receiptAddress: data.receiptAddress || "",
        receiptFooterMessage: data.receiptFooterMessage || "",
        receiptPrintFormat: receiptPrintFormatFromPayload(data),
      });
      setLogoUrl(data.receiptLogoUrl || "");
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

  const handlePrintFormat = (_event, next) => {
    if (!next) return;
    setForm((prev) => ({ ...prev, receiptPrintFormat: next }));
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
        blockStoreCreditWhenOverdue: form.blockStoreCreditWhenOverdue,
        saleNumberPrefix: form.saleNumberPrefix.trim() || null,
        receiptTradeName: form.receiptTradeName.trim() || null,
        receiptLegalName: form.receiptLegalName.trim() || null,
        receiptDocument: form.receiptDocument.trim() || null,
        receiptPhone: form.receiptPhone.trim() || null,
        receiptAddress: form.receiptAddress.trim() || null,
        receiptFooterMessage: form.receiptFooterMessage.trim() || null,
        receiptPrintFormat: form.receiptPrintFormat,
      });
      toast.success(i18n.t("inventorySales.settings.toasts.saved"));
      load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file || logoBusy) return;
    if (!logoFileAllowed(file)) {
      toast.error(i18n.t("inventorySales.settings.receiptData.logo.invalidType"));
      return;
    }
    if (file.size > RECEIPT_LOGO_MAX_BYTES) {
      toast.error(i18n.t("inventorySales.settings.receiptData.logo.tooLarge"));
      return;
    }
    setLogoBusy(true);
    try {
      const { data } = await uploadInventoryReceiptLogo(file);
      setLogoUrl((data && data.receiptLogoUrl) || "");
    } catch (err) {
      toastError(err);
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoBusy(true);
    try {
      await deleteInventoryReceiptLogo();
      setLogoUrl("");
      setConfirmRemoveLogo(false);
    } catch (err) {
      toastError(err);
    } finally {
      setLogoBusy(false);
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
    <Box className={classes.page}>
      <form onSubmit={handleSave}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Box display="flex" flexDirection="column" style={{ gap: 24 }}>
              <AppSectionCard variant="outlined">
                <Typography variant="h6" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.settings.title")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionHint}
                >
                  {i18n.t("inventorySales.settings.stockHint")}
                </Typography>
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
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.blockStoreCreditWhenOverdue}
                        onChange={setField("blockStoreCreditWhenOverdue")}
                        color="primary"
                        data-testid="settings-block-store-credit-overdue"
                      />
                    }
                    label={i18n.t(
                      "inventorySales.settings.fields.blockStoreCreditWhenOverdue"
                    )}
                  />
                  <Typography variant="caption" color="textSecondary">
                    {i18n.t(
                      "inventorySales.settings.hints.blockStoreCreditWhenOverdue"
                    )}
                  </Typography>
                </Box>
              </AppSectionCard>
              <InventoryDeliveryMethodsSection />
              <AppSectionCard variant="outlined">
                <Typography variant="h6" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.settings.printPreferences.title")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionHint}
                >
                  {i18n.t("inventorySales.settings.printPreferences.hint")}
                </Typography>
                <Typography
                  id="receipt-print-format-label"
                  variant="subtitle2"
                  component="div"
                  style={{ fontWeight: 600 }}
                >
                  {i18n.t("inventorySales.settings.printPreferences.format")}
                </Typography>
                <Box mt={1}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={form.receiptPrintFormat}
                    onChange={handlePrintFormat}
                    aria-labelledby="receipt-print-format-label"
                    aria-describedby="receipt-print-format-helper"
                  >
                    {SALE_RECEIPT_PRINT_FORMAT_LIST.map((id) => (
                      <ToggleButton key={id} value={id}>
                        {i18n.t(`inventorySales.settings.printPreferences.options.${id}`)}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
                <Typography
                  id="receipt-print-format-helper"
                  variant="caption"
                  color="textSecondary"
                  component="p"
                  style={{ marginTop: 8 }}
                >
                  {i18n.t("inventorySales.settings.printPreferences.helper")}
                </Typography>
              </AppSectionCard>
            </Box>
          </Grid>
          <Grid item xs={12} md={7}>
            <AppSectionCard variant="outlined">
              <Typography variant="h6" style={{ fontWeight: 600 }}>
                {i18n.t("inventorySales.settings.receiptData.title")}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                className={classes.sectionHint}
              >
                {i18n.t("inventorySales.settings.receiptData.hint")}
              </Typography>
              <Box display="flex" flexDirection="column" style={{ gap: 20 }}>
                <Box>
                  <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                    {i18n.t("inventorySales.settings.receiptData.logo.title")}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {i18n.t("inventorySales.settings.receiptData.logo.hint")}
                  </Typography>
                  <Box className={classes.logoFrame}>
                    {receiptLogoDisplayUrl(logoUrl) ? (
                      <img
                        data-testid="receipt-logo-preview"
                        alt={i18n.t("inventorySales.settings.receiptData.logo.alt")}
                        src={receiptLogoDisplayUrl(logoUrl)}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : null}
                  </Box>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={handleLogoFile}
                  />
                  <Box mt={1} display="flex" style={{ gap: 8 }}>
                    <AppSecondaryButton
                      type="button"
                      loading={logoBusy}
                      onClick={() => logoInputRef.current && logoInputRef.current.click()}
                    >
                      {logoUrl
                        ? i18n.t("inventorySales.settings.receiptData.logo.replace")
                        : i18n.t("inventorySales.settings.receiptData.logo.select")}
                    </AppSecondaryButton>
                    {logoUrl ? (
                      <AppSecondaryButton
                        type="button"
                        disabled={logoBusy}
                        onClick={() => setConfirmRemoveLogo(true)}
                      >
                        {i18n.t("inventorySales.settings.receiptData.logo.remove")}
                      </AppSecondaryButton>
                    ) : null}
                  </Box>
                </Box>
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
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
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
                  </Grid>
                  <Grid item xs={12} sm={6}>
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
                  </Grid>
                </Grid>
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
          </Grid>
        </Grid>
        <Box mt={3}>
          <AppPrimaryButton type="submit" disabled={saving}>
            {i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </Box>
      </form>
      <ConfirmationModal
        open={confirmRemoveLogo}
        title={i18n.t("inventorySales.settings.receiptData.logo.removeTitle")}
        onClose={() => !logoBusy && setConfirmRemoveLogo(false)}
        onConfirm={handleRemoveLogo}
        asyncConfirm
        loading={logoBusy}
        destructive
        confirmText={i18n.t("inventorySales.settings.receiptData.logo.remove")}
      >
        {i18n.t("inventorySales.settings.receiptData.logo.removeMessage")}
      </ConfirmationModal>
    </Box>
  );
}
