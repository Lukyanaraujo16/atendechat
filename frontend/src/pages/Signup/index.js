import React, { useState, useEffect } from "react";
import qs from 'query-string'

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import usePlans from "../../hooks/usePlans";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import InputMask from 'react-input-mask';
import {
	FormControl,
	InputLabel,
	MenuItem,
	Select,
} from "@material-ui/core";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { i18n } from "../../translate/i18n";
import { useBranding } from "../../context/Branding/BrandingContext";

import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";
const Copyright = ({ brandName }) => {
	return (
		<Typography variant="body2" color="textSecondary" align="center">
			{"Copyright © "}
			<Link color="inherit" href="#">
				{brandName}
			</Link>{" "}
		   {new Date().getFullYear()}
			{"."}
		</Typography>
	);
};

const useStyles = makeStyles(theme => ({
	paper: {
		marginTop: theme.spacing(8),
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	},
	avatar: {
		margin: theme.spacing(1),
		backgroundColor: theme.palette.secondary.main,
	},
	form: {
		width: "100%",
		marginTop: theme.spacing(3),
	},
	submit: {
		margin: theme.spacing(3, 0, 2),
	},
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, i18n.t("signup.formErrors.name.short"))
		.max(50, i18n.t("signup.formErrors.name.long"))
		.required(i18n.t("signup.formErrors.name.required")),
	adminName: Yup.string()
		.min(2, i18n.t("signup.formErrors.adminName.short"))
		.max(120, i18n.t("signup.formErrors.adminName.long"))
		.required(i18n.t("signup.formErrors.adminName.required")),
	email: Yup.string().email(i18n.t("signup.formErrors.email.invalid")).required(i18n.t("signup.formErrors.email.required")),
	notes: Yup.string().max(2000, i18n.t("signup.formErrors.notes.long")),
	acceptTerms: Yup.boolean()
		.oneOf([true], i18n.t("signup.formErrors.acceptTerms")),
});

