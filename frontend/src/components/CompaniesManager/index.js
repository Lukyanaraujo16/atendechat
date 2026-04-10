import React, { useState, useEffect, useMemo } from "react";
import {
  makeStyles,
  Box,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  Select,
  Switch,
  Typography,
  CircularProgress,
  Chip,
  InputAdornment,
  Button,
  Tooltip,
  IconButton,
} from "@material-ui/core";
import { useTheme, alpha } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import EditOutlined from "@material-ui/icons/EditOutlined";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import { Formik, Form, Field } from "formik";
import ConfirmationModal from "../ConfirmationModal";

import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import ModalUsers from "../ModalUsers";
import api from "../../services/api";
import { head, isArray, has } from "lodash";
import { useDate } from "../../hooks/useDate";

import moment from "moment";
import { i18n } from "../../translate/i18n";
import { getIanaTimezones } from "../../utils/ianaTimezones";

import {
  AppSectionCard,
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";

const defaultModulePermissions = () => ({
  useKanban: true,
  useCampaigns: true,
  useFlowbuilders: true,
  useOpenAi: true,
  useSchedules: true,
  useExternalApi: true,
  useIntegrations: true,
  useGroups: true,
});

const mergeModulePermissions = (raw) => ({
  ...defaultModulePermissions(),
  ...(raw && typeof raw === "object" ? raw : {}),
});

const MODULE_TOGGLE_KEYS = [
  "useKanban",
  "useCampaigns",
  "useFlowbuilders",
  "useOpenAi",
  "useSchedules",
  "useExternalApi",
  "useIntegrations",
  "useGroups",
];

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  mainPaper: {
    width: "100%",
    flex: 1,
    padding: theme.spacing(2),
  },
  fullWidth: {
    width: "100%",
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "1.125rem",
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
    marginBottom: theme.spacing(0.75),
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    marginBottom: theme.spacing(2.5),
    lineHeight: 1.6,
    maxWidth: 720,
  },
  moduleCard: {
    height: "100%",
    padding: theme.spacing(2, 2, 2, 2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : theme.palette.grey[50],
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 200,
    }),
    "&:hover": {
      borderColor: alpha(theme.palette.primary.main, 0.35),
      boxShadow:
        theme.palette.type === "light"
          ? "0 1px 8px rgba(15, 23, 42, 0.06)"
          : "none",
    },
  },
  moduleRowInner: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    width: "100%",
  },
  moduleRowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: theme.spacing(0.5),
  },
  moduleTitle: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    lineHeight: 1.4,
    marginBottom: theme.spacing(0.5),
  },
  moduleDescription: {
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: theme.palette.text.secondary,
    opacity: 0.92,
  },
  usersScroll: {
    maxHeight: 280,
    overflow: "auto",
    ...theme.scrollbarStyles,
  },
  tableContainer: {
    width: "100%",
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
  tableToolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    alignItems: "center",
  },
  tableRow: {
    cursor: "pointer",
    transition: theme.transitions.create("background-color", { duration: 150 }),
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.05)"
          : theme.palette.action.hover,
    },
  },
  tableRowSelected: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(25, 118, 210, 0.16)"
        : theme.palette.action.selected,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(25, 118, 210, 0.22)"
          : theme.palette.action.selected,
    },
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  actionGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  dangerZone: {
    paddingRight: theme.spacing(2),
    marginRight: theme.spacing(0.5),
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  dangerDeleteButton: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    fontWeight: 600,
    textTransform: "none",
    letterSpacing: "0.01em",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    "&:hover": {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: theme.palette.error.dark,
      color: theme.palette.error.dark,
      backgroundColor: alpha(theme.palette.error.main, 0.08),
    },
  },
  rightActions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(2),
  },
  editingBanner: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.primary.main, 0.06),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
    borderLeftWidth: 4,
    borderLeftColor: theme.palette.primary.main,
    borderLeftStyle: "solid",
  },
  editingBannerTitle: {
    fontWeight: 600,
    fontSize: "1.0625rem",
    lineHeight: 1.4,
    color: theme.palette.text.primary,
  },
  editingBannerHint: {
    marginTop: theme.spacing(0.75),
    lineHeight: 1.5,
    fontSize: "0.8125rem",
  },
  tableHeadCell: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
  statusChipActive: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.success.main, 0.16),
    color: theme.palette.success.dark,
    border: "none",
  },
  statusChipInactive: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.grey[600], 0.12),
    color: theme.palette.text.secondary,
    border: "none",
  },
  userOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginRight: theme.spacing(1),
  },
  userProfileChip: {
    fontWeight: 500,
    maxWidth: "100%",
  },
  registeredSectionSubtitle: {
    marginBottom: theme.spacing(2),
    lineHeight: 1.55,
    maxWidth: 560,
  },
}));

