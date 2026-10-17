import React, { useMemo } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { MenuItem, TextField, Typography } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import { i18n } from "../../../translate/i18n";
import { yupPasswordRequired } from "../../../validators/passwordPolicy";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../../ui";

export const COMPANY_USER_PROFILES = [
  { value: "admin", label: "Administrador" },
  { value: "user", label: "Usuário" },
];

export function profileLabel(profile) {
  const key = `users.profileLabels.${profile}`;
  const t = i18n.t(key);
  return t !== key ? t : profile || "—";
}

/** Mensagens claras para erros do contrato de usuários da empresa. */
export function companyUserErrorMessage(err) {
  const code = err?.response?.data?.error;
  switch (code) {
    case "ERR_LAST_ADMIN":
      return "Não é possível desativar ou rebaixar o último administrador ativo desta empresa. Defina outro administrador ativo antes.";
    case "ERR_USER_NOT_FOUND":
      return "Usuário não encontrado nesta empresa. A lista foi atualizada.";
    default:
      return null;
  }
}

const fieldError = (formik, name) =>
  Boolean(formik.touched[name] && formik.errors[name]) ? formik.errors[name] : null;

/**
 * Criação (user = null) ou edição de usuário da empresa.
 * onSubmit(values) deve lançar em caso de erro (o diálogo continua aberto).
 */
export function CompanyUserFormDialog({ open, user, onClose, onSubmit }) {
  const isEdit = Boolean(user?.id);
  const schema = useMemo(() => {
    const base = {
      name: Yup.string().trim().min(2, "Informe o nome (mín. 2 caracteres).").required("Informe o nome."),
      email: Yup.string().trim().email("E-mail inválido.").required("Informe o e-mail."),
      profile: Yup.string().required("Selecione o perfil."),
    };
    if (!isEdit) {
      base.password = yupPasswordRequired(
        i18n.t("passwordPolicy.requirements"),
        "Informe a senha inicial."
      );
      base.confirmPassword = Yup.string()
        .required("Confirme a senha.")
        .oneOf([Yup.ref("password")], "As senhas não conferem.");
    }
    return Yup.object().shape(base);
  }, [isEdit]);

  const initialValues = {
    name: user?.name || "",
    email: user?.email || "",
    profile: user?.profile || "user",
    password: "",
    confirmPassword: "",
  };
  const profileOptions =
    user?.profile && !COMPANY_USER_PROFILES.some((p) => p.value === user.profile)
      ? [...COMPANY_USER_PROFILES, { value: user.profile, label: profileLabel(user.profile) }]
      : COMPANY_USER_PROFILES;

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle>{isEdit ? "Editar usuário" : "Novo usuário"}</AppDialogTitle>
      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={schema}
        onSubmit={async (values, actions) => {
          try {
            await onSubmit(values);
          } finally {
            actions.setSubmitting(false);
          }
        }}
      >
        {(formik) => (
          <Form noValidate>
            <AppDialogContent dividers>
              <Field
                as={TextField}
                name="name"
                label="Nome"
                variant="outlined"
                margin="dense"
                fullWidth
                autoFocus
                error={Boolean(fieldError(formik, "name"))}
                helperText={fieldError(formik, "name")}
              />
              <Field
                as={TextField}
                name="email"
                type="email"
                label="E-mail"
                variant="outlined"
                margin="dense"
                fullWidth
                error={Boolean(fieldError(formik, "email"))}
                helperText={fieldError(formik, "email")}
              />
              <Field
                as={TextField}
                select
                name="profile"
                label="Perfil"
                variant="outlined"
                margin="dense"
                fullWidth
                error={Boolean(fieldError(formik, "profile"))}
                helperText={fieldError(formik, "profile")}
              >
                {profileOptions.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Field>
              {!isEdit ? (
                <>
                  <Field
                    as={TextField}
                    name="password"
                    type="password"
                    label="Senha inicial"
                    autoComplete="new-password"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    error={Boolean(fieldError(formik, "password"))}
                    helperText={fieldError(formik, "password") || i18n.t("passwordPolicy.requirements")}
                  />
                  <Field
                    as={TextField}
                    name="confirmPassword"
                    type="password"
                    label="Confirmar senha"
                    autoComplete="new-password"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    error={Boolean(fieldError(formik, "confirmPassword"))}
                    helperText={fieldError(formik, "confirmPassword")}
                  />
                </>
              ) : null}
              {isEdit && user?.profile === "admin" && formik.values.profile !== "admin" ? (
                <Alert severity="warning" style={{ marginTop: 8 }}>
                  O usuário perderá o perfil de administrador. Se for o último administrador ativo,
                  a alteração será recusada.
                </Alert>
              ) : null}
            </AppDialogContent>
            <AppDialogActions>
              <AppNeutralButton type="button" onClick={onClose} disabled={formik.isSubmitting}>
                {i18n.t("confirmationModal.buttons.cancel")}
              </AppNeutralButton>
              <AppPrimaryButton type="submit" loading={formik.isSubmitting}>
                {isEdit ? "Salvar" : "Criar usuário"}
              </AppPrimaryButton>
            </AppDialogActions>
          </Form>
        )}
      </Formik>
    </AppDialog>
  );
}

/** Definição de nova senha (POST .../password) com confirmação. */
export function CompanyUserPasswordFormDialog({ open, user, onClose, onSubmit }) {
  const schema = useMemo(
    () =>
      Yup.object().shape({
        password: yupPasswordRequired(i18n.t("passwordPolicy.requirements"), "Informe a nova senha."),
        confirmPassword: Yup.string()
          .required("Confirme a nova senha.")
          .oneOf([Yup.ref("password")], "As senhas não conferem."),
      }),
    []
  );
  return (
    <AppDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AppDialogTitle>Trocar senha</AppDialogTitle>
      <Formik
        initialValues={{ password: "", confirmPassword: "" }}
        enableReinitialize
        validationSchema={schema}
        onSubmit={async (values, actions) => {
          try {
            await onSubmit(values.password);
          } finally {
            actions.setSubmitting(false);
          }
        }}
      >
        {(formik) => (
          <Form noValidate>
            <AppDialogContent dividers>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Nova senha para <strong>{user?.name || user?.email || "—"}</strong>. O usuário terá
                de trocá-la no próximo acesso e todas as sessões ativas serão encerradas.
              </Typography>
              <Field
                as={TextField}
                name="password"
                type="password"
                label="Nova senha"
                autoComplete="new-password"
                variant="outlined"
                margin="dense"
                fullWidth
                autoFocus
                error={Boolean(fieldError(formik, "password"))}
                helperText={fieldError(formik, "password") || i18n.t("passwordPolicy.requirements")}
              />
              <Field
                as={TextField}
                name="confirmPassword"
                type="password"
                label="Confirmar nova senha"
                autoComplete="new-password"
                variant="outlined"
                margin="dense"
                fullWidth
                error={Boolean(fieldError(formik, "confirmPassword"))}
                helperText={fieldError(formik, "confirmPassword")}
              />
            </AppDialogContent>
            <AppDialogActions>
              <AppNeutralButton type="button" onClick={onClose} disabled={formik.isSubmitting}>
                {i18n.t("confirmationModal.buttons.cancel")}
              </AppNeutralButton>
              <AppPrimaryButton type="submit" loading={formik.isSubmitting}>
                Definir senha
              </AppPrimaryButton>
            </AppDialogActions>
          </Form>
        )}
      </Formik>
    </AppDialog>
  );
}
