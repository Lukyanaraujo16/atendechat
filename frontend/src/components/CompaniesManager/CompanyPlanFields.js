import React, { useContext, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Autorenew from "@material-ui/icons/Autorenew";
import { Field, useFormikContext } from "formik";
import moment from "moment-timezone";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getIanaTimezones } from "../../utils/ianaTimezones";
import {
  parseBrazilianCurrencyToNumber,
  formatPlanValueForInput,
} from "../../utils/brazilianCurrency";
import { formatBrlBrief } from "../../utils/companyPlanValue";
import { BUSINESS_SEGMENTS } from "../../config/businessSegment.js";
import { AppSectionCard, AppNeutralButton, AppSecondaryButton } from "../../ui";
import CompanyPlanChangeDialog from "../ModuleSettings/CompanyPlanChangeDialog";
import {
  mergeModulePermissions,
  mergeModulePermissionsFromPlan,
} from "../ModuleSettings/moduleSync";
import { REC_MONTHS, formatStorageBytesBrief } from "./companyHelpers";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    lineHeight: 1.35,
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    marginBottom: theme.spacing(1.5),
    lineHeight: 1.5,
    maxWidth: 720,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
}));

function SectionHeader({ title, hint }) {
  const classes = useStyles();
  return (
    <>
      <Typography className={classes.sectionTitle} component="h2">
        {title}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="textSecondary" className={classes.sectionSubtitle}>
          {hint}
        </Typography>
      ) : null}
    </>
  );
}

/**
 * Campos de plano/operação/armazenamento de uma empresa (dentro de um <Formik>).
 * Extraído do antigo CompanyForm sem remover controles.
 *
 * Props:
 * - plans: lista de planos
 * - companyId: id da empresa (ausente na criação → oculta ações que exigem empresa salva)
 * - loading: desabilita ações
 * - storageSnapshots: histórico de armazenamento
 * - onStorageRecalculated: callback após recalcular armazenamento
 */
