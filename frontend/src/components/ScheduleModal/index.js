import React, { useState, useEffect, useContext, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Radio from "@material-ui/core/Radio";
import FormLabel from "@material-ui/core/FormLabel";
import FormGroup from "@material-ui/core/FormGroup";
import Checkbox from "@material-ui/core/Checkbox";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import { FormControl, Grid, IconButton, MenuItem, Typography } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import moment from "moment-timezone";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray } from "lodash";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import AttachFile from "@material-ui/icons/AttachFile";
import { head } from "lodash";
import ConfirmationModal from "../ConfirmationModal";
import MessageVariablesPicker from "../MessageVariablesPicker";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
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
		margin: theme.spacing(1),
		minWidth: 120,
	},
}));

function buildSchema() {
	return Yup.object().shape({
		body: Yup.string()
			.min(5, "Mensagem muito curta")
			.required("Obrigatório"),
		scheduleType: Yup.string().oneOf(["single", "recurring"]).required(),
		contactIds: Yup.array()
			.of(Yup.number())
			.min(1, "Selecione ao menos um contato"),
		sendAt: Yup.mixed().when("scheduleType", {
			is: "single",
			then: s => s.required("Obrigatório"),
			otherwise: s => s.notRequired(),
		}),
		timeToSend: Yup.mixed().when("scheduleType", {
			is: "recurring",
			then: s => s.required("Obrigatório"),
			otherwise: s => s.notRequired(),
		}),
		recurrenceType: Yup.mixed().when("scheduleType", {
			is: "recurring",
			then: s =>
				s
					.oneOf(["daily", "weekly", "monthly"])
					.required("Obrigatório"),
			otherwise: s => s.notRequired(),
		}),
		recurrenceDaysOfWeek: Yup.mixed().when(["scheduleType", "recurrenceType"], {
			is: (st, rt) => st === "recurring" && rt === "weekly",
			then: s =>
				s
					.array()
					.of(Yup.number())
					.min(1, "Selecione ao menos um dia"),
			otherwise: s => s.notRequired(),
		}),
		recurrenceDayOfMonth: Yup.mixed().when(["scheduleType", "recurrenceType"], {
			is: (st, rt) => st === "recurring" && rt === "monthly",
			then: s =>
				s
					.number()
					.min(1)
					.max(31)
					.required("Obrigatório"),
			otherwise: s => s.notRequired(),
		}),
		preferredWhatsappId: Yup.mixed().nullable(),
	});
}

const WEEKDAYS = [
	{ v: 0, key: "sun" },
	{ v: 1, key: "mon" },
	{ v: 2, key: "tue" },
	{ v: 3, key: "wed" },
	{ v: 4, key: "thu" },
	{ v: 5, key: "fri" },
	{ v: 6, key: "sat" },
];

/** Resposta do GET /contacts/list costuma ser array; normaliza formatos alternativos. */
function normalizeContactListPayload(data) {
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.contacts)) return data.contacts;
	if (Array.isArray(data?.records)) return data.records;
	return [];
}

