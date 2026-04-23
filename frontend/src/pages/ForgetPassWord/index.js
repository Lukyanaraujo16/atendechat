import React, { useState, useEffect, useCallback } from "react";
import qs from "query-string";
import { useHistory, useLocation, Link as RouterLink } from "react-router-dom";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { useBranding } from "../../context/Branding/BrandingContext";
import toastError from "../../errors/toastError";
import { PASSWORD_REGEX } from "../../validators/passwordPolicy";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    padding: theme.spacing(2),
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 8px 32px rgba(0,0,0,0.55)"
        : "0 8px 24px rgba(0,0,0,0.12)",
    padding: theme.spacing(4, 3),
  },
  logo: {
    display: "block",
    margin: "0 auto",
    maxHeight: 72,
    width: "100%",
    maxWidth: 260,
    objectFit: "contain",
    marginBottom: theme.spacing(2),
  },
  form: {
    width: "100%",
    marginTop: theme.spacing(1),
  },
  actions: {
    marginTop: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  secondaryActions: {
    marginTop: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  input: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 4,
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : theme.palette.grey[50],
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "& .MuiInputLabel-outlined": {
      color: theme.palette.text.secondary,
    },
    "& .MuiOutlinedInput-input": {
      color: theme.palette.text.primary,
    },
    "& .MuiIconButton-root": {
      color: theme.palette.action.active,
    },
  },
}));

