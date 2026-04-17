import React, { useState, useEffect, useMemo } from "react";
import {
    makeStyles,
    useTheme,
    Paper,
    Grid,
    TextField,
    Table,
    TableHead,
    TableBody,
    TableCell,
    TableRow,
    IconButton,
    Typography,
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    InputAdornment,
    Tooltip,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import { Formik, Form, Field } from 'formik';
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { Edit as EditIcon } from "@material-ui/icons";

import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";
import {
    AppSectionCard,
    AppTableContainer,
    AppPrimaryButton,
    AppEmptyState,
    AppLoadingState,
} from "../../ui";
import ModuleToggleCard from "../ModuleSettings/ModuleToggleCard";
import PlanModuleSaveDialog from "../ModuleSettings/PlanModuleSaveDialog";
import {
  PLAN_FORM_MODULE_KEYS,
  diffPlanModuleFlags,
} from "../ModuleSettings/moduleSync";


const useStyles = makeStyles(theme => ({
    root: {
        width: '100%'
    },
    mainPaper: {
        width: '100%',
        flex: 1,
        padding: theme.spacing(2)
    },
    fullWidth: {
        width: '100%'
    },
    tableContainer: {
        width: '100%',
        overflowX: "scroll",
        ...theme.scrollbarStyles
    },
    textfield: {
        width: '100%'
    },
    textRight: {
        textAlign: 'right'
    },
    row: {
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2)
    },
    control: {
        paddingRight: theme.spacing(1),
        paddingLeft: theme.spacing(1)
    },
    buttonContainer: {
        textAlign: 'right',
        padding: theme.spacing(1)
    },
    platformSectionTitle: {
        fontWeight: 600,
        fontSize: "1.125rem",
        marginBottom: theme.spacing(1),
    },
    modulesSectionTitle: {
        fontWeight: 600,
        fontSize: "1rem",
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(0.75),
    },
    modulesSectionHint: {
        marginBottom: theme.spacing(2),
        lineHeight: 1.55,
        maxWidth: 720,
    },
    modulesWrap: {
        marginTop: theme.spacing(2),
        paddingTop: theme.spacing(2),
        borderTop: `1px solid ${theme.palette.divider}`,
    },
    pageStack: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(3),
        width: "100%",
    },
    sectionTitle: {
        fontWeight: 600,
        fontSize: "1.125rem",
        lineHeight: 1.35,
        letterSpacing: "-0.01em",
        marginBottom: theme.spacing(0.75),
        color: theme.palette.text.primary,
    },
    registeredSectionSubtitle: {
        marginBottom: theme.spacing(2),
        lineHeight: 1.55,
        maxWidth: 720,
    },
    tableToolbar: {
        display: "flex",
        flexWrap: "wrap",
        gap: theme.spacing(2),
        marginBottom: theme.spacing(2),
        alignItems: "center",
    },
    tableHeadCell: {
        fontWeight: 600,
        fontSize: "0.7rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: theme.palette.text.secondary,
        borderBottom: `2px solid ${theme.palette.divider}`,
    },
    tableRow: {
        cursor: "pointer",
        transition: theme.transitions.create("background-color", {
            duration: 150,
        }),
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
}));

