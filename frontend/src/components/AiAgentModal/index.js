import React, { useEffect, useState } from "react";
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
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import Grid from "@material-ui/core/Grid";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  AI_AGENT_MAX_TOKENS_MAX,
  AI_AGENT_MAX_TOKENS_MIN,
  AI_AGENT_MODELS,
  AI_AGENT_TEMPERATURE_MAX,
  AI_AGENT_TEMPERATURE_MIN,
  DEFAULT_AI_AGENT_FORM,
} from "../../config/aiAgentFormDefaults";
import { createAiAgent, getAiAgent, updateAiAgent } from "../../services/aiAgentApi";

const useStyles = makeStyles((theme) => ({
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
  audioHint: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
}));

const schema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .min(1, i18n.t("aiAgent.formErrors.name.required"))
    .max(120, i18n.t("aiAgent.formErrors.name.long"))
    .required(i18n.t("aiAgent.formErrors.name.required")),
  model: Yup.string().required(i18n.t("aiAgent.formErrors.model.required")),
  temperature: Yup.number()
    .min(AI_AGENT_TEMPERATURE_MIN, i18n.t("aiAgent.formErrors.temperature.range"))
    .max(AI_AGENT_TEMPERATURE_MAX, i18n.t("aiAgent.formErrors.temperature.range"))
    .required(i18n.t("aiAgent.formErrors.temperature.required")),
  maxTokens: Yup.number()
    .integer(i18n.t("aiAgent.formErrors.maxTokens.integer"))
    .min(AI_AGENT_MAX_TOKENS_MIN, i18n.t("aiAgent.formErrors.maxTokens.range"))
    .max(AI_AGENT_MAX_TOKENS_MAX, i18n.t("aiAgent.formErrors.maxTokens.range"))
    .required(i18n.t("aiAgent.formErrors.maxTokens.required")),
});

const AiAgentModal = ({ open, onClose, agentId, onSaved }) => {
  const classes = useStyles();
  const [initialValues, setInitialValues] = useState(DEFAULT_AI_AGENT_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!agentId) {
      setInitialValues({ ...DEFAULT_AI_AGENT_FORM });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await getAiAgent(agentId);
        if (cancelled) return;
        setInitialValues({
          name: data.name || "",
          description: data.description || "",
          enabled: !!data.enabled,
          model: data.model || DEFAULT_AI_AGENT_FORM.model,
          temperature: data.temperature ?? DEFAULT_AI_AGENT_FORM.temperature,
          maxTokens: data.maxTokens ?? DEFAULT_AI_AGENT_FORM.maxTokens,
          systemPrompt: data.systemPrompt || "",
          fallbackMessage: data.fallbackMessage || "",
          handoffMessage: data.handoffMessage || "",
          allowAudioInput: false,
          allowAudioOutput: false,
        });
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
  }, [open, agentId, onClose]);

  const handleSubmit = async (values, actions) => {
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      enabled: values.enabled,
      model: values.model,
      temperature: Number(values.temperature),
      maxTokens: Number(values.maxTokens),
      systemPrompt: values.systemPrompt?.trim() || null,
      fallbackMessage: values.fallbackMessage?.trim() || null,
      handoffMessage: values.handoffMessage?.trim() || null,
    };
    try {
      if (agentId) {
        await updateAiAgent(agentId, payload);
        toast.success(i18n.t("aiAgent.toasts.updated"));
      } else {
        await createAiAgent(payload);
        toast.success(i18n.t("aiAgent.toasts.created"));
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>
        {agentId
          ? i18n.t("aiAgent.modal.editTitle")
          : i18n.t("aiAgent.modal.newTitle")}
      </DialogTitle>
      <Formik
        enableReinitialize
        initialValues={initialValues}
        validationSchema={schema}
        onSubmit={handleSubmit}
      >
        {({ touched, errors, isSubmitting, values, setFieldValue }) => (
          <Form>
            <DialogContent dividers>
              {loading ? (
                <CircularProgress size={32} />
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <Field
                      as={TextField}
                      name="name"
                      label={i18n.t("aiAgent.fields.name")}
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.enabled}
                          onChange={(e) =>
                            setFieldValue("enabled", e.target.checked)
                          }
                          color="primary"
                        />
                      }
                      label={i18n.t("aiAgent.fields.enabled")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      name="description"
                      label={i18n.t("aiAgent.fields.description")}
                      fullWidth
                      multiline
                      rows={2}
                      variant="outlined"
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      select
                      name="model"
                      label={i18n.t("aiAgent.fields.model")}
                      fullWidth
                      variant="outlined"
                      margin="dense"
                    >
                      {AI_AGENT_MODELS.map((m) => (
                        <MenuItem key={m} value={m}>
                          {m}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field
                      as={TextField}
                      name="temperature"
                      type="number"
                      inputProps={{
                        min: AI_AGENT_TEMPERATURE_MIN,
                        max: AI_AGENT_TEMPERATURE_MAX,
                        step: 0.1,
                      }}
                      label={i18n.t("aiAgent.fields.temperature")}
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      error={touched.temperature && Boolean(errors.temperature)}
                      helperText={touched.temperature && errors.temperature}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Field
                      as={TextField}
                      name="maxTokens"
                      type="number"
                      inputProps={{
                        min: AI_AGENT_MAX_TOKENS_MIN,
                        max: AI_AGENT_MAX_TOKENS_MAX,
                        step: 1,
                      }}
                      label={i18n.t("aiAgent.fields.maxTokens")}
                      fullWidth
                      variant="outlined"
                      margin="dense"
                      error={touched.maxTokens && Boolean(errors.maxTokens)}
                      helperText={touched.maxTokens && errors.maxTokens}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Field
                      as={TextField}
                      name="systemPrompt"
                      label={i18n.t("aiAgent.fields.systemPrompt")}
                      fullWidth
                      multiline
                      rows={4}
                      variant="outlined"
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="fallbackMessage"
                      label={i18n.t("aiAgent.fields.fallbackMessage")}
                      fullWidth
                      multiline
                      rows={3}
                      variant="outlined"
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="handoffMessage"
                      label={i18n.t("aiAgent.fields.handoffMessage")}
                      fullWidth
                      multiline
                      rows={3}
                      variant="outlined"
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Tooltip title={i18n.t("aiAgent.fields.audioComingSoon")}>
                      <FormControlLabel
                        control={<Switch checked={false} disabled />}
                        label={i18n.t("aiAgent.fields.allowAudioInput")}
                      />
                    </Tooltip>
                    <Typography variant="caption" className={classes.audioHint}>
                      {i18n.t("aiAgent.fields.audioComingSoon")}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Tooltip title={i18n.t("aiAgent.fields.audioComingSoon")}>
                      <FormControlLabel
                        control={<Switch checked={false} disabled />}
                        label={i18n.t("aiAgent.fields.allowAudioOutput")}
                      />
                    </Tooltip>
                    <Typography variant="caption" className={classes.audioHint}>
                      {i18n.t("aiAgent.fields.audioComingSoon")}
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={onClose} color="secondary" disabled={isSubmitting}>
                {i18n.t("aiAgent.buttons.cancel")}
              </Button>
              <div className={classes.btnWrapper}>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={isSubmitting || loading}
                >
                  {i18n.t("aiAgent.buttons.save")}
                </Button>
                {isSubmitting && (
                  <CircularProgress size={24} className={classes.buttonProgress} />
                )}
              </div>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default AiAgentModal;