const SignUp = () => {
	const classes = useStyles();
	const history = useHistory();
	const { branding, resolveLoginLogo } = useBranding();
	let companyId = null

	const params = qs.parse(window.location.search)
	if (params.companyId !== undefined) {
		companyId = params.companyId
	}

	const initialState = {
		name: "",
		adminName: "",
		email: "",
		phone: "",
		planId: "",
		notes: "",
		acceptTerms: false,
	};

	const [user] = useState(initialState);
	const dueDate = moment().add(3, "day").format();
	const handleSignUp = async values => {
		const { acceptTerms: _acceptTerms, name, adminName, email, phone, planId, notes } = values;
		const payload = {
			companyName: name,
			adminName,
			email,
			phone,
			planId,
			notes: notes || undefined,
			recurrence: "MENSAL",
			dueDate,
			campaignsEnabled: true,
		};
		if (companyId != null) {
			payload.companyId = companyId;
		}
		try {
			await openApi.post("/companies/signup-requests", payload);
			toast.success(i18n.t("signup.toasts.success"));
			history.push("/login");
		} catch (err) {
			toastError(err);
		}
	};

	const [plans, setPlans] = useState([]);
	const { list: listPlans } = usePlans();

	useEffect(() => {
		async function fetchData() {
			const list = await listPlans();
			setPlans(list);
		}
		fetchData();
	}, []);


	return (
		<Container component="main" maxWidth="xs">
			<CssBaseline />
			<div className={classes.paper}>
				<div>
					<center>
						<img
							style={{ margin: "0 auto", width: "70%" }}
							src={resolveLoginLogo()}
							alt={branding.systemName || ""}
						/>
					</center>
				</div>
				{/*<Typography component="h1" variant="h5">
					{i18n.t("signup.title")}
				</Typography>*/}
				{/* <form className={classes.form} noValidate onSubmit={handleSignUp}> */}
				<Formik
					initialValues={user}
					enableReinitialize={true}
					validationSchema={UserSchema}
					onSubmit={async (values, actions) => {
						try {
							await handleSignUp(values);
						} finally {
							actions.setSubmitting(false);
						}
					}}
				>
					{({ touched, errors, isSubmitting, values, setFieldValue }) => (
						<Form className={classes.form}>
							<Grid container spacing={2}>
								<Grid item xs={12}>
									<Field
										as={TextField}
										autoComplete="organization"
										name="name"
										error={touched.name && Boolean(errors.name)}
										helperText={touched.name && errors.name}
										variant="outlined"
										fullWidth
										id="name"
										label={i18n.t("signup.form.name")}
									/>
								</Grid>
								<Grid item xs={12}>
									<Field
										as={TextField}
										autoComplete="name"
										name="adminName"
										error={touched.adminName && Boolean(errors.adminName)}
										helperText={touched.adminName && errors.adminName}
										variant="outlined"
										fullWidth
										id="adminName"
										label={i18n.t("signup.form.adminName")}
									/>
								</Grid>

								<Grid item xs={12}>
									<Field
										as={TextField}
										variant="outlined"
										fullWidth
										id="email"
										label={i18n.t("signup.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										autoComplete="email"
										required
									/>
								</Grid>
								
							<Grid item xs={12}>
								<Field
									as={InputMask}
									mask="(99) 99999-9999"
									variant="outlined"
									fullWidth
									id="phone"
									name="phone"
									error={touched.phone && Boolean(errors.phone)}
									helperText={touched.phone && errors.phone}
									autoComplete="phone"
									required
								>
									{({ field }) => (
										<TextField
											{...field}
											variant="outlined"
											fullWidth
											label={i18n.t("signup.form.phone")}
											inputProps={{ maxLength: 11 }} // Definindo o limite de caracteres
										/>
									)}
								</Field>
							</Grid>
								<Grid item xs={12}>
									<Field
										as={TextField}
										variant="outlined"
										fullWidth
										name="notes"
										error={touched.notes && Boolean(errors.notes)}
										helperText={touched.notes && errors.notes}
										label={i18n.t("signup.form.notes")}
										id="notes"
										multiline
										minRows={2}
									/>
								</Grid>
								<Grid item xs={12}>
									<FormControlLabel
										control={
											<Checkbox
												checked={Boolean(values.acceptTerms)}
												onChange={e => setFieldValue("acceptTerms", e.target.checked)}
												color="primary"
											/>
										}
										label={
											<Typography component="span" variant="body2" color="textSecondary">
												{i18n.t("signup.legal.iAgree")}{" "}
												<Link component={RouterLink} to="/privacy-policy" color="primary">
													{i18n.t("login.footer.privacy")}
												</Link>
												{" "}{i18n.t("signup.legal.and")}{" "}
												<Link component={RouterLink} to="/terms-of-service" color="primary">
													{i18n.t("login.footer.terms")}
												</Link>
												.
											</Typography>
										}
									/>
									{touched.acceptTerms && errors.acceptTerms ? (
										<Typography variant="caption" color="error" display="block">
											{errors.acceptTerms}
										</Typography>
									) : null}
								</Grid>
								<Grid item xs={12}>
									<InputLabel htmlFor="plan-selection">Plano</InputLabel>
									<Field
										as={Select}
										variant="outlined"
										fullWidth
										id="plan-selection"
										label={i18n.t("signup.form.plan")}
										name="planId"
										required
									>
										{plans.map((plan, key) => (
											<MenuItem key={key} value={plan.id}>
												{plan.name} - {i18n.t("signup.plan.attendant")}: {plan.users} - {i18n.t("signup.plan.whatsapp")}: {plan.connections} - {i18n.t("signup.plan.queues")}: {plan.queues} - R$ {plan.value}
											</MenuItem>
										))}
									</Field>
								</Grid>
							</Grid>
							<Button
								type="submit"
								fullWidth
								variant="contained"
								color="primary"
								className={classes.submit}
								disabled={isSubmitting}
							>
								{isSubmitting ? (
									<CircularProgress size={22} color="inherit" />
								) : (
									i18n.t("signup.buttons.submitRequest")
								)}
							</Button>
							<Grid container justifyContent="flex-end">
								<Grid item>
									<Link
										href="#"
										variant="body2"
										component={RouterLink}
										to="/login"
									>
										{i18n.t("signup.buttons.login")}
									</Link>
								</Grid>
							</Grid>
						</Form>
					)}
				</Formik>
			</div>
			<Box mt={5}>
				<Copyright brandName={branding.systemName} />
			</Box>
		</Container>
	);
};

export default SignUp;
