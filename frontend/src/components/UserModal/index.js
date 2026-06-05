import React, { useState, useEffect, useContext, useMemo } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Alert from "@material-ui/lab/Alert";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { yupPasswordOptional, yupPasswordRequired } from "../../validators/passwordPolicy";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";
import Checkbox from "@material-ui/core/Checkbox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import usePlanFlags from "../../hooks/usePlanFlags";
import { getAllFeatureKeys, getFeatureLabel } from "../../config/features";
import {
	PERMISSION_UI_GROUPS,
	PERMISSION_PRESETS,
	applyPermissionPreset,
	applyActorCeiling,
	selectAllAllowedForActor,
	clearAllInPlan,
	keysForGroupInPlan,
} from "./permissionUiConfig";
import useIsMobile from "../../hooks/useIsMobile";
import {
	AppDialog,
	AppDialogTitle,
	AppDialogContent,
	AppDialogActions,
	AppPrimaryButton,
	AppSecondaryButton,
} from "../../ui";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
		flexWrap: "wrap",
		"& > *": {
			flex: "1 1 200px",
			minWidth: 0,
		},
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
	formControl: {
		margin: theme.spacing(1, 0),
		minWidth: 120,
		width: "100%",
	},
	maxWidth: {
		width: "100%",
	},
	divider: {
		display: "flex",
		alignItems: "center",
		marginTop: theme.spacing(2),
		marginBottom: theme.spacing(1),
		"&::before, &::after": {
			content: '""',
			flex: 1,
			borderBottom: `1px solid ${theme.palette.divider}`,
		},
	},
	dividerText: {
		paddingLeft: theme.spacing(2),
		paddingRight: theme.spacing(2),
		fontSize: "0.75rem",
		color: theme.palette.text.secondary,
		textTransform: "uppercase",
		letterSpacing: "0.08em",
	},
	multFieldLineMobile: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1),
		"& > *": {
			width: "100%",
			marginRight: 0,
		},
	},
	permissionSwitch: {
		display: "flex",
		alignItems: "flex-start",
		marginBottom: theme.spacing(0.5),
		"& .MuiFormControlLabel-label": {
			fontSize: "0.875rem",
		},
	},
}));

function buildDefaultFeaturePermissions(planMap, profile) {
	const st = {};
	if (!planMap || typeof planMap !== "object") return st;
	Object.keys(planMap).forEach(k => {
		if (planMap[k] === true) st[k] = false;
	});
	if (st["dashboard.main"] !== undefined) st["dashboard.main"] = true;
	if (st["attendance.inbox"] !== undefined) st["attendance.inbox"] = true;
	if (st["attendance.internal_chat"] !== undefined) st["attendance.internal_chat"] = true;
	if (profile === "supervisor") {
		if (st["dashboard.reports"] !== undefined) st["dashboard.reports"] = true;
		if (st["attendance.kanban"] !== undefined) st["attendance.kanban"] = true;
		if (st["contacts.tags"] !== undefined) st["contacts.tags"] = true;
		if (st["contacts.files"] !== undefined) st["contacts.files"] = true;
		if (st["team.groups"] !== undefined) st["team.groups"] = true;
		if (st["team.queues"] !== undefined) st["team.queues"] = true;
		if (st["agenda.calendar"] !== undefined) st["agenda.calendar"] = true;
		if (st["crm.pipeline"] !== undefined) st["crm.pipeline"] = true;
	}
	return st;
}

