import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import PlatformPageHeader from "../Platform/PlatformPageHeader";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";
import { AppSectionCard, AppPrimaryButton, AppLoadingState } from "../../ui";

const MAX_DAYS = 365;

const defaultForm = {
  daysBeforeDueWarning: 3,
  daysAfterDueWarning: 1,
  daysAfterDueBlock: 3,
  enableAutoWarning: true,
  enableAutoBlock: true,
  enableAutoWhatsAppWarning: false,
  whatsappSenderCompanyId: 1,
};

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    width: "100%",
    maxWidth: 640,
  },
  hint: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.55,
    marginTop: theme.spacing(0.5),
    maxWidth: 520,
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  actions: {
    marginTop: theme.spacing(2),
  },
}));

function clampDayValue(raw) {
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(MAX_DAYS, Math.max(0, n));
}

function clampSenderCompanyId(raw) {
  const n = parseInt(String(raw), 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(999999, Math.max(1, n));
}

/**
 * Configuração da automação de faturação (Super Admin). Consome GET/PUT /system-settings/billing-automation.
 */
export default function BillingAutomationPage() {
  const classes = useStyles();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/system-settings/billing-automation");
      setForm({
        daysBeforeDueWarning: clampDayValue(data?.daysBeforeDueWarning ?? defaultForm.daysBeforeDueWarning),
        daysAfterDueWarning: clampDayValue(data?.daysAfterDueWarning ?? defaultForm.daysAfterDueWarning),
        daysAfterDueBlock: clampDayValue(data?.daysAfterDueBlock ?? defaultForm.daysAfterDueBlock),
        enableAutoWarning: Boolean(data?.enableAutoWarning),
        enableAutoBlock: Boolean(data?.enableAutoBlock),
        enableAutoWhatsAppWarning: Boolean(data?.enableAutoWhatsAppWarning),
        whatsappSenderCompanyId: clampSenderCompanyId(
          data?.whatsappSenderCompanyId ?? defaultForm.whatsappSenderCompanyId
        ),
      });
    } catch (e) {
      toastError(e);
      setForm(defaultForm);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const payload = {
      daysBeforeDueWarning: clampDayValue(form.daysBeforeDueWarning),
      daysAfterDueWarning: clampDayValue(form.daysAfterDueWarning),
      daysAfterDueBlock: clampDayValue(form.daysAfterDueBlock),
      enableAutoWarning: Boolean(form.enableAutoWarning),
      enableAutoBlock: Boolean(form.enableAutoBlock),
      enableAutoWhatsAppWarning: Boolean(form.enableAutoWhatsAppWarning),
      whatsappSenderCompanyId: clampSenderCompanyId(form.whatsappSenderCompanyId),
    };

    setSaving(true);
    try {
      const { data } = await api.put("/system-settings/billing-automation", payload);
      setForm({
        daysBeforeDueWarning: clampDayValue(data?.daysBeforeDueWarning ?? payload.daysBeforeDueWarning),
        daysAfterDueWarning: clampDayValue(data?.daysAfterDueWarning ?? payload.daysAfterDueWarning),
        daysAfterDueBlock: clampDayValue(data?.daysAfterDueBlock ?? payload.daysAfterDueBlock),
        enableAutoWarning: Boolean(data?.enableAutoWarning),
        enableAutoBlock: Boolean(data?.enableAutoBlock),
        enableAutoWhatsAppWarning: Boolean(data?.enableAutoWhatsAppWarning),
        whatsappSenderCompanyId: clampSenderCompanyId(
          data?.whatsappSenderCompanyId ?? payload.whatsappSenderCompanyId
        ),
      });
      toast.success(i18n.t("platform.billingAutomation.toastSaved"));
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainContainer>
        <PlatformPageHeader
          titleKey="platform.billingAutomation.title"
          subtitleKey="platform.billingAutomation.subtitle"
        />
        <AppLoadingState message={i18n.t("platform.billingAutomation.loading")} />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <PlatformPageHeader
        titleKey="platform.billingAutomation.title"
        subtitleKey="platform.billingAutomation.subtitle"
      />
      <Box className={classes.page}>
        <AppSectionCard>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("platform.billingAutomation.sectionWarnings")}
          </Typography>
          <Typography variant="body2" color="textSecondary" component="p" className={classes.hint} style={{ marginTop: 8 }}>
            {i18n.t("platform.billingAutomation.introWarnings")}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={form.enableAutoWarning}
                onChange={(e) => setField("enableAutoWarning", e.target.checked)}
              />
            }
            label={i18n.t("platform.billingAutomation.enableWarnings")}
          />

          <Box className={classes.fields}>
            <TextField
              type="number"
              variant="outlined"
              size="small"
              fullWidth
              disabled={!form.enableAutoWarning}
              label={i18n.t("platform.billingAutomation.daysBefore")}
              value={form.daysBeforeDueWarning}
              onChange={(e) => setField("daysBeforeDueWarning", e.target.value)}
              inputProps={{ min: 0, max: MAX_DAYS, step: 1 }}
              helperText={i18n.t("platform.billingAutomation.hintDaysBefore")}
            />
            <TextField
              type="number"
              variant="outlined"
              size="small"
              fullWidth
              disabled={!form.enableAutoWarning}
              label={i18n.t("platform.billingAutomation.daysAfter")}
              value={form.daysAfterDueWarning}
              onChange={(e) => setField("daysAfterDueWarning", e.target.value)}
              inputProps={{ min: 0, max: MAX_DAYS, step: 1 }}
              helperText={i18n.t("platform.billingAutomation.hintDaysAfter")}
            />
          </Box>

          <Box
            marginTop={2}
            paddingTop={2}
            style={{ borderTop: `1px solid ${theme.palette.divider}` }}
          >
            <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
              {i18n.t("platform.billingAutomation.sectionWhatsApp")}
            </Typography>
            <Typography variant="body2" color="textSecondary" component="p" className={classes.hint}>
              {i18n.t("platform.billingAutomation.introWhatsApp")}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={form.enableAutoWhatsAppWarning}
                  onChange={(e) => setField("enableAutoWhatsAppWarning", e.target.checked)}
                  disabled={!form.enableAutoWarning}
                />
              }
              label={i18n.t("platform.billingAutomation.enableWhatsApp")}
            />
            <TextField
              type="number"
              variant="outlined"
              size="small"
              fullWidth
              style={{ marginTop: 12 }}
              disabled={!form.enableAutoWarning || !form.enableAutoWhatsAppWarning}
              label={i18n.t("platform.billingAutomation.whatsappSenderCompanyId")}
              value={form.whatsappSenderCompanyId}
              onChange={(e) => setField("whatsappSenderCompanyId", e.target.value)}
              inputProps={{ min: 1, max: 999999, step: 1 }}
              helperText={i18n.t("platform.billingAutomation.hintWhatsappSender")}
            />
          </Box>
        </AppSectionCard>

        <AppSectionCard>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("platform.billingAutomation.sectionBlock")}
          </Typography>
          <Typography variant="body2" color="textSecondary" component="p" className={classes.hint} style={{ marginTop: 8 }}>
            {i18n.t("platform.billingAutomation.introBlock")}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={form.enableAutoBlock}
                onChange={(e) => setField("enableAutoBlock", e.target.checked)}
              />
            }
            label={i18n.t("platform.billingAutomation.enableBlock")}
          />

          <Box className={classes.fields}>
            <TextField
              type="number"
              variant="outlined"
              size="small"
              fullWidth
              disabled={!form.enableAutoBlock}
              label={i18n.t("platform.billingAutomation.daysBlock")}
              value={form.daysAfterDueBlock}
              onChange={(e) => setField("daysAfterDueBlock", e.target.value)}
              inputProps={{ min: 0, max: MAX_DAYS, step: 1 }}
              helperText={i18n.t("platform.billingAutomation.hintDaysBlock")}
            />
          </Box>
        </AppSectionCard>

        <Typography variant="caption" color="textSecondary" component="p" style={{ lineHeight: 1.5 }}>
          {i18n.t("platform.billingAutomation.footerNote")}
        </Typography>

        <Box className={classes.actions}>
          <AppPrimaryButton onClick={handleSave} loading={saving}>
            {i18n.t("platform.billingAutomation.save")}
          </AppPrimaryButton>
        </Box>
      </Box>
    </MainContainer>
  );
}