export default function CompanyPlanFields({
  plans = [],
  companyId,
  loading,
  storageSnapshots = [],
  onStorageRecalculated,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const formik = useFormikContext();
  const [planChangeCtx, setPlanChangeCtx] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const isSuper = Boolean(user?.super);

  const incrementDueDate = () => {
    const { dueDate, recurrence } = formik.values;
    if (!dueDate) return;
    const months = REC_MONTHS[String(recurrence || "").toUpperCase()];
    if (!months) return;
    formik.setFieldValue(
      "dueDate",
      moment(dueDate).add(months, "month").format("YYYY-MM-DD")
    );
  };

  const handleRecalculate = async () => {
    if (!companyId) return;
    setRecalculating(true);
    try {
      await api.post(`/companies/${companyId}/recalculate-storage`);
      toast.success(i18n.t("platform.companies.storageRecalculated"));
      if (typeof onStorageRecalculated === "function") await onStorageRecalculated();
    } catch (e) {
      toastError(e);
    } finally {
      setRecalculating(false);
    }
  };

  const handleBootstrapCrm = async () => {
    if (!companyId) return;
    setBootstrapping(true);
    try {
      const { data } = await api.post(`/companies/${companyId}/crm/bootstrap`);
      toast.success(
        data.bootstrapped
          ? i18n.t("settings.company.form.bootstrapCrmOk")
          : i18n.t("settings.company.form.bootstrapCrmAlready")
      );
    } catch (e) {
      toastError(e);
    } finally {
      setBootstrapping(false);
    }
  };

  const selectedPlan = plans.find((p) => String(p.id) === String(formik.values.planId));

  return (
    <Box className={classes.stack}>
      {/* Plano e cobrança */}
      <AppSectionCard>
        <SectionHeader
          title="Plano e cobrança"
          hint={i18n.t("settings.company.form.sectionPlanOperationHint")}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl margin="dense" variant="outlined" fullWidth>
              <InputLabel id="plan-selection-label">{i18n.t("settings.company.form.plan")}</InputLabel>
              <Field name="planId">
                {({ field, form }) => (
                  <Select
                    id="plan-selection"
                    labelId="plan-selection-label"
                    label={i18n.t("settings.company.form.plan")}
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const v = e.target.value;
                      const prevId = field.value;
                      const modulesBefore = mergeModulePermissions(form.values.modulePermissions);
                      form.setFieldValue("planId", v);
                      if (String(prevId) === String(v)) return;
                      const newPlan = plans.find((pl) => String(pl.id) === String(v));
                      if (!newPlan) return;
                      setPlanChangeCtx({ prevPlanId: prevId, modulesBefore, newPlan });
                    }}
                  >
                    {plans.map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </Field>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl margin="dense" variant="outlined" fullWidth>
              <InputLabel id="recorrencia-selection-label">
                {i18n.t("settings.company.form.recurrence")}
              </InputLabel>
              <Field
                as={Select}
                label={i18n.t("settings.company.form.recurrence")}
                labelId="recorrencia-selection-label"
                id="recurrence"
                name="recurrence"
              >
                <MenuItem value="MENSAL">{i18n.t("settings.company.form.monthly")}</MenuItem>
                <MenuItem value="BIMESTRAL">Bimestral</MenuItem>
                <MenuItem value="TRIMESTRAL">Trimestral</MenuItem>
                <MenuItem value="SEMESTRAL">Semestral</MenuItem>
                <MenuItem value="ANUAL">Anual</MenuItem>
              </Field>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Field
              as={TextField}
              label={i18n.t("settings.company.form.dueDate")}
              type="date"
              name="dueDate"
              InputLabelProps={{ shrink: true }}
              variant="outlined"
              fullWidth
              margin="dense"
            />
            {companyId ? (
              <Box mt={0.5}>
                <AppNeutralButton
                  type="button"
                  size="small"
                  disabled={loading || !formik.values.dueDate}
                  onClick={incrementDueDate}
                >
                  {i18n.t("settings.company.buttons.adjustDueDate")}
                </AppNeutralButton>
                <Typography variant="caption" color="textSecondary" display="block">
                  Ajuste manual (só é aplicado ao salvar). Para renovar com registro, use “Renovar”.
                </Typography>
              </Box>
            ) : null}
          </Grid>

          {isSuper ? (
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginTop: 8 }}>
                {i18n.t("settings.company.form.contractedPlanSection")}
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: 4 }}>
                {i18n.t("settings.company.form.contractedPlanHint")}
              </Typography>
              <Field name="contractedPlanValueStr">
                {({ field, form }) => {
                  const planBaseline = Number(selectedPlan?.value);
                  const hasPlan = Boolean(selectedPlan);
                  const raw = String(field.value ?? "").trim();
                  let parsedContr = raw ? parseBrazilianCurrencyToNumber(raw) : null;
                  if (parsedContr !== null && Number.isNaN(parsedContr)) parsedContr = null;
                  const effective = hasPlan
                    ? parsedContr !== null
                      ? parsedContr
                      : planBaseline
                    : parsedContr ?? 0;
                  let deltaLine = "";
                  if (hasPlan && !Number.isNaN(planBaseline) && parsedContr !== null) {
                    const delta = parsedContr - planBaseline;
                    if (Math.round(delta * 100) !== 0) {
                      deltaLine =
                        delta < 0
                          ? i18n.t("settings.company.form.contractedPlanDiscountLabel", {
                              value: formatBrlBrief(Math.abs(delta)),
                            })
                          : i18n.t("settings.company.form.contractedPlanSurchargeLabel", {
                              value: formatBrlBrief(delta),
                            });
                    }
                  }
                  return (
                    <>
                      <TextField
                        {...field}
                        value={field.value ?? ""}
                        fullWidth
                        margin="dense"
                        variant="outlined"
                        label={i18n.t("settings.company.form.contractedPlanLabel")}
                        placeholder={selectedPlan ? formatPlanValueForInput(selectedPlan.value) : ""}
                      />
                      <Box mt={0.5} display="flex" flexWrap="wrap" alignItems="center">
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          component="span"
                          style={{ marginRight: theme.spacing(1) }}
                        >
                          {selectedPlan
                            ? i18n.t("settings.company.form.contractedPlanBaseline", {
                                value: formatPlanValueForInput(selectedPlan.value),
                              })
                            : i18n.t("settings.company.form.contractedPlanNoPlanSelected")}
                        </Typography>
                        <Typography variant="caption" color="textPrimary" component="span">
                          {hasPlan || parsedContr !== null
                            ? i18n.t("settings.company.form.contractedPlanEffective", {
                                value: formatBrlBrief(effective),
                              })
                            : null}
                        </Typography>
                      </Box>
                      {deltaLine ? (
                        <Typography variant="caption" color="secondary" component="div" style={{ marginTop: 6 }}>
                          {deltaLine}
                        </Typography>
                      ) : null}
                      <Box mt={1}>
                        <AppNeutralButton
                          type="button"
                          size="small"
                          disabled={loading}
                          onClick={() => form.setFieldValue("contractedPlanValueStr", "")}
                        >
                          {i18n.t("settings.company.form.contractedPlanClear")}
                        </AppNeutralButton>
                      </Box>
                    </>
                  );
                }}
              </Field>
            </Grid>
          ) : null}
        </Grid>
      </AppSectionCard>

      {/* Operação */}
      <AppSectionCard>
        <SectionHeader
          title="Operação"
          hint="Status de acesso, fuso horário, segmento de negócio e visibilidade do CRM."
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl margin="dense" variant="outlined" fullWidth>
              <InputLabel id="status-selection-label">{i18n.t("settings.company.form.status")}</InputLabel>
              <Field
                as={Select}
                id="status-selection"
                label={i18n.t("settings.company.form.status")}
                labelId="status-selection-label"
                name="status"
              >
                <MenuItem value={true}>{i18n.t("settings.company.form.yes")}</MenuItem>
                <MenuItem value={false}>{i18n.t("settings.company.form.no")}</MenuItem>
              </Field>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Field
              as={TextField}
              select
              name="timezone"
              label={i18n.t("settings.company.form.timezone")}
              variant="outlined"
              fullWidth
              margin="dense"
            >
              {getIanaTimezones().map((z) => (
                <MenuItem key={z} value={z}>
                  {z}
                </MenuItem>
              ))}
            </Field>
          </Grid>
          {isSuper ? (
            <>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel id="biz-seg-lbl">{i18n.t("settings.company.form.businessSegment")}</InputLabel>
                  <Field name="businessSegment">
                    {({ field }) => (
                      <Select
                        labelId="biz-seg-lbl"
                        label={i18n.t("settings.company.form.businessSegment")}
                        {...field}
                        value={field.value || "general"}
                      >
                        {BUSINESS_SEGMENTS.map((s) => (
                          <MenuItem key={s.value} value={s.value}>
                            {i18n.t(s.labelKey)}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </Field>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={8}>
                <FormControl component="fieldset" margin="dense" fullWidth>
                  <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                    {i18n.t("settings.company.crmVisibility.label")}
                  </Typography>
                  <Field name="crmVisibilityMode">
                    {({ field }) => (
                      <RadioGroup row {...field} value={field.value || "all"}>
                        <FormControlLabel
                          value="all"
                          control={<Radio color="primary" />}
                          label={i18n.t("settings.company.crmVisibility.optionAll")}
                        />
                        <FormControlLabel
                          value="assigned"
                          control={<Radio color="primary" />}
                          label={i18n.t("settings.company.crmVisibility.optionAssigned")}
                        />
                      </RadioGroup>
                    )}
                  </Field>
                </FormControl>
              </Grid>
              {companyId ? (
                <Grid item xs={12} md={4}>
                  <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 8 }}>
                    {i18n.t("settings.company.form.bootstrapCrmHint")}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    disabled={bootstrapping}
                    onClick={handleBootstrapCrm}
                  >
                    {i18n.t("settings.company.form.bootstrapCrm")}
                  </Button>
                </Grid>
              ) : null}
            </>
          ) : null}
        </Grid>
      </AppSectionCard>

      {/* Armazenamento */}
      {isSuper ? (
        <AppSectionCard>
          <SectionHeader
            title={i18n.t("platform.companies.storageSectionTitle")}
            hint={i18n.t("platform.companies.storageSectionHint")}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8} md={6}>
              <Field name="storageLimitGbStr">
                {({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    label={i18n.t("platform.companies.storageLimitLabel")}
                    helperText={i18n.t("platform.companies.storageLimitHelper")}
                  />
                )}
              </Field>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary" component="div">
                <div style={{ marginBottom: 4 }}>
                  {i18n.t("platform.companies.storagePreviewPlan", {
                    value:
                      selectedPlan?.storageLimitGb != null && selectedPlan?.storageLimitGb !== ""
                        ? `${String(selectedPlan.storageLimitGb).replace(".", ",")} GB`
                        : i18n.t("platform.companies.storageNoPlanLimit"),
                  })}
                </div>
                <div style={{ marginBottom: 4 }}>
                  {i18n.t("platform.companies.storagePreviewUsage", {
                    used: formik.values.storageUsedFormatted || "—",
                    limit:
                      formik.values.storageLimitFormatted ||
                      i18n.t("platform.companies.storageUnlimitedLabel"),
                  })}
                </div>
              </Typography>
            </Grid>
            {companyId ? (
              <Grid item xs={12}>
                <AppSecondaryButton
                  type="button"
                  startIcon={<Autorenew />}
                  disabled={loading || recalculating}
                  onClick={handleRecalculate}
                >
                  {i18n.t("platform.companies.storageRecalculate")}
                </AppSecondaryButton>
              </Grid>
            ) : null}
            {companyId && storageSnapshots.length > 0 ? (
              <Grid item xs={12}>
                <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 6 }}>
                  {i18n.t("platform.companies.storageHistoryTitle")}
                </Typography>
                <Box component="ul" style={{ paddingLeft: 18, margin: 0 }}>
                  {storageSnapshots.slice(0, 12).map((s) => (
                    <li key={s.id} style={{ marginBottom: 4 }}>
                      <Typography variant="caption" component="span" color="textSecondary">
                        {moment(s.createdAt).format("DD/MM/YYYY HH:mm")} —{" "}
                        {i18n.t(`platform.companies.storageSnapshotReason.${s.reason}`)} —{" "}
                        {formatStorageBytesBrief(s.usedBytes)}
                        {s.usagePercent != null && Number(s.limitBytes) > 0
                          ? ` (${Number(s.usagePercent).toFixed(1)}%)`
                          : ""}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </Grid>
            ) : null}
          </Grid>
        </AppSectionCard>
      ) : null}

      <CompanyPlanChangeDialog
        open={Boolean(planChangeCtx)}
        onClose={(event, reason) => {
          if (reason !== "backdropClick" && reason !== "escapeKeyDown") return;
          if (planChangeCtx) formik.setFieldValue("planId", planChangeCtx.prevPlanId);
          setPlanChangeCtx(null);
        }}
        onKeepModules={() => {
          if (!planChangeCtx) return;
          formik.setFieldValue("modulePermissions", planChangeCtx.modulesBefore);
          if (planChangeCtx.newPlan?.id != null) formik.setFieldValue("planId", planChangeCtx.newPlan.id);
          setPlanChangeCtx(null);
        }}
        onApplyPlanModules={() => {
          if (!planChangeCtx) return;
          formik.setFieldValue(
            "modulePermissions",
            mergeModulePermissionsFromPlan(planChangeCtx.newPlan, planChangeCtx.modulesBefore)
          );
          if (planChangeCtx.newPlan?.id != null) formik.setFieldValue("planId", planChangeCtx.newPlan.id);
          setPlanChangeCtx(null);
        }}
      />
    </Box>
  );
}