function resolveEffectiveCompanyId(user) {
	const fromUser = user?.companyId;
	if (fromUser != null && fromUser !== "") {
		const n = Number(fromUser);
		return Number.isFinite(n) ? n : null;
	}
	const raw = typeof localStorage !== "undefined" ? localStorage.getItem("companyId") : null;
	if (raw == null || raw === "") return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

const ScheduleModal = ({
	open,
	onClose,
	scheduleId,
	contactId,
	cleanContact,
	reload,
	/** Quando há contactId e cleanContact após guardar: ir para /schedules (comportamento legado). Contatos passam false para ficar na página. */
	redirectToSchedulesAfterContactSave = true,
}) => {
	const classes = useStyles();
	const history = useHistory();
	const { user } = useContext(AuthContext);

	const initialState = {
		body: "",
		contactIds: [],
		sendAt: moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
		sentAt: "",
		preferredWhatsappId: "",
		scheduleType: "single",
		recurrenceType: "daily",
		recurrenceDaysOfWeek: [1],
		recurrenceDayOfMonth: 1,
		timeToSend: "09:00",
	};

	const initialContact = {
		id: "",
		name: "",
	};

	const [schedule, setSchedule] = useState(initialState);
	const [contacts, setContacts] = useState([initialContact]);
	const [attachment, setAttachment] = useState(null);
	const attachmentFile = useRef(null);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const messageInputRef = useRef();
	const [whatsAppOptions, setWhatsAppOptions] = useState([]);
	const [companyTz, setCompanyTz] = useState("America/Sao_Paulo");

	useEffect(() => {
		if (!open) return;
		(async () => {
			try {
				const { data } = await api.get("/whatsapp/?session=0");
				const list = Array.isArray(data) ? data : data?.records || data?.whatsapps || [];
				setWhatsAppOptions((list || []).filter(w => w.status === "CONNECTED"));
			} catch (err) {
				toastError(err);
			}
		})();
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const effectiveCompanyId = resolveEffectiveCompanyId(user);

		(async () => {
			let tz = "America/Sao_Paulo";

			// Timezone da empresa (opcional): não bloquear lista de contatos se falhar.
			if (effectiveCompanyId != null) {
				try {
					const { data: company } = await api.get(`/companies/${effectiveCompanyId}`);
					tz = company?.timezone || tz;
					setCompanyTz(tz);
				} catch (_) {
					setCompanyTz(tz);
				}
			}

			// Lista vem sempre do tenant do JWT (req.user.companyId no backend). Não depende
			// de companyId no contexto React — evita /companies/undefined e falha em cadeia.
			try {
				const { data } = await api.get("/contacts/list");
				const contactList = normalizeContactListPayload(data);
				const customList = contactList.map(c => ({
					id: c.id,
					name: c.name || c.number || String(c.id),
				}));
				if (isArray(customList)) {
					setContacts([{ id: "", name: "" }, ...customList]);
				}
			} catch (err) {
				toastError(err);
				setContacts([{ id: "", name: "" }]);
			}

			try {
				if (!scheduleId) {
					setSchedule({
						...initialState,
						contactIds: contactId ? [Number(contactId)] : [],
						sendAt: moment.tz(tz).add(1, "hour").format("YYYY-MM-DDTHH:mm"),
					});
					return;
				}

				const { data } = await api.get(`/schedules/${scheduleId}`);
				const ids =
					data.scheduleContacts && data.scheduleContacts.length
						? data.scheduleContacts.map(sc => sc.contactId)
						: data.contactId
							? [data.contactId]
							: [];

				const extra = (data.scheduleContacts || []).map(sc => sc.contact).filter(Boolean);
				if (extra.length) {
					setContacts(prev => {
						const merged = [...prev];
						extra.forEach(c => {
							if (c && !merged.find(x => x.id === c.id)) {
								merged.push({ id: c.id, name: c.name });
							}
						});
						return merged;
					});
				}

				const sendAtFormatted =
					data.scheduleType === "recurring" && data.nextRunAt
						? moment.utc(data.nextRunAt).tz(tz).format("YYYY-MM-DDTHH:mm")
						: moment.utc(data.sendAt).tz(tz).format("YYYY-MM-DDTHH:mm");

				setSchedule({
					...data,
					contactIds: ids,
					sendAt: sendAtFormatted,
					preferredWhatsappId:
						data.preferredWhatsappId != null ? String(data.preferredWhatsappId) : "",
					scheduleType: data.scheduleType === "recurring" ? "recurring" : "single",
					recurrenceType: data.recurrenceType || "daily",
					recurrenceDaysOfWeek:
						data.recurrenceDaysOfWeek && data.recurrenceDaysOfWeek.length
							? data.recurrenceDaysOfWeek
							: [1],
					recurrenceDayOfMonth: data.recurrenceDayOfMonth || 1,
					timeToSend: data.timeToSend || "09:00",
				});
			} catch (err) {
				toastError(err);
			}
		})();
	}, [scheduleId, open, contactId, user?.companyId]);

	const handleClose = () => {
		onClose();
		setAttachment(null);
		setSchedule(initialState);
	};

	const handleAttachmentFile = e => {
		const file = head(e.target.files);
		if (file) {
			setAttachment(file);
		}
	};

	const handleSaveSchedule = async values => {
		const scheduleData = {
			body: values.body,
			userId: user.id,
			contactIds: values.contactIds,
			preferredWhatsappId:
				values.preferredWhatsappId === "" || values.preferredWhatsappId == null
					? null
					: Number(values.preferredWhatsappId),
			scheduleType: values.scheduleType,
		};

		if (values.scheduleType === "single") {
			scheduleData.sendAt = values.sendAt;
		} else {
			scheduleData.recurrenceType = values.recurrenceType;
			scheduleData.timeToSend = values.timeToSend;
			scheduleData.recurrenceDaysOfWeek =
				values.recurrenceType === "weekly" ? values.recurrenceDaysOfWeek : null;
			scheduleData.recurrenceDayOfMonth =
				values.recurrenceType === "monthly" ? values.recurrenceDayOfMonth : null;
		}

		try {
			if (scheduleId) {
				await api.put(`/schedules/${scheduleId}`, scheduleData);
				if (attachment != null) {
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(`/schedules/${scheduleId}/media-upload`, formData);
				}
			} else {
				const { data } = await api.post("/schedules", scheduleData);
				if (attachment != null) {
					const formData = new FormData();
					formData.append("file", attachment);
					await api.post(`/schedules/${data.id}/media-upload`, formData);
				}
			}
			showSuccessToast("scheduleModal.success");
			if (typeof reload === "function") {
				reload();
			}
			if (contactId) {
				if (typeof cleanContact === "function") {
					cleanContact();
					if (redirectToSchedulesAfterContactSave) {
						history.push("/schedules");
					}
				}
			}
		} catch (err) {
			toastError(err);
		}
		setSchedule(initialState);
		handleClose();
	};

	const handleClickMsgVar = async (msgVar, setValueFunc) => {
		const el = messageInputRef.current;
		const firstHalfText = el.value.substring(0, el.selectionStart);
		const secondHalfText = el.value.substring(el.selectionEnd);
		const newCursorPos = el.selectionStart + msgVar.length;

		setValueFunc("body", `${firstHalfText}${msgVar}${secondHalfText}`);

		await new Promise(r => setTimeout(r, 100));
		messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
	};

	const deleteMedia = async () => {
		if (attachment) {
			setAttachment(null);
			attachmentFile.current.value = null;
		}

		if (schedule.mediaPath) {
			await api.delete(`/schedules/${schedule.id}/media-upload`);
			setSchedule(prev => ({
				...prev,
				mediaPath: null,
			}));
			showSuccessToast("scheduleModal.toasts.deleted");
			if (typeof reload === "function") {
				reload();
			}
		}
	};

	const titleKey = scheduleId ? "edit" : "add";

	return (
		<div className={classes.root}>
			<ConfirmationModal
				title={i18n.t("scheduleModal.confirmationModal.deleteTitle")}
				open={confirmationOpen}
				onClose={() => setConfirmationOpen(false)}
				onConfirm={deleteMedia}
				destructive
			>
				{i18n.t("scheduleModal.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<AppDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
				<AppDialogTitle disableTypography id="form-dialog-title">
					<>
						<Typography component="span" variant="h6" style={{ fontWeight: 600 }}>
							{i18n.t(`scheduleModal.title.${titleKey}`)}
						</Typography>
						<Typography variant="caption" color="textSecondary" component="div" style={{ marginTop: 6 }}>
							{i18n.t("scheduleModal.subtitle")}
						</Typography>
						<Typography variant="caption" color="textSecondary" component="div" style={{ marginTop: 4 }}>
							{i18n.t("scheduleModal.form.companyTimezone")}: {companyTz}
						</Typography>
						{schedule.lastError &&
							(schedule.status === "ERRO" || schedule.status === "AGUARDANDO_CONEXAO") && (
								<Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
									{schedule.lastError}
								</Typography>
							)}
					</>
				</AppDialogTitle>
				<div style={{ display: "none" }}>
					<input
						type="file"
						accept=".png,.jpg,.jpeg"
						ref={attachmentFile}
						onChange={e => handleAttachmentFile(e)}
					/>
				</div>
				<Formik
					initialValues={schedule}
					enableReinitialize={true}
					validationSchema={buildSchema()}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveSchedule(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => {
						const selectedContacts = contacts.filter(
							c => c.id && values.contactIds && values.contactIds.includes(c.id)
						);

						return (
							<Form>
								<AppDialogContent dividers>
									<FormControl component="fieldset" fullWidth margin="dense">
										<FormLabel component="legend">{i18n.t("scheduleModal.form.sendType")}</FormLabel>
										<RadioGroup
											row
											name="scheduleType"
											value={values.scheduleType}
											onChange={e => setFieldValue("scheduleType", e.target.value)}
										>
											<FormControlLabel
												value="single"
												control={<Radio color="primary" />}
												label={i18n.t("scheduleModal.form.sendSingle")}
											/>
											<FormControlLabel
												value="recurring"
												control={<Radio color="primary" />}
												label={i18n.t("scheduleModal.form.sendRecurring")}
											/>
										</RadioGroup>
									</FormControl>

									<div className={classes.multFieldLine} style={{ marginTop: 8 }}>
										<FormControl variant="outlined" fullWidth>
											<Autocomplete
												multiple
												value={selectedContacts}
												options={contacts.filter(c => c.id)}
												onChange={(e, opts) => {
													setFieldValue(
														"contactIds",
														(opts || []).map(o => o.id)
													);
												}}
												getOptionLabel={option => option.name}
												getOptionSelected={(option, value) => value.id === option.id}
												renderInput={params => (
													<TextField
														{...params}
														variant="outlined"
														label={i18n.t("scheduleModal.form.contacts")}
														error={touched.contactIds && Boolean(errors.contactIds)}
														helperText={touched.contactIds && errors.contactIds}
													/>
												)}
											/>
										</FormControl>
									</div>
									<br />

									{values.scheduleType === "single" && (
										<div className={classes.multFieldLine}>
											<Field
												as={TextField}
												label={i18n.t("scheduleModal.form.sendAt")}
												type="datetime-local"
												name="sendAt"
												InputLabelProps={{ shrink: true }}
												error={touched.sendAt && Boolean(errors.sendAt)}
												helperText={touched.sendAt && errors.sendAt}
												variant="outlined"
												fullWidth
											/>
										</div>
									)}

									{values.scheduleType === "recurring" && (
										<>
											<div className={classes.multFieldLine}>
												<Field
													as={TextField}
													select
													name="recurrenceType"
													label={i18n.t("scheduleModal.form.recurrence")}
													variant="outlined"
													fullWidth
													error={touched.recurrenceType && Boolean(errors.recurrenceType)}
													helperText={touched.recurrenceType && errors.recurrenceType}
												>
													<MenuItem value="daily">
														{i18n.t("scheduleModal.form.recurrenceDaily")}
													</MenuItem>
													<MenuItem value="weekly">
														{i18n.t("scheduleModal.form.recurrenceWeekly")}
													</MenuItem>
													<MenuItem value="monthly">
														{i18n.t("scheduleModal.form.recurrenceMonthly")}
													</MenuItem>
												</Field>
											</div>
											<br />
											<div className={classes.multFieldLine}>
												<Field
													as={TextField}
													label={i18n.t("scheduleModal.form.timeToSend")}
													type="time"
													name="timeToSend"
													InputLabelProps={{ shrink: true }}
													error={touched.timeToSend && Boolean(errors.timeToSend)}
													helperText={touched.timeToSend && errors.timeToSend}
													variant="outlined"
													fullWidth
												/>
											</div>
											{values.recurrenceType === "weekly" && (
												<>
													<br />
													<FormLabel component="legend">
														{i18n.t("scheduleModal.form.weekdays")}
													</FormLabel>
													<FormGroup row>
														{WEEKDAYS.map(d => (
															<FormControlLabel
																key={d.key}
																control={
																	<Checkbox
																		checked={(values.recurrenceDaysOfWeek || []).includes(d.v)}
																		onChange={() => {
																			const cur = values.recurrenceDaysOfWeek || [];
																			const next = cur.includes(d.v)
																				? cur.filter(x => x !== d.v)
																				: [...cur, d.v];
																			setFieldValue("recurrenceDaysOfWeek", next);
																		}}
																		color="primary"
																	/>
																}
																label={moment().day(d.v).format("ddd")}
															/>
														))}
													</FormGroup>
													{touched.recurrenceDaysOfWeek && errors.recurrenceDaysOfWeek && (
														<Typography color="error" variant="caption">
															{errors.recurrenceDaysOfWeek}
														</Typography>
													)}
												</>
											)}
											{values.recurrenceType === "monthly" && (
												<>
													<br />
													<div className={classes.multFieldLine}>
														<Field
															as={TextField}
															type="number"
															name="recurrenceDayOfMonth"
															label={i18n.t("scheduleModal.form.dayOfMonth")}
															inputProps={{ min: 1, max: 31 }}
															variant="outlined"
															fullWidth
															error={
																touched.recurrenceDayOfMonth &&
																Boolean(errors.recurrenceDayOfMonth)
															}
															helperText={
																touched.recurrenceDayOfMonth && errors.recurrenceDayOfMonth
															}
														/>
													</div>
												</>
											)}
										</>
									)}

									<br />
									<div className={classes.multFieldLine}>
										<Field
											as={TextField}
											rows={6}
											multiline={true}
											label={i18n.t("scheduleModal.form.body")}
											name="body"
											inputRef={messageInputRef}
											error={touched.body && Boolean(errors.body)}
											helperText={touched.body && errors.body}
											variant="outlined"
											margin="dense"
											fullWidth
										/>
									</div>
									<Grid item>
										<MessageVariablesPicker
											disabled={isSubmitting}
											onClick={value => handleClickMsgVar(value, setFieldValue)}
										/>
									</Grid>
									<br />
									<div className={classes.multFieldLine}>
										<Field
											as={TextField}
											select
											name="preferredWhatsappId"
											label={i18n.t("scheduleModal.form.preferredWhatsapp")}
											helperText={i18n.t("scheduleModal.form.preferredWhatsappHint")}
											variant="outlined"
											fullWidth
											disabled={isSubmitting}
										>
											<MenuItem value="">
												<em>{i18n.t("scheduleModal.form.automaticConnection")}</em>
											</MenuItem>
											{whatsAppOptions.map(w => (
												<MenuItem key={w.id} value={String(w.id)}>
													{w.name}
												</MenuItem>
											))}
										</Field>
									</div>
									{(schedule.mediaPath || attachment) && (
										<Grid xs={12} item>
											<Button startIcon={<AttachFile />}>
												{attachment ? attachment.name : schedule.mediaName}
											</Button>
											<IconButton onClick={() => setConfirmationOpen(true)} color="secondary">
												<DeleteOutline color="secondary" />
											</IconButton>
										</Grid>
									)}
								</AppDialogContent>
								<AppDialogActions>
									{!attachment && !schedule.mediaPath && (
										<AppSecondaryButton
											onClick={() => attachmentFile.current.click()}
											disabled={isSubmitting}
										>
											{i18n.t("quickMessages.buttons.attach")}
										</AppSecondaryButton>
									)}
									<AppNeutralButton onClick={handleClose} disabled={isSubmitting}>
										{i18n.t("scheduleModal.buttons.cancel")}
									</AppNeutralButton>
									{(schedule.sentAt === null || schedule.sentAt === "") && (
										<AppPrimaryButton
											type="submit"
											disabled={isSubmitting}
											className={classes.btnWrapper}
										>
											{scheduleId
												? `${i18n.t("scheduleModal.buttons.okEdit")}`
												: `${i18n.t("scheduleModal.buttons.okAdd")}`}
											{isSubmitting && (
												<CircularProgress size={24} className={classes.buttonProgress} />
											)}
										</AppPrimaryButton>
									)}
								</AppDialogActions>
							</Form>
						);
					}}
				</Formik>
			</AppDialog>
		</div>
	);
};

export default ScheduleModal;