export default function ForgetPassword() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { branding, resolveLoginLogo } = useBranding();

  const [mode, setMode] = useState("request");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const applyQuery = useCallback(() => {
    const q = qs.parse(location.search);
    const emailQ = typeof q.email === "string" ? q.email : "";
    const tokenQ = typeof q.token === "string" ? q.token : "";
    if (emailQ && tokenQ) {
      setMode("reset");
      return { email: emailQ, token: tokenQ };
    }
    return { email: emailQ, token: "" };
  }, [location.search]);

  const [initialFromQuery, setInitialFromQuery] = useState(() =>
    applyQuery()
  );

  useEffect(() => {
    setInitialFromQuery(applyQuery());
  }, [applyQuery]);

  const requestSchema = Yup.object().shape({
    email: Yup.string()
      .email(i18n.t("resetPassword.formErrors.email.invalid"))
      .required(i18n.t("resetPassword.formErrors.email.required")),
  });

  const resetSchema = Yup.object().shape({
    email: Yup.string()
      .email(i18n.t("resetPassword.formErrors.email.invalid"))
      .required(i18n.t("resetPassword.formErrors.email.required")),
    token: Yup.string().required(
      i18n.t("resetPassword.formErrors.token.required")
    ),
    newPassword: Yup.string()
      .required(i18n.t("resetPassword.formErrors.newPassword.required"))
      .matches(PASSWORD_REGEX, i18n.t("passwordPolicy.requirements")),
    confirmPassword: Yup.string()
      .oneOf(
        [Yup.ref("newPassword"), null],
        i18n.t("resetPassword.formErrors.confirmPassword.matches")
      )
      .required(i18n.t("resetPassword.formErrors.confirmPassword.required")),
  });

  const handleRequest = async (values) => {
    setLoadingRequest(true);
    try {
      await api.post("/auth/forgot-password", {
        email: values.email.trim().toLowerCase(),
      });
      toast.success(i18n.t("resetPassword.toasts.emailSent"));
      setMode("reset");
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleReset = async (values) => {
    setLoadingReset(true);
    try {
      await api.post("/auth/reset-password", {
        email: values.email.trim().toLowerCase(),
        token: values.token.trim(),
        password: values.newPassword,
      });
      toast.success(i18n.t("resetPassword.toasts.passwordUpdated"));
      history.push("/login");
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingReset(false);
    }
  };

  const initialValues =
    mode === "reset"
      ? {
          email: initialFromQuery.email || "",
          token: initialFromQuery.token || "",
          newPassword: "",
          confirmPassword: "",
        }
      : {
          email: initialFromQuery.email || "",
          token: "",
          newPassword: "",
          confirmPassword: "",
        };

  return (
    <div className={classes.root}>
      <div className={classes.card}>
        <img
          className={classes.logo}
          src={resolveLoginLogo()}
          alt={branding.systemName || ""}
        />
        <Typography component="h1" variant="h5" align="center" gutterBottom>
          {i18n.t("resetPassword.title")}
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center" paragraph>
          {mode === "request"
            ? i18n.t("resetPassword.subtitleRequest")
            : i18n.t("resetPassword.subtitleReset")}
        </Typography>

        {mode === "request" ? (
          <Formik
            key="request"
            initialValues={{ email: initialValues.email }}
            validationSchema={requestSchema}
            onSubmit={handleRequest}
            enableReinitialize
          >
            {({ errors, touched, isValid, dirty }) => (
              <Form className={classes.form}>
                <Field
                  as={TextField}
                  className={classes.input}
                  name="email"
                  variant="outlined"
                  fullWidth
                  label={i18n.t("resetPassword.form.email")}
                  error={touched.email && Boolean(errors.email)}
                  helperText={touched.email && errors.email}
                  autoComplete="email"
                />
                <div className={classes.actions}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={!dirty || !isValid || loadingRequest}
                  >
                    {loadingRequest ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      i18n.t("resetPassword.buttons.submitEmail")
                    )}
                  </Button>
                </div>
                <div className={classes.secondaryActions}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setMode("reset")}
                  >
                    {i18n.t("resetPassword.buttons.alreadyHaveCode")}
                  </Link>
                  <Link component={RouterLink} to="/login" variant="body2">
                    {i18n.t("resetPassword.buttons.goLogin")}
                  </Link>
                  <Link component={RouterLink} to="/signup" variant="body2">
                    {i18n.t("resetPassword.buttons.goSignup")}
                  </Link>
                </div>
              </Form>
            )}
          </Formik>
        ) : (
          <Formik
            key="reset"
            initialValues={initialValues}
            validationSchema={resetSchema}
            onSubmit={handleReset}
            enableReinitialize
          >
            {({ errors, touched, isValid, dirty }) => (
              <Form className={classes.form}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.input}
                      name="email"
                      variant="outlined"
                      fullWidth
                      label={i18n.t("resetPassword.form.email")}
                      error={touched.email && Boolean(errors.email)}
                      helperText={touched.email && errors.email}
                      autoComplete="email"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.input}
                      name="token"
                      variant="outlined"
                      fullWidth
                      label={i18n.t("resetPassword.form.verificationCode")}
                      error={touched.token && Boolean(errors.token)}
                      helperText={touched.token && errors.token}
                      autoComplete="one-time-code"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.input}
                      name="newPassword"
                      variant="outlined"
                      fullWidth
                      type={showPassword ? "text" : "password"}
                      label={i18n.t("resetPassword.form.newPassword")}
                      error={touched.newPassword && Boolean(errors.newPassword)}
                      helperText={touched.newPassword && errors.newPassword}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label="toggle password"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      className={classes.input}
                      name="confirmPassword"
                      variant="outlined"
                      fullWidth
                      type={showConfirmPassword ? "text" : "password"}
                      label={i18n.t("resetPassword.form.confirmPassword")}
                      error={
                        touched.confirmPassword && Boolean(errors.confirmPassword)
                      }
                      helperText={
                        touched.confirmPassword && errors.confirmPassword
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              onClick={() => setShowConfirmPassword((v) => !v)}
                              aria-label="toggle confirm password"
                            >
                              {showConfirmPassword ? (
                                <VisibilityOffIcon />
                              ) : (
                                <VisibilityIcon />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
                <Box className={classes.actions}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={!dirty || !isValid || loadingReset}
                  >
                    {loadingReset ? (
                      <CircularProgress size={22} color="inherit" />
                    ) : (
                      i18n.t("resetPassword.buttons.submitPassword")
                    )}
                  </Button>
                </Box>
                <div className={classes.secondaryActions}>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={() => setMode("request")}
                  >
                    {i18n.t("resetPassword.buttons.backToRequest")}
                  </Link>
                  <Link component={RouterLink} to="/login" variant="body2">
                    {i18n.t("resetPassword.buttons.goLogin")}
                  </Link>
                </div>
              </Form>
            )}
          </Formik>
        )}
      </div>
    </div>
  );
}
