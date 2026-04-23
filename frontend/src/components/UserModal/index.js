import React, { useState, useEffect, useContext, useMemo } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { yupPasswordOptional, yupPasswordRequired } from "../../validators/passwordPolicy";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";

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
}));

const UserModal = ({ open, onClose, userId, reload }) => {
	const classes = useStyles();

	const initialState = {
		name: "",
		email: "",
		password: "",
		profile: "user",
		allTicket: "desabled",
	};

	const { user: loggedInUser } = useContext(AuthContext);

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
		const fetchUser = async () => {
			if (!userId) return;
			try {
				const { data } = await api.get(`/users/${userId}`);
				setUser(prevState => {
					return { ...prevState, ...data, password: "" };
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
	};

	const handleSaveUser = async values => {
		const userData = {
			...values,
			whatsappId,
			queueIds: selectedQueueIds,
			allTicket: values.allTicket,
		};
		if (userId && (!userData.password || userData.password === "")) {
			delete userData.password;
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
			<Dialog
				open={open}
				onClose={handleClose}
				maxWidth="sm"
				fullWidth
				scroll="paper"
			>
				<DialogTitle id="form-dialog-title">
					{userId
						? `${i18n.t("userModal.title.edit")}`
						: `${i18n.t("userModal.title.add")}`}
				</DialogTitle>
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
					{({ touched, errors, isSubmitting }) => (
						<Form>
							<DialogContent dividers>
								<div className={classes.multFieldLine}>
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
								<div className={classes.multFieldLine}>
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
														<MenuItem value="admin">Admin</MenuItem>
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

								<div className={classes.divider}>
									<span className={classes.dividerText}>
										{i18n.t("userModal.labels.liberations")}
									</span>
								</div>

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
													<>
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
													</>
												</FormControl>
											</div>
										)
									}
								/>
								{!userId && (
									<Typography variant="caption" color="textSecondary">
										{i18n.t("userModal.hints.passwordCreate")}
									</Typography>
								)}
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("userModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
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
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default UserModal;