export function PlanManagerForm(props) {
    const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
    const classes = useStyles()

    const [record, setRecord] = useState({
        name: '',
        users: 0,
        connections: 0,
        queues: 0,
        value: 0,
        useCampaigns: true,
        useSchedules: true,
        useInternalChat: true,
        useExternalApi: true,
        useKanban: true,
        useOpenAi: true,
        useIntegrations: true,
    });

    useEffect(() => {
        setRecord(initialValue)
    }, [initialValue])

    const planModuleTitle = (key) =>
        key === "useInternalChat"
            ? i18n.t("plans.form.internalChat")
            : i18n.t(`settings.company.form.modules.${key}`);

    const planModuleDescription = (key) =>
        key === "useInternalChat"
            ? i18n.t("plans.form.internalChatHelp")
            : i18n.t(`settings.company.form.modules.${key}Help`);

    return (
        <Formik
            enableReinitialize
            className={classes.fullWidth}
            initialValues={record}
            onSubmit={async (values, { setSubmitting }) => {
                try {
                    await onSubmit(values);
                } finally {
                    setSubmitting(false);
                }
            }}
        >
            {() => (
                <Form className={classes.fullWidth}>
                    <Grid spacing={1} justifyContent="flex-start" container>
                        <Grid xs={12} sm={6} md={2} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.name")}
                                name="name"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                            />
                        </Grid>
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.users")}
                                name="users"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.connections")}
                                name="connections"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.queues")}
                                name="queues"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>
                        <Grid xs={12} sm={6} md={1} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.value")}
                                name="value"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="text"
                            />
                        </Grid>
                    </Grid>

                    <Box className={classes.modulesWrap}>
                        <Typography
                            component="h3"
                            className={classes.modulesSectionTitle}
                        >
                            {i18n.t("plans.form.modulesSectionTitle")}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="textSecondary"
                            className={classes.modulesSectionHint}
                        >
                            {i18n.t("plans.form.modulesSectionHint")}
                        </Typography>
                        <Grid container spacing={2}>
                            {PLAN_FORM_MODULE_KEYS.map((key) => (
                                <Grid item xs={12} md={6} key={key}>
                                    <Field name={key}>
                                        {({ field, form }) => (
                                            <ModuleToggleCard
                                                title={planModuleTitle(key)}
                                                description={planModuleDescription(key)}
                                                checked={field.value !== false}
                                                onChange={(e) =>
                                                    form.setFieldValue(
                                                        field.name,
                                                        e.target.checked
                                                    )
                                                }
                                                inputProps={{
                                                    "aria-label": planModuleTitle(key),
                                                }}
                                            />
                                        )}
                                    </Field>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <Grid spacing={2} justifyContent="flex-end" container>

                        <Grid sm={3} md={2} item>
                            <ButtonWithSpinner className={classes.fullWidth} loading={loading} onClick={() => onCancel()} variant="contained">
                                {i18n.t("plans.form.clear")}
                            </ButtonWithSpinner>
                        </Grid>
                        {record.id !== undefined ? (
                            <Grid sm={3} md={2} item>
                                <ButtonWithSpinner className={classes.fullWidth} loading={loading} onClick={() => onDelete(record)} variant="contained" color="secondary">
                                    {i18n.t("plans.form.delete")}
                                </ButtonWithSpinner>
                            </Grid>
                        ) : null}
                        <Grid sm={3} md={2} item>
                            <ButtonWithSpinner className={classes.fullWidth} loading={loading} type="submit" variant="contained" color="primary">
                                {i18n.t("plans.form.save")}
                            </ButtonWithSpinner>
                        </Grid>
                    </Grid>
                </Form>
            )}
        </Formik>
    )
}

export function PlansManagerGrid(props) {
    const {
        records,
        onSelect,
        variant = "settings",
        onNewPlan,
        selectedId,
        loading,
    } = props;
    const classes = useStyles();
    const theme = useTheme();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("name");

    const filteredRecords = useMemo(() => {
        let list = Array.isArray(records) ? [...records] : [];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((row) =>
                (row.name || "").toLowerCase().includes(q)
            );
        }
        if (sortBy === "name") {
            list.sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", undefined, {
                    sensitivity: "base",
                })
            );
        } else if (sortBy === "value") {
            list.sort(
                (a, b) =>
                    (Number(a.value) || 0) - (Number(b.value) || 0)
            );
        }
        return list;
    }, [records, search, sortBy]);

    const renderCampaigns = (row) => {
        return row.useCampaigns === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderSchedules = (row) => {
        return row.useSchedules === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderInternalChat = (row) => {
        return row.useInternalChat === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderExternalApi = (row) => {
        return row.useExternalApi === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderKanban = (row) => {
        return row.useKanban === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderOpenAi = (row) => {
        return row.useOpenAi === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const renderIntegrations = (row) => {
        return row.useIntegrations === false ? `${i18n.t("plans.form.no")}` : `${i18n.t("plans.form.yes")}`;
    };

    const isPlatform = variant === "platform";
    const headCls = isPlatform ? classes.tableHeadCell : undefined;

    const table = (
        <Table
            className={classes.fullWidth}
            padding="none"
            size={variant === "platform" ? "small" : "medium"}
            aria-label={i18n.t("plans.table.aria")}
        >
            <TableHead>
                <TableRow>
                    <TableCell align="center" style={{ width: "1%" }} className={headCls}>
                        #
                    </TableCell>
                    <TableCell align="left" className={headCls}>
                        {i18n.t("plans.form.name")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.table.companies")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.users")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.connections")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.queues")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.value")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.campaigns")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.schedules")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.internalChat")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.externalApi")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.kanban")}
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        Open.Ai
                    </TableCell>
                    <TableCell align="center" className={headCls}>
                        {i18n.t("plans.form.integrations")}
                    </TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {filteredRecords.map((row) => {
                    const isSelected =
                        isPlatform &&
                        selectedId != null &&
                        row.id === selectedId;
                    const rowStyle =
                        isPlatform && isSelected
                            ? {
                                  boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
                              }
                            : undefined;
                    return (
                        <TableRow
                            key={row.id}
                            className={
                                isPlatform
                                    ? `${classes.tableRow} ${
                                          isSelected ? classes.tableRowSelected : ""
                                      }`
                                    : undefined
                            }
                            onClick={isPlatform ? () => onSelect(row) : undefined}
                            selected={Boolean(isSelected)}
                            style={rowStyle}
                        >
                            <TableCell
                                align="center"
                                style={{ width: "1%" }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                <Tooltip
                                    title={i18n.t("platform.companies.editRow")}
                                    arrow
                                    enterDelay={300}
                                >
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelect(row);
                                        }}
                                        aria-label={i18n.t(
                                            "platform.companies.editRow"
                                        )}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="left">{row.name || "-"}</TableCell>
                            <TableCell align="center">
                                {row.companiesCount != null
                                    ? row.companiesCount
                                    : "—"}
                            </TableCell>
                            <TableCell align="center">{row.users || "-"}</TableCell>
                            <TableCell align="center">
                                {row.connections || "-"}
                            </TableCell>
                            <TableCell align="center">{row.queues || "-"}</TableCell>
                            <TableCell align="center">
                                {i18n.t("plans.form.money")}{" "}
                                {row.value
                                    ? row.value.toLocaleString("pt-br", {
                                          minimumFractionDigits: 2,
                                      })
                                    : "00.00"}
                            </TableCell>
                            <TableCell align="center">
                                {renderCampaigns(row)}
                            </TableCell>
                            <TableCell align="center">
                                {renderSchedules(row)}
                            </TableCell>
                            <TableCell align="center">
                                {renderInternalChat(row)}
                            </TableCell>
                            <TableCell align="center">
                                {renderExternalApi(row)}
                            </TableCell>
                            <TableCell align="center">{renderKanban(row)}</TableCell>
                            <TableCell align="center">{renderOpenAi(row)}</TableCell>
                            <TableCell align="center">
                                {renderIntegrations(row)}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );

    if (variant === "platform") {
        const showInitialLoading = loading && (!records || records.length === 0);
        const emptyCatalog =
            !loading && (!records || records.length === 0);
        const emptyFiltered =
            !loading &&
            records &&
            records.length > 0 &&
            filteredRecords.length === 0;

        return (
            <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                    {i18n.t("platform.plans.registeredListTitle")}
                </Typography>
                <Typography
                    variant="body2"
                    color="textSecondary"
                    className={classes.registeredSectionSubtitle}
                >
                    {i18n.t("platform.plans.registeredListSubtitle")}
                </Typography>
                <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    style={{ marginBottom: 16 }}
                >
                    {i18n.t("platform.plans.listRowHint")}
                </Typography>
                <Box className={classes.tableToolbar}>
                    {typeof onNewPlan === "function" ? (
                        <AppPrimaryButton
                            type="button"
                            onClick={onNewPlan}
                            style={{ flexShrink: 0 }}
                        >
                            {i18n.t("platform.plans.newPlan")}
                        </AppPrimaryButton>
                    ) : null}
                    <TextField
                        size="small"
                        variant="outlined"
                        placeholder={i18n.t("platform.plans.searchPlaceholder")}
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
                    <FormControl
                        variant="outlined"
                        size="small"
                        style={{ minWidth: 200 }}
                    >
                        <InputLabel id="plans-sort-label">
                            {i18n.t("platform.plans.sortLabel")}
                        </InputLabel>
                        <Select
                            labelId="plans-sort-label"
                            label={i18n.t("platform.plans.sortLabel")}
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <MenuItem value="name">
                                {i18n.t("platform.plans.sortByName")}
                            </MenuItem>
                            <MenuItem value="value">
                                {i18n.t("platform.plans.sortByValue")}
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Box>
                {showInitialLoading ? (
                    <AppLoadingState
                        message={i18n.t("platform.plans.listLoading")}
                    />
                ) : emptyCatalog ? (
                    <AppEmptyState
                        title={i18n.t("platform.plans.emptyListTitle")}
                        description={i18n.t("platform.plans.emptyListSubtitle")}
                    >
                        {typeof onNewPlan === "function" ? (
                            <AppPrimaryButton
                                type="button"
                                onClick={onNewPlan}
                            >
                                {i18n.t("platform.plans.newPlan")}
                            </AppPrimaryButton>
                        ) : null}
                    </AppEmptyState>
                ) : emptyFiltered ? (
                    <AppEmptyState
                        title={i18n.t("platform.plans.noSearchResults")}
                    />
                ) : (
                    <AppTableContainer nested className={classes.tableContainer}>
                        {table}
                    </AppTableContainer>
                )}
            </AppSectionCard>
        );
    }

    return <Paper className={classes.tableContainer}>{table}</Paper>;
}

const defaultPlanRecord = () => ({
    name: "",
    users: 0,
    connections: 0,
    queues: 0,
    value: 0,
    useCampaigns: true,
    useSchedules: true,
    useInternalChat: true,
    useExternalApi: true,
    useKanban: true,
    useOpenAi: true,
    useIntegrations: true,
});

export default function PlansManager({ variant = "settings" }) {
    const classes = useStyles();
    const { list, save, update, remove } = usePlans();

    const [planSaveDialog, setPlanSaveDialog] = useState({
        open: false,
        data: null,
        diff: [],
    });
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [record, setRecord] = useState(() => defaultPlanRecord());

    useEffect(() => {
        loadPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadPlans = async () => {
        setLoading(true)
        try {
            const planList = await list()
            setRecords(planList)
        } catch (e) {
            toast.error(i18n.t("plans.toasts.errorList"))
        }
        setLoading(false)
    }

    const PROP_MODE_API = {
        none: "none",
        respectOverride: "respect_overrides",
        forceAll: "force_all",
    };

    const toApiPropagationMode = (pmUi) => {
        if (pmUi === undefined || pmUi === null) return "none";
        if (Object.prototype.hasOwnProperty.call(PROP_MODE_API, pmUi)) {
            return PROP_MODE_API[pmUi];
        }
        if (
            pmUi === "none" ||
            pmUi === "respect_overrides" ||
            pmUi === "force_all"
        ) {
            return pmUi;
        }
        return "none";
    };

    const executePlanSave = async (data) => {
        setLoading(true)
        try {
            let response;
            if (data.id !== undefined) {
                const { propagationMode: pmUi, ...planFields } = data;
                response = await update({
                    ...planFields,
                    propagationMode: toApiPropagationMode(pmUi),
                });
            } else {
                const { propagationMode: _ignored, ...createData } = data;
                response = await save(createData);
            }
            await loadPlans()
            handleCancel()
            const prop = response?.propagation;
            if (prop?.applied) {
                if (prop.companiesUpdated > 0) {
                    toast.success(
                        i18n.t("platform.plans.moduleSave.propagationSuccess", {
                            count: prop.companiesUpdated,
                        })
                    );
                } else {
                    toast.success(
                        i18n.t("platform.plans.moduleSave.propagationNoCompaniesUpdated")
                    );
                }
            } else {
                toast.success(i18n.t("plans.toasts.success"));
            }
        } catch (e) {
            toast.error(i18n.t("plans.toasts.error"))
        }
        setLoading(false)
    }

    const handleSubmitRequest = async (data) => {
        const diff = diffPlanModuleFlags(record, data, PLAN_FORM_MODULE_KEYS)
        if (data.id !== undefined && diff.length > 0) {
            setPlanSaveDialog({ open: true, data, diff })
            return
        }
        await executePlanSave(data)
    }

    const handlePlanSavePropagation = async (mode) => {
        const payload = planSaveDialog.data
        if (!payload) {
            setPlanSaveDialog({ open: false, data: null, diff: [] })
            return
        }
        setPlanSaveDialog({ open: false, data: null, diff: [] })
        const propagationMode =
            mode === "respectOverride" || mode === "forceAll" || mode === "none"
                ? mode
                : "none";
        await executePlanSave({ ...payload, propagationMode })
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await remove(record.id)
            await loadPlans()
            handleCancel()
            toast.success(i18n.t("plans.toasts.success"))
        } catch (e) {
            toast.error(i18n.t("plans.toasts.errorOperation"))
        }
        setLoading(false)
    }

    const handleOpenDeleteDialog = () => {
        setShowConfirmDialog(true)
    }

    const handleCancel = () => {
        setRecord(defaultPlanRecord());
        if (variant === "platform") {
            setFormOpen(false);
        }
    };

    const handleNewPlan = () => {
        setRecord(defaultPlanRecord());
        setFormOpen(true);
    };

    const handleSelect = (data) => {
        let useCampaigns = data.useCampaigns === false ? false : true;
        let useSchedules = data.useSchedules === false ? false : true;
        let useInternalChat = data.useInternalChat === false ? false : true;
        let useExternalApi = data.useExternalApi === false ? false : true;
        let useKanban = data.useKanban === false ? false : true;
        let useOpenAi = data.useOpenAi === false ? false : true;
        let useIntegrations = data.useIntegrations === false ? false : true;

        setRecord({
            id: data.id,
            name: data.name || "",
            users: data.users || 0,
            connections: data.connections || 0,
            queues: data.queues || 0,
            value:
                data.value?.toLocaleString("pt-br", {
                    minimumFractionDigits: 0,
                }) || 0,
            useCampaigns,
            useSchedules,
            useInternalChat,
            useExternalApi,
            useKanban,
            useOpenAi,
            useIntegrations,
        });
        if (variant === "platform") {
            setFormOpen(true);
        }
    };

    const formBlock = (
        <PlanManagerForm
            initialValue={record}
            onDelete={handleOpenDeleteDialog}
            onSubmit={handleSubmitRequest}
            onCancel={handleCancel}
            loading={loading}
        />
    );

    const gridBlock = (
        <PlansManagerGrid
            records={records}
            onSelect={handleSelect}
            variant={variant}
            onNewPlan={variant === "platform" ? handleNewPlan : undefined}
            selectedId={variant === "platform" && formOpen ? record.id : undefined}
            loading={loading}
        />
    );

    if (variant === "platform") {
        return (
            <Box className={classes.pageStack}>
                {gridBlock}
                {formOpen ? (
                    <>
                        {record.id !== undefined ? (
                            <Box className={classes.editingBanner}>
                                <Typography
                                    className={classes.editingBannerTitle}
                                    component="p"
                                >
                                    {i18n.t("platform.plans.editingBanner", {
                                        name: record.name || "—",
                                    })}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    className={classes.editingBannerHint}
                                    component="p"
                                >
                                    {i18n.t("platform.plans.editingContextHint")}
                                </Typography>
                            </Box>
                        ) : null}
                        <AppSectionCard>
                            <Typography
                                className={classes.platformSectionTitle}
                                component="h2"
                            >
                                {i18n.t("platform.plans.formSectionTitle")}
                            </Typography>
                            {formBlock}
                        </AppSectionCard>
                    </>
                ) : null}
                <ConfirmationModal
                    title={i18n.t("plans.confirm.title")}
                    open={showConfirmDialog}
                    onClose={() => setShowConfirmDialog(false)}
                    onConfirm={() => handleDelete()}
                >
                    {i18n.t("plans.confirm.message")}
                </ConfirmationModal>
                <PlanModuleSaveDialog
                    open={planSaveDialog.open}
                    onClose={() =>
                        setPlanSaveDialog({ open: false, data: null, diff: [] })
                    }
                    diff={planSaveDialog.diff || []}
                    loading={loading}
                    onChoose={handlePlanSavePropagation}
                />
            </Box>
        );
    }

    return (
        <Paper className={classes.mainPaper} elevation={0}>
            <Grid spacing={2} container>
                <Grid xs={12} item>
                    {formBlock}
                </Grid>
                <Grid xs={12} item>
                    {gridBlock}
                </Grid>
            </Grid>
            <ConfirmationModal
                title={i18n.t("plans.confirm.title")}
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={() => handleDelete()}
            >
                {i18n.t("plans.confirm.message")}
            </ConfirmationModal>
            <PlanModuleSaveDialog
                open={planSaveDialog.open}
                onClose={() =>
                    setPlanSaveDialog({ open: false, data: null, diff: [] })
                }
                diff={planSaveDialog.diff || []}
                loading={loading}
                onChoose={handlePlanSavePropagation}
            />
        </Paper>
    );
}