import React, { useMemo } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { yupPasswordRequired } from "../../validators/passwordPolicy";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../ui";

const CompanyUserPasswordDialog = ({ open, user, onClose, onSaved }) => {
  const validationSchema = useMemo(
    () =>
      Yup.object().shape({
        password: yupPasswordRequired(
          i18n.t("passwordPolicy.requirements"),
          i18n.t("userModal.formErrors.password.required")
        ),
        confirmPassword: Yup.string()
          .required(i18n.t("settings.company.form.usersPasswordConfirmRequired"))
          .oneOf(
            [Yup.ref("password")],
            i18n.t("settings.company.form.usersPasswordMismatch")
          ),
      }),
    []
  );

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleSubmit = async (values, actions) => {
    if (!user?.id) return;
    try {
      await api.put(`/users/${user.id}`, { password: values.password });
      toast.success(i18n.t("settings.company.form.usersPasswordChanged"));
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      actions.setSubmitting(false);
    }
  };

  return (
    <AppDialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <AppDialogTitle>
        {i18n.t("settings.company.form.usersChangePasswordTitle")}
      </AppDialogTitle>
      <Formik
        initialValues={{ password: "", confirmPassword: "" }}
        enableReinitialize
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ touched, errors, isSubmitting }) => (
          <Form>
            <AppDialogContent dividers>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {i18n.t("settings.company.form.usersChangePasswordHint", {
                  name: user?.name || user?.email || "",
                })}
              </Typography>
              <Field
                as={TextField}
                label={i18n.t("settings.company.form.usersPasswordNew")}
                type="password"
                name="password"
                autoFocus
                fullWidth
                variant="outlined"
                margin="dense"
                error={touched.password && Boolean(errors.password)}
                helperText={touched.password && errors.password}
              />
              <Field
                as={TextField}
                label={i18n.t("settings.company.form.usersPasswordConfirm")}
                type="password"
                name="confirmPassword"
                fullWidth
                variant="outlined"
                margin="dense"
                error={touched.confirmPassword && Boolean(errors.confirmPassword)}
                helperText={touched.confirmPassword && errors.confirmPassword}
              />
            </AppDialogContent>
            <AppDialogActions>
              <AppNeutralButton type="button" onClick={handleClose} disabled={isSubmitting}>
                {i18n.t("userModal.buttons.cancel")}
              </AppNeutralButton>
              <AppPrimaryButton type="submit" loading={isSubmitting}>
                {i18n.t("userModal.buttons.okEdit")}
              </AppPrimaryButton>
            </AppDialogActions>
          </Form>
        )}
      </Formik>
    </AppDialog>
  );
};

export default CompanyUserPasswordDialog;
