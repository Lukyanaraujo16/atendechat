import React, { useEffect, useMemo, useState } from "react";
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
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";
import MenuItem from "@material-ui/core/MenuItem";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  AI_PROVIDER_GEMINI,
  AI_PROVIDER_OPENAI,
} from "../../config/aiProviderModels";
import {
  createAiProviderCredential,
  getAiProviderCredential,
  updateAiProviderCredential,
} from "../../services/aiProviderCredentialApi";

const useStyles = makeStyles((theme) => ({
  btnWrapper: { position: "relative" },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  hint: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  maskedKey: {
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
}));

const DEFAULT_VALUES = {
  name: "",
  provider: AI_PROVIDER_OPENAI,
  apiKey: "",
  enabled: true,
  isDefault: false,
};

function buildSchema(isEdit) {
  return Yup.object().shape({
    name: Yup.string()
      .trim()
      .min(1, i18n.t("aiAgent.credentials.formErrors.name.required"))
      .max(120, i18n.t("aiAgent.credentials.formErrors.name.long"))
      .required(i18n.t("aiAgent.credentials.formErrors.name.required")),
    provider: Yup.string().required(),
    apiKey: Yup.string().when(["provider"], (provider, schema) => {
      const base = isEdit
        ? schema.trim()
        : schema
            .trim()
            .required(i18n.t("aiAgent.credentials.formErrors.apiKey.required"));
      return base.test(
        "provider-key",
        i18n.t("aiAgent.credentials.formErrors.apiKey.invalid"),
        (val) => {
          if (!val) return isEdit;
          if (provider === AI_PROVIDER_OPENAI) {
            return /^sk-[A-Za-z0-9_-]{8,}$/.test(val) && val.length >= 20;
          }
          if (provider === AI_PROVIDER_GEMINI) {
            return /^[A-Za-z0-9_-]{20,256}$/.test(val);
          }
          return false;
        }
      );
    }),
  });
}

const AiProviderCredentialModal = ({ open, onClose, credentialId, onSaved }) => {
  const classes = useStyles();
  const [initialValues, setInitialValues] = useState(DEFAULT_VALUES);
  const [maskedKey, setMaskedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const schema = useMemo(() => buildSchema(Boolean(credentialId)), [credentialId]);

  useEffect(() => {
    if (!open) return;
    if (!credentialId) {
      setInitialValues({ ...DEFAULT_VALUES });
      setMaskedKey("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await getAiProviderCredential(credentialId);
        if (cancelled) return;
        setInitialValues({
          name: data.name || "",
          provider: data.provider || AI_PROVIDER_OPENAI,
          apiKey: "",
          enabled: !!data.enabled,
          isDefault: !!data.isDefault,
        });
        setMaskedKey(data.maskedKey || "");
      } catch (err) {
        toastError(err);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, credentialId, onClose]);

  const handleSubmit = async (values, actions) => {
    const payload = {
      name: values.name.trim(),
      provider: values.provider,
      enabled: values.enabled,
      isDefault: values.isDefault,
    };
    if (values.apiKey?.trim()) {
      payload.apiKey = values.apiKey.trim();
    }
    try {
      if (credentialId) {
        await updateAiProviderCredential(credentialId, payload);
        toast.success(i18n.t("aiAgent.credentials.toasts.updated"));
      } else {
        if (!payload.apiKey) {
          actions.setFieldError("apiKey", i18n.t("aiAgent.credentials.formErrors.apiKey.required"));
          actions.setSubmitting(false);
          return;
        }
        await createAiProviderCredential(payload);
        toast.success(i18n.t("aiAgent.credentials.toasts.created"));
      }
      onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      actions.setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        {credentialId
          ? i18n.t("aiAgent.credentials.modal.editTitle")
          : i18n.t("aiAgent.credentials.modal.newTitle")}
      </DialogTitle>
      {loading ? (
        <DialogContent>
          <CircularProgress size={32} />
        </DialogContent>
      ) : (
        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={schema}
          onSubmit={handleSubmit}
        >
          {({ touched, errors, isSubmitting, values }) => (
            <Form>
              <DialogContent dividers>
                <Typography variant="body2" className={classes.hint}>
                  {i18n.t("aiAgent.credentials.modal.hint")}
                </Typography>
                <Field
                  as={TextField}
                  name="name"
                  label={i18n.t("aiAgent.credentials.fields.name")}
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  autoFocus
                  error={touched.name && Boolean(errors.name)}
                  helperText={touched.name && errors.name}
                />
                <Field
                  as={TextField}
                  select
                  name="provider"
                  label={i18n.t("aiAgent.credentials.fields.provider")}
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  disabled={Boolean(credentialId)}
                >
                  <MenuItem value={AI_PROVIDER_OPENAI}>
                    {i18n.t("aiAgent.credentials.providers.openai")}
                  </MenuItem>
                  <MenuItem value={AI_PROVIDER_GEMINI}>
                    {i18n.t("aiAgent.credentials.providers.gemini")}
                  </MenuItem>
                </Field>
                {credentialId && maskedKey ? (
                  <Typography className={classes.maskedKey}>
                    {i18n.t("aiAgent.credentials.fields.currentKey")}: {maskedKey}
                  </Typography>
                ) : null}
                <Field
                  as={TextField}
                  name="apiKey"
                  type="password"
                  label={
                    credentialId
                      ? i18n.t("aiAgent.credentials.fields.apiKeyReplace")
                      : i18n.t("aiAgent.credentials.fields.apiKey")
                  }
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  error={touched.apiKey && Boolean(errors.apiKey)}
                  helperText={
                    (touched.apiKey && errors.apiKey) ||
                    (values.provider === AI_PROVIDER_OPENAI
                      ? i18n.t("aiAgent.credentials.formErrors.apiKey.invalidOpenAi")
                      : i18n.t("aiAgent.credentials.formErrors.apiKey.invalidGemini"))
                  }
                />
                <FormControlLabel
                  control={<Field as={Switch} name="enabled" color="primary" type="checkbox" />}
                  label={i18n.t("aiAgent.credentials.fields.enabled")}
                />
                <FormControlLabel
                  control={<Field as={Switch} name="isDefault" color="primary" type="checkbox" />}
                  label={i18n.t("aiAgent.credentials.fields.isDefault")}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>
                  {i18n.t("aiAgent.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={isSubmitting}
                  className={classes.btnWrapper}
                >
                  {i18n.t("aiAgent.buttons.save")}
                  {isSubmitting && (
                    <CircularProgress size={24} className={classes.buttonProgress} />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      )}
    </Dialog>
  );
};

export default AiProviderCredentialModal;