export function CompanyForm(props) {
  const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
  const classes = useStyles();
  const theme = useTheme();
  const [plans, setPlans] = useState([]);
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [record, setRecord] = useState(() => ({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
    timezone: "America/Sao_Paulo",
    ...initialValue,
    modulePermissions: mergeModulePermissions(initialValue?.modulePermissions),
  }));

  const { list: listPlans } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecord((prev) => {
      if (moment(initialValue).isValid()) {
        initialValue.dueDate = moment(initialValue.dueDate).format(
          "YYYY-MM-DD"
        );
      }
      return {
        ...prev,
        ...initialValue,
        modulePermissions: mergeModulePermissions(initialValue?.modulePermissions),
      };
    });
  }, [initialValue]);

  const handleSubmit = async (data) => {
    if (data.dueDate === "" || moment(data.dueDate).isValid() === false) {
      data.dueDate = null;
    }
    onSubmit(data);
    setRecord({ ...initialValue, dueDate: "" });
  };

  const handleOpenModalUsers = async () => {
    try {
      const { data } = await api.get("/users/list", {
        params: {
          companyId: initialValue.id,
        },
      });
      if (isArray(data) && data.length) {
        setFirstUser(head(data));
      }
      setModalUser(true);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const companyIdForUsers = initialValue && initialValue.id;

  useEffect(() => {
    if (!companyIdForUsers) {
      setCompanyUsers([]);
      return undefined;
    }
    let cancelled = false;
    setUsersLoading(true);
    api
      .get("/users/list", { params: { companyId: companyIdForUsers } })
      .then(({ data }) => {
        if (!cancelled) setCompanyUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCompanyUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyIdForUsers]);

  const formatUserProfile = (profile) => {
    const key = `users.profileLabels.${profile}`;
    const t = i18n.t(key);
    return t !== key ? t : profile || "—";
  };

  const formatUserOnline = (online) =>
    online
      ? i18n.t("users.online.yes")
      : i18n.t("users.online.no");

  const profileChipColor = (profile) => {
    const p = (profile || "").toLowerCase();
    if (p === "admin") return "primary";
    if (p === "supervisor") return "secondary";
    return "default";
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL":
          data.dueDate = moment(data.dueDate)
            .add(1, "month")
            .format("YYYY-MM-DD");
          break;
        case "BIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(2, "month")
            .format("YYYY-MM-DD");
          break;
        case "TRIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(3, "month")
            .format("YYYY-MM-DD");
          break;
        case "SEMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(6, "month")
            .format("YYYY-MM-DD");
          break;
        case "ANUAL":
          data.dueDate = moment(data.dueDate)
            .add(12, "month")
            .format("YYYY-MM-DD");
          break;
        default:
          break;
      }
    }
    setRecord(data);
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        onSubmit={(values, { resetForm }) =>
          setTimeout(() => {
            handleSubmit(values);
            resetForm();
          }, 500)
        }
      >
        {() => (
          <Form className={classes.fullWidth}>
            <Box className={classes.formStack}>
              {/* Bloco 1 — Dados da empresa */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.sectionCompanyData")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.sectionCompanyDataHint")}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.name")}
                      name="name"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.emailMain")}
                      name="email"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.phone")}
                      name="phone"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                    />
                  </Grid>
                  {initialValue && initialValue.id ? (
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        margin="dense"
                        variant="outlined"
                        label={i18n.t("settings.company.form.primaryAdmin")}
                        value={
                          initialValue.primaryAdmin
                            ? `${initialValue.primaryAdmin.name || "—"} (${initialValue.primaryAdmin.email || "—"})`
                            : i18n.t("settings.company.form.noPrimaryAdmin")
                        }
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                  ) : null}
                </Grid>
              </AppSectionCard>

              {/* Bloco 2 — Plano e operação (sem Campanhas: controlado em Módulos) */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.sectionPlanOperation")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.sectionPlanOperationHint")}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="plan-selection">
                        {i18n.t("settings.company.form.plan")}
                      </InputLabel>
                      <Field
                        as={Select}
                        id="plan-selection"
                        label={i18n.t("settings.company.form.plan")}
                        labelId="plan-selection-label"
                        name="planId"
                        margin="dense"
                        required
                      >
                        {plans.map((plan, key) => (
                          <MenuItem key={key} value={plan.id}>
                            {plan.name}
                          </MenuItem>
                        ))}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="status-selection">
                        {i18n.t("settings.company.form.status")}
                      </InputLabel>
                      <Field
                        as={Select}
                        id="status-selection"
                        label={i18n.t("settings.company.form.status")}
                        labelId="status-selection-label"
                        name="status"
                        margin="dense"
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
                      className={classes.fullWidth}
                      margin="dense"
                    >
                      {getIanaTimezones().map((z) => (
                        <MenuItem key={z} value={z}>
                          {z}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl variant="outlined" fullWidth>
                      <Field
                        as={TextField}
                        label={i18n.t("settings.company.form.dueDate")}
                        type="date"
                        name="dueDate"
                        InputLabelProps={{
                          shrink: true,
                        }}
                        variant="outlined"
                        fullWidth
                        margin="dense"
                      />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="recorrencia-selection">
                        {i18n.t("settings.company.form.recurrence")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("settings.company.form.recurrence")}
                        labelId="recorrencia-selection-label"
                        id="recurrence"
                        name="recurrence"
                        margin="dense"
                      >
                        <MenuItem value="MENSAL">{i18n.t("settings.company.form.monthly")}</MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>
                </Grid>
              </AppSectionCard>

              {/* Bloco 3 — Módulos liberados */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.modulesSectionTitle")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.modulesSectionHint")}
                </Typography>
                <Grid container spacing={2}>
                  {MODULE_TOGGLE_KEYS.map((key) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Box className={classes.moduleCard}>
                        <Field name={`modulePermissions.${key}`}>
                          {({ field, form }) => (
                            <Box className={classes.moduleRowInner}>
                              <Box className={classes.moduleRowText}>
                                <Typography
                                  component="div"
                                  className={classes.moduleTitle}
                                >
                                  {i18n.t(`settings.company.form.modules.${key}`)}
                                </Typography>
                                <Typography
                                  component="div"
                                  className={classes.moduleDescription}
                                >
                                  {i18n.t(`settings.company.form.modules.${key}Help`)}
                                </Typography>
                              </Box>
                              <Box pt={0.25} flexShrink={0}>
                                <Switch
                                  color="primary"
                                  checked={field.value !== false}
                                  onChange={(e) =>
                                    form.setFieldValue(field.name, e.target.checked)
                                  }
                                  inputProps={{
                                    "aria-label": i18n.t(`settings.company.form.modules.${key}`),
                                  }}
                                />
                              </Box>
                            </Box>
                          )}
                        </Field>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </AppSectionCard>

              {/* Bloco 4 — Utilizadores */}
              {initialValue && initialValue.id ? (
                <AppSectionCard>
                  <Typography className={classes.sectionTitle} component="h2">
                    {i18n.t("settings.company.form.usersSectionTitle")}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    className={classes.sectionSubtitle}
                  >
                    {i18n.t("settings.company.form.usersSectionHint")}
                  </Typography>
                  {usersLoading ? (
                    <Box display="flex" alignItems="center" py={3} justifyContent="center">
                      <CircularProgress size={32} />
                    </Box>
                  ) : companyUsers.length === 0 ? (
                    <AppEmptyState title={i18n.t("settings.company.form.usersEmpty")} />
                  ) : (
                    <Box className={classes.usersScroll}>
                      <Table size="small" aria-label={i18n.t("settings.company.form.usersSectionTitle")}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{i18n.t("users.table.name")}</TableCell>
                            <TableCell>{i18n.t("users.table.email")}</TableCell>
                            <TableCell>{i18n.t("users.table.profile")}</TableCell>
                            <TableCell>{i18n.t("users.table.online")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {companyUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell>
                                <Typography variant="body2">{u.name || "—"}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="textSecondary">
                                  {u.email || "—"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={formatUserProfile(u.profile)}
                                  color={profileChipColor(u.profile)}
                                  variant={profileChipColor(u.profile) === "default" ? "outlined" : "default"}
                                  className={classes.userProfileChip}
                                />
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center">
                                  <Box
                                    className={classes.userOnlineDot}
                                    style={{
                                      backgroundColor: u.online
                                        ? theme.palette.success.main
                                        : theme.palette.grey[400],
                                    }}
                                    aria-hidden
                                  />
                                  <Typography variant="body2" color="textSecondary" component="span">
                                    {formatUserOnline(u.online)}
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </AppSectionCard>
              ) : null}

              {/* Ações */}
              <Box className={classes.actionBar}>
                <Box className={classes.actionGroup}>
                  <AppNeutralButton type="button" onClick={() => onCancel()}>
                    {i18n.t("settings.company.buttons.clear")}
                  </AppNeutralButton>
                  {record.id !== undefined ? (
                    <>
                      <AppSecondaryButton type="button" onClick={() => handleOpenModalUsers()}>
                        {i18n.t("settings.company.buttons.manageUsers")}
                      </AppSecondaryButton>
                      <AppSecondaryButton type="button" onClick={() => incrementDueDate()}>
                        {i18n.t("settings.company.buttons.adjustDueDate")}
                      </AppSecondaryButton>
                    </>
                  ) : null}
                </Box>
                <Box className={classes.rightActions}>
                  {record.id !== undefined ? (
                    <Box className={classes.dangerZone}>
                      <Button
                        type="button"
                        variant="outlined"
                        className={classes.dangerDeleteButton}
                        startIcon={<DeleteOutline fontSize="small" />}
                        onClick={() => onDelete(record)}
                        aria-label={i18n.t("settings.company.buttons.delete")}
                      >
                        {i18n.t("settings.company.buttons.delete")}
                      </Button>
                    </Box>
                  ) : null}
                  <AppPrimaryButton type="submit" loading={loading}>
                    {i18n.t("settings.company.buttons.save")}
                  </AppPrimaryButton>
                </Box>
              </Box>
            </Box>
          </Form>
        )}
      </Formik>
    </>
  );
}

export function CompaniesManagerGrid(props) {
  const { records, onSelect, selectedId } = props;
  const classes = useStyles();
  const theme = useTheme();
  const { dateToClient } = useDate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const filteredRecords = useMemo(() => {
    let list = Array.isArray(records) ? [...records] : [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (row) =>
          (row.name || "").toLowerCase().includes(q) ||
          (row.email || "").toLowerCase().includes(q) ||
          (row.phone || "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "createdAt") {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    }
    return list;
  }, [records, search, sortBy]);

  const renderPlan = (row) => {
    return row.planId !== null ? row.plan.name : "-";
  };

  const renderCampaignsStatus = (row) => {
    if (
      has(row, "settings") &&
      isArray(row.settings) &&
      row.settings.length > 0
    ) {
      const setting = row.settings.find((s) => s.key === "campaignsEnabled");
      if (setting) {
        return setting.value === "true"
          ? i18n.t("settings.company.form.enabled")
          : i18n.t("settings.company.form.disabled");
      }
    }
    return i18n.t("settings.company.form.disabled");
  };

  const rowStyle = (record) => {
    if (moment(record.dueDate).isValid()) {
      const now = moment();
      const dueDate = moment(record.dueDate);
      const diff = dueDate.diff(now, "days");
      if (diff === 5) {
        return { backgroundColor: "#fffead" };
      }
      if (diff >= -3 && diff <= 4) {
        return { backgroundColor: "#f7cc8f" };
      }
      if (diff === -4) {
        return { backgroundColor: "#fa8c8c" };
      }
    }
    return {};
  };

  return (
    <AppSectionCard>
      <Typography className={classes.sectionTitle} component="h2">
        {i18n.t("platform.companies.registeredListTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.registeredSectionSubtitle}
      >
        {i18n.t("platform.companies.registeredListSubtitle")}
      </Typography>
      <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 16 }}>
        {i18n.t("platform.companies.listRowHint")}
      </Typography>
      <Box className={classes.tableToolbar}>
        <TextField
          size="small"
          variant="outlined"
          placeholder={i18n.t("platform.companies.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
          style={{ minWidth: 220, flex: "1 1 200px" }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
          <InputLabel id="companies-sort-label">{i18n.t("platform.companies.sortLabel")}</InputLabel>
          <Select
            labelId="companies-sort-label"
            label={i18n.t("platform.companies.sortLabel")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="name">{i18n.t("platform.companies.sortByName")}</MenuItem>
            <MenuItem value="createdAt">{i18n.t("platform.companies.sortByDate")}</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <AppTableContainer className={classes.tableContainer} nested>
        <Table className={classes.fullWidth} size="small" aria-label="companies">
          <TableHead>
            <TableRow>
              <TableCell align="center" className={classes.tableHeadCell} style={{ width: 56 }}>
                {i18n.t("platform.companies.actionsColumn")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.name")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.primaryAdmin")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.email")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.phone")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.plan")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.campanhas")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.status")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.createdAt")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell}>
                {i18n.t("settings.company.form.expire")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map((row) => {
              const dueStyle = rowStyle(row);
              const isSelected = selectedId != null && row.id === selectedId;
              const rowMergedStyle = {
                ...dueStyle,
                ...(isSelected
                  ? {
                      boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
                    }
                  : {}),
              };
              return (
                <TableRow
                  key={row.id}
                  className={`${classes.tableRow} ${isSelected ? classes.tableRowSelected : ""}`}
                  style={rowMergedStyle}
                  onClick={() => onSelect(row)}
                  selected={isSelected}
                >
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={i18n.t("platform.companies.editRow")} arrow enterDelay={300}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onSelect(row)}
                        aria-label={i18n.t("platform.companies.editRow")}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">{row.name || "-"}</TableCell>
                  <TableCell align="left">
                    {row.primaryAdmin
                      ? `${row.primaryAdmin.name || "-"} (${row.primaryAdmin.email || "-"})`
                      : i18n.t("settings.company.form.noPrimaryAdmin")}
                  </TableCell>
                  <TableCell align="left">{row.email || "-"}</TableCell>
                  <TableCell align="left">{row.phone || "-"}</TableCell>
                  <TableCell align="left">{renderPlan(row)}</TableCell>
                  <TableCell align="left">{renderCampaignsStatus(row)}</TableCell>
                  <TableCell align="left">
                    <Chip
                      size="small"
                      label={
                        row.status === false
                          ? i18n.t("platform.companies.statusInactive")
                          : i18n.t("platform.companies.statusActive")
                      }
                      classes={{
                        root:
                          row.status === false
                            ? classes.statusChipInactive
                            : classes.statusChipActive,
                      }}
                    />
                  </TableCell>
                  <TableCell align="left">{dateToClient(row.createdAt)}</TableCell>
                  <TableCell align="left">
                    {dateToClient(row.dueDate)}
                    <br />
                    <Typography variant="caption" color="textSecondary" component="span">
                      {row.recurrence}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AppTableContainer>
    </AppSectionCard>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const { list, save, update, remove } = useCompanies();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
    timezone: "America/Sao_Paulo",
    modulePermissions: defaultModulePermissions(),
    primaryAdmin: null,
  });

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      setRecords(companyList);
    } catch (e) {
      toast.error(i18n.t("settings.company.toasts.errorList"));
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (data.id !== 0 && data.id !== undefined) {
        await update(data);
      } else {
        await save(data);
      }

      await loadPlans();
      handleCancel();
      toast.success(i18n.t("settings.company.toasts.success"));
    } catch (e) {
      toast.error(
        i18n.t("settings.company.toasts.error")
      );
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadPlans();
      handleCancel();
      toast.success(i18n.t("settings.company.toasts.success"));
    } catch (e) {
      toast.error(i18n.t("settings.company.toasts.errorOperation"));
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => {
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    setRecord((prev) => ({
      ...prev,
      id: undefined,
      name: "",
      email: "",
      phone: "",
      planId: "",
      status: true,
      campaignsEnabled: false,
      dueDate: "",
      recurrence: "",
      timezone: "America/Sao_Paulo",
      modulePermissions: defaultModulePermissions(),
      primaryAdmin: null,
    }));
  };

  const handleSelect = (data) => {
    let campaignsEnabled = false;

    const setting = (data.settings || []).find(
      (s) => s.key.indexOf("campaignsEnabled") > -1
    );
    if (setting) {
      campaignsEnabled =
        setting.value === "true" || setting.value === "enabled";
    }

    setRecord((prev) => ({
      ...prev,
      id: data.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      planId: data.planId || "",
      status: data.status === false ? false : true,
      campaignsEnabled,
      dueDate: data.dueDate || "",
      recurrence: data.recurrence || "",
      timezone: data.timezone || "America/Sao_Paulo",
      modulePermissions: mergeModulePermissions(data.modulePermissions),
      primaryAdmin: data.primaryAdmin ?? null,
    }));
  };

  return (
    <Box className={classes.pageStack}>
      {record.id !== undefined ? (
        <Box className={classes.editingBanner}>
          <Typography className={classes.editingBannerTitle} component="p">
            {i18n.t("settings.company.form.editingBanner", { name: record.name || "—" })}
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            className={classes.editingBannerHint}
            component="p"
          >
            {i18n.t("settings.company.form.editingContextHint")}
          </Typography>
        </Box>
      ) : null}
      <CompanyForm
        initialValue={record}
        onDelete={handleOpenDeleteDialog}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={loading}
      />
      <CompaniesManagerGrid
        records={records}
        onSelect={handleSelect}
        selectedId={record.id}
      />
      <ConfirmationModal
        title={i18n.t("settings.company.confirmModal.title")}
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        {i18n.t("settings.company.confirmModal.confirm")}
      </ConfirmationModal>
    </Box>
  );
}