const UserModal = ({ open, onClose, userId, reload }) => {
	const classes = useStyles();
	const isMobile = useIsMobile();
	const [mobileTab, setMobileTab] = useState(0);

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user",
		allTicket: "desabled",
		featurePermissions: {},
		permissionPreset: "custom",
	};

	const { user: loggedInUser } = useContext(AuthContext);
	const planFlags = usePlanFlags();

	const actorPermCeiling = useMemo(() => {
		if (loggedInUser?.profile === "admin" || loggedInUser?.super) return null;
		if (loggedInUser?.profile === "supervisor") {
			return loggedInUser.effectiveUserFeatures || {};
		}
		return null;
	}, [loggedInUser]);

	const orderedPlanKeys = useMemo(
		() => {
			const on = planFlags.planTierEffectiveFeatures || {};
			return getAllFeatureKeys().filter(k => on[k] === true);
		},
		[planFlags.planTierEffectiveFeatures]
	);

	const [user, setUser] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
	const [whatsappId, setWhatsappId] = useState(false);
	const { loading, whatsApps } = useWhatsApps();

	const validationSchema = useMemo(
		() =>
			Yup.object().shape({
				name: Yup.string()
					.min(2, i18n.t("userModal.formErrors.name.short"))
					.max(50, i18n.t("userModal.formErrors.name.long"))
					.required(i18n.t("userModal.formErrors.name.required")),
				email: Yup.string()
					.email(i18n.t("userModal.formErrors.email.invalid"))
					.required(i18n.t("userModal.formErrors.email.required")),
				profile: Yup.string()
					.oneOf(["admin", "user", "supervisor"])
					.required(),
				allTicket: Yup.string().oneOf(["enabled", "desabled"]).required(),
				featurePermissions: Yup.object().nullable(),
				permissionPreset: Yup.string()
					.oneOf(["basic", "attendant", "supervisor", "custom"])
					.optional(),
				password: userId
					? yupPasswordOptional(i18n.t("passwordPolicy.requirements"))
					: yupPasswordRequired(
							i18n.t("passwordPolicy.requirements"),
							i18n.t("userModal.formErrors.password.required")
					  ),
			}),
		[userId]
	);

	useEffect(() => {
		if (!open || userId || !planFlags.loaded) return;
		setUser(prev => {
			const prof = prev.profile || initialState.profile;
			let fp = buildDefaultFeaturePermissions(
				planFlags.planTierEffectiveFeatures || {},
				prof
			);
			if (loggedInUser?.profile === "supervisor" && loggedInUser.effectiveUserFeatures) {
				fp = applyActorCeiling(fp, loggedInUser.effectiveUserFeatures);
			}
			return {
				...initialState,
				profile: prof,
				permissionPreset: "custom",
				featurePermissions: fp,
			};
		});
	}, [
		open,
		userId,
		planFlags.loaded,
		planFlags.planTierEffectiveFeatures,
		loggedInUser?.profile,
		loggedInUser?.effectiveUserFeatures,
	]);

	useEffect(() => {
		const fetchUser = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/users/${userId}`);
				setUser(prevState => {
					return {
						...prevState,
						...data,
						password: "",
						featurePermissions: data.featurePermissions || {},
						permissionPreset: "custom",
					};
				});
				const userQueueIds = data.queues?.map(queue => queue.id);
				setSelectedQueueIds(userQueueIds || []);
				setWhatsappId(data.whatsappId ? data.whatsappId : "");
			} catch (err) {
				toastError(err);
			}
		};

		fetchUser();
	}, [userId, open]);

	const handleClose = () => {
		onClose();
		setUser(initialState);
		setSelectedQueueIds([]);
		setWhatsappId(false);
		setMobileTab(0);
	};

	const showSection = section => !isMobile || mobileTab === section;

	const handleSaveUser = async values => {
		const { permissionPreset: _preset, ...valuesRest } = values;
		const userData = {
			...valuesRest,
			whatsappId,
			queueIds: selectedQueueIds,
			allTicket: values.allTicket,
		};
		if (userId && (!userData.password || userData.password === "")) {
			delete userData.password;
		}
		if (values.profile !== "admin" && values.featurePermissions) {
			userData.featurePermissions = values.featurePermissions;
		}
		try {
			if (userId) {
				await api.put(`/users/${userId}`, userData);
			} else {
				await api.post("/users", userData);
			}
			toast.success(i18n.t("userModal.success"));
			if (typeof reload === "function") {
				reload();
			}
			handleClose();
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<div className={classes.root}>
			<AppDialog
				open={open}
				onClose={handleClose}
				maxWidth="md"
				fullWidth
				scroll="paper"
			>
				<AppDialogTitle id="form-dialog-title">
					{userId
						? `${i18n.t("userModal.title.edit")}`
						: `${i18n.t("userModal.title.add")}`}
				</AppDialogTitle>
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={validationSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveUser(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form>
							{isMobile ? (
								<Tabs
									value={mobileTab}
									onChange={(_, v) => setMobileTab(v)}
									variant="scrollable"
									scrollButtons="auto"
									indicatorColor="primary"
									textColor="primary"
								>
									<Tab label={i18n.t("userModal.mobile.tabs.basic")} />
									<Tab label={i18n.t("userModal.mobile.tabs.queues")} />
									<Tab label={i18n.t("userModal.mobile.tabs.permissions")} />
									<Tab label={i18n.t("userModal.mobile.tabs.settings")} />
								</Tabs>
							) : null}
							<AppDialogContent dividers>
								{showSection(0) ? (
								<div className={isMobile ? classes.multFieldLineMobile : classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.name")}
										autoFocus
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.password")}
										type="password"
										name="password"
										autoComplete={userId ? "new-password" : "new-password"}
										error={touched.password && Boolean(errors.password)}
										helperText={
											(touched.password && errors.password) ||
											(userId
												? i18n.t("userModal.form.passwordOptionalEdit")
												: undefined)
										}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
								</div>
								) : null}
								{showSection(0) ? (
								<div className={isMobile ? classes.multFieldLineMobile : classes.multFieldLine}>
									<Field
										as={TextField}
										label={i18n.t("userModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										variant="outlined"
										margin="dense"
										fullWidth
									/>
									<FormControl
										variant="outlined"
										className={classes.formControl}
										margin="dense"
										fullWidth
									>
										<Can
											role={loggedInUser.profile}
											perform="user-modal:editProfile"
											yes={() => (
												<>
													<InputLabel id="profile-selection-input-label">
														{i18n.t("userModal.form.profile")}
													</InputLabel>

													<Field
														as={Select}
														label={i18n.t("userModal.form.profile")}
														name="profile"
														labelId="profile-selection-label"
														id="profile-selection"
														required
													>
														{loggedInUser.profile !== "supervisor" && (
															<MenuItem value="admin">Admin</MenuItem>
														)}
														<MenuItem value="user">User</MenuItem>
														<MenuItem value="supervisor">
															{i18n.t("userModal.form.profileSupervisor")}
														</MenuItem>
													</Field>
												</>
											)}
										/>
									</FormControl>
								</div>
								) : null}
								{showSection(1) ? (
								<>
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editQueues"
									yes={() => (
										<QueueSelect
											selectedQueueIds={selectedQueueIds}
											onChange={vals => setSelectedQueueIds(vals)}
										/>
									)}
								/>
								{!isMobile ? (
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editProfile"
									yes={() => (
										<FormControl
											variant="outlined"
											margin="dense"
											className={classes.maxWidth}
											fullWidth
										>
											<InputLabel>
												{i18n.t("userModal.form.whatsapp")}
											</InputLabel>
											<Field
												as={Select}
												value={whatsappId}
												onChange={e => setWhatsappId(e.target.value)}
												label={i18n.t("userModal.form.whatsapp")}
											>
												<MenuItem value={""}>&nbsp;</MenuItem>
												{whatsApps.map(whatsapp => (
													<MenuItem key={whatsapp.id} value={whatsapp.id}>
														{whatsapp.name}
													</MenuItem>
												))}
											</Field>
										</FormControl>
									)}
								/>
								) : null}
								</>
								) : null}

								{showSection(2) &&
								(values.profile === "user" || values.profile === "supervisor") &&
									planFlags.loaded &&
									orderedPlanKeys.length > 0 && (
										<>
											<div className={classes.divider}>
												<span className={classes.dividerText}>
													{i18n.t("userPermissions.organizedTitle")}
												</span>
											</div>
											<Alert severity="info" style={{ marginBottom: 12 }}>
												{i18n.t("userPermissions.planLimitNotice")}
											</Alert>
											<Typography
												variant="caption"
												color="textSecondary"
												component="div"
												style={{ marginBottom: 12 }}
											>
												{i18n.t("userPermissions.legacyHint")}
											</Typography>
											<FormControl
												variant="outlined"
												margin="dense"
												fullWidth
												className={classes.maxWidth}
												style={{ marginBottom: 12 }}
											>
												<InputLabel id="permission-preset-label">
													{i18n.t("userPermissions.presetProfileLabel")}
												</InputLabel>
												<Select
													labelId="permission-preset-label"
													label={i18n.t("userPermissions.presetProfileLabel")}
													name="permissionPreset"
													value={values.permissionPreset || "custom"}
													onChange={e => {
														const v = e.target.value;
														setFieldValue("permissionPreset", v);
														if (v === "custom") return;
														const plan = planFlags.planTierEffectiveFeatures || {};
														let next = applyPermissionPreset(plan, v);
														if (actorPermCeiling) {
															next = applyActorCeiling(next, actorPermCeiling);
														}
														setFieldValue("featurePermissions", next);
													}}
												>
													{PERMISSION_PRESETS.map(p => (
														<MenuItem key={p.id} value={p.id}>
															{i18n.t(p.labelKey)}
														</MenuItem>
													))}
												</Select>
											</FormControl>
											<Box
												display="flex"
												flexWrap="wrap"
												style={{ gap: 8, marginBottom: 16 }}
											>
												<Button
													size="small"
													variant="outlined"
													color="primary"
													type="button"
													onClick={() => {
														const plan = planFlags.planTierEffectiveFeatures || {};
														setFieldValue(
															"featurePermissions",
															selectAllAllowedForActor(plan, actorPermCeiling)
														);
														setFieldValue("permissionPreset", "custom");
													}}
												>
													{i18n.t("userPermissions.selectAllPlanAllowed")}
												</Button>
												<Button
													size="small"
													variant="outlined"
													type="button"
													onClick={() => {
														const plan = planFlags.planTierEffectiveFeatures || {};
														setFieldValue("featurePermissions", clearAllInPlan(plan));
														setFieldValue("permissionPreset", "custom");
													}}
												>
													{i18n.t("userPermissions.clearPermissions")}
												</Button>
												<Button
													size="small"
													variant="outlined"
													type="button"
													onClick={() => {
														const plan = planFlags.planTierEffectiveFeatures || {};
														let built = buildDefaultFeaturePermissions(
															plan,
															values.profile
														);
														if (actorPermCeiling) {
															built = applyActorCeiling(built, actorPermCeiling);
														}
														setFieldValue("featurePermissions", built);
														setFieldValue("permissionPreset", "custom");
													}}
												>
													{i18n.t("userPermissions.applyDefaultPermissions")}
												</Button>
											</Box>
											{PERMISSION_UI_GROUPS.map(group => {
												const plan = planFlags.planTierEffectiveFeatures || {};
												const keys = keysForGroupInPlan(group, plan);
												if (!keys.length) return null;
												const permissionItems = keys.map(key => {
													const blockedByActor =
														actorPermCeiling &&
														actorPermCeiling[key] !== true;
													return (
														<FormControlLabel
															key={key}
															className={isMobile ? classes.permissionSwitch : undefined}
															control={
																<Checkbox
																	color="primary"
																	disabled={!!blockedByActor}
																	checked={
																		!!values.featurePermissions?.[key]
																	}
																	onChange={e => {
																		setFieldValue("permissionPreset", "custom");
																		setFieldValue("featurePermissions", {
																			...(values.featurePermissions || {}),
																			[key]: e.target.checked,
																		});
																	}}
																/>
															}
															label={getFeatureLabel(key)}
														/>
													);
												});
												if (isMobile) {
													return (
														<Accordion key={group.id} defaultExpanded={false}>
															<AccordionSummary expandIcon={<ExpandMoreIcon />}>
																<Typography variant="subtitle2">
																	{i18n.t(group.titleKey)}
																</Typography>
															</AccordionSummary>
															<AccordionDetails style={{ flexDirection: "column", padding: 8 }}>
																{permissionItems}
															</AccordionDetails>
														</Accordion>
													);
												}
												return (
													<Box key={group.id} marginBottom={2}>
														<Typography variant="subtitle2" gutterBottom>
															{i18n.t(group.titleKey)}
														</Typography>
														{permissionItems}
													</Box>
												);
											})}
										</>
									)}
								{showSection(2) && values.profile === "admin" && (
									<Typography
										variant="body2"
										color="textSecondary"
										style={{ marginTop: 8 }}
									>
										{i18n.t("userPermissions.adminFullPlanAccess")}
									</Typography>
								)}

								{showSection(3) ? (
								<>
								{!isMobile ? (
								<div className={classes.divider}>
									<span className={classes.dividerText}>
										{i18n.t("userModal.labels.liberations")}
									</span>
								</div>
								) : null}

								{isMobile ? (
								<Can
									role={loggedInUser.profile}
									perform="user-modal:editProfile"
									yes={() => (
										<FormControl
											variant="outlined"
											className={classes.maxWidth}
											margin="dense"
											fullWidth
										>
											<InputLabel>
												{i18n.t("userModal.form.whatsapp")}
											</InputLabel>
											<Field
												as={Select}
												value={whatsappId}
												onChange={e => setWhatsappId(e.target.value)}
												label={i18n.t("userModal.form.whatsapp")}
											>
												<MenuItem value={""}>&nbsp;</MenuItem>
												{whatsApps.map(whatsapp => (
													<MenuItem key={whatsapp.id} value={whatsapp.id}>
														{whatsapp.name}
													</MenuItem>
												))}
											</Field>
										</FormControl>
									)}
								/>
								) : null}

								<Can
									role={loggedInUser.profile}
									perform="user-modal:editProfile"
									yes={() =>
										!loading && (
											<div>
												<FormControl
													variant="outlined"
													className={classes.maxWidth}
													margin="dense"
													fullWidth
												>
													<InputLabel id="allTicket-selection-label">
														{i18n.t("userModal.form.allTicket")}
													</InputLabel>

													<Field
														as={Select}
														label={i18n.t("allTicket.form.viewTags")}
														name="allTicket"
														labelId="allTicket-selection-label"
														id="allTicket-selection"
														required
													>
														<MenuItem value="enabled">
															{i18n.t("userModal.form.allTicketEnabled")}
														</MenuItem>
														<MenuItem value="desabled">
															{i18n.t("userModal.form.allTicketDesabled")}
														</MenuItem>
													</Field>
												</FormControl>
											</div>
										)
									}
								/>
								</>
								) : null}
								{showSection(0) && !userId && (
									<Typography variant="caption" color="textSecondary">
										{i18n.t("userModal.hints.passwordCreate")}
									</Typography>
								)}
							</AppDialogContent>
							<AppDialogActions>
								<AppSecondaryButton
									onClick={handleClose}
									disabled={isSubmitting}
								>
									{i18n.t("userModal.buttons.cancel")}
								</AppSecondaryButton>
								<AppPrimaryButton
									type="submit"
									disabled={isSubmitting}
									className={classes.btnWrapper}
								>
									{userId
										? `${i18n.t("userModal.buttons.okEdit")}`
										: `${i18n.t("userModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</AppPrimaryButton>
							</AppDialogActions>
						</Form>
					)}
				</Formik>
			</AppDialog>
		</div>
	);
};

export default UserModal;
