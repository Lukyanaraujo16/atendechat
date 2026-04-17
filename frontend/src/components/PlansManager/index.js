import React, { useState, useEffect } from "react";
import {
    makeStyles,
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
} from "@material-ui/core";
import { Formik, Form, Field } from 'formik';
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { Edit as EditIcon } from "@material-ui/icons";

import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";
import { AppSectionCard, AppTableContainer } from "../../ui";
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
    platformRoot: {
        width: "100%",
        padding: theme.spacing(0),
        backgroundColor: "transparent",
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
    const { records, onSelect, variant = "settings" } = props;
    const classes = useStyles();
    
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

    const table = (
            <Table
                className={classes.fullWidth}
                padding="none"
                size={variant === "platform" ? "small" : "medium"}
                aria-label={i18n.t("plans.table.aria")}
            >
                <TableHead>
                    <TableRow>
                        <TableCell align="center" style={{ width: '1%' }}>#</TableCell>
                        <TableCell align="left">{i18n.t("plans.form.name")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.table.companies")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.users")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.connections")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.queues")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.value")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.campaigns")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.schedules")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.internalChat")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.externalApi")}</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.kanban")}</TableCell>
                        <TableCell align="center">Open.Ai</TableCell>
                        <TableCell align="center">{i18n.t("plans.form.integrations")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {records.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell align="center" style={{ width: '1%' }}>
                                <IconButton onClick={() => onSelect(row)} aria-label="edit">
                                    <EditIcon />
                                </IconButton>
                            </TableCell>
                            <TableCell align="left">{row.name || '-'}</TableCell>
                            <TableCell align="center">
                                {row.companiesCount != null ? row.companiesCount : "—"}
                            </TableCell>
                            <TableCell align="center">{row.users || '-'}</TableCell>
                            <TableCell align="center">{row.connections || '-'}</TableCell>
                            <TableCell align="center">{row.queues || '-'}</TableCell>
                            <TableCell align="center">{i18n.t("plans.form.money")} {row.value ? row.value.toLocaleString('pt-br', { minimumFractionDigits: 2 }) : '00.00'}</TableCell>
                            <TableCell align="center">{renderCampaigns(row)}</TableCell>
                            <TableCell align="center">{renderSchedules(row)}</TableCell>
                            <TableCell align="center">{renderInternalChat(row)}</TableCell>
                            <TableCell align="center">{renderExternalApi(row)}</TableCell>
                            <TableCell align="center">{renderKanban(row)}</TableCell>
                            <TableCell align="center">{renderOpenAi(row)}</TableCell>
                            <TableCell align="center">{renderIntegrations(row)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
    );

    if (variant === "platform") {
        return <AppTableContainer nested>{table}</AppTableContainer>;
    }

    return <Paper className={classes.tableContainer}>{table}</Paper>;
}

export default function PlansManager({ variant = "settings" }) {
    const classes = useStyles();
    const { list, save, update, remove } = usePlans();

    const [planSaveDialog, setPlanSaveDialog] = useState({
        open: false,
        data: null,
        diff: [],
    });
    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
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
    })

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
        setRecord({
            id: undefined,
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
            useIntegrations: true
        })
    }

    const handleSelect = (data) => {

        let useCampaigns = data.useCampaigns === false ? false : true
        let useSchedules = data.useSchedules === false ? false : true
        let useInternalChat = data.useInternalChat === false ? false : true
        let useExternalApi = data.useExternalApi === false ? false : true
        let useKanban = data.useKanban === false ? false : true
        let useOpenAi = data.useOpenAi === false ? false : true
        let useIntegrations = data.useIntegrations === false ? false : true

        setRecord({
            id: data.id,
            name: data.name || '',
            users: data.users || 0,
            connections: data.connections || 0,
            queues: data.queues || 0,
            value: data.value?.toLocaleString('pt-br', { minimumFractionDigits: 0 }) || 0,
            useCampaigns,
            useSchedules,
            useInternalChat,
            useExternalApi,
            useKanban,
            useOpenAi,
            useIntegrations
        })
    }

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
                    />
    );

    return (
        <Paper
            className={variant === "platform" ? classes.platformRoot : classes.mainPaper}
            elevation={0}
        >
            <Grid spacing={variant === "platform" ? 3 : 2} container>
                <Grid xs={12} item>
                    {variant === "platform" ? (
                        <AppSectionCard>
                            <Typography className={classes.platformSectionTitle} component="h2">
                                {i18n.t("platform.plans.formSectionTitle")}
                            </Typography>
                            {formBlock}
                        </AppSectionCard>
                    ) : (
                        formBlock
                    )}
                </Grid>
                <Grid xs={12} item>
                    {variant === "platform" ? (
                        <AppSectionCard>
                            <Typography className={classes.platformSectionTitle} component="h2">
                                {i18n.t("platform.plans.listSectionTitle")}
                            </Typography>
                            {gridBlock}
                        </AppSectionCard>
                    ) : (
                        gridBlock
                    )}
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
    )
}