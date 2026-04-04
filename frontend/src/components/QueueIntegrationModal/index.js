import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  TextField,
  Grid,
  Paper,
  Typography,
  ListSubheader,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
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
  btnLeft: {
    display: "flex",
    marginRight: "auto",
    marginLeft: 12,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
  typeHint: {
    marginTop: 8,
    marginBottom: 4,
  },
}));

const integrationSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
});



const QueueIntegration = ({ open, onClose, integrationId }) => {
  const classes = useStyles();

  const initialState = {
    type: "typebot",
    name: "",
    projectName: "",
    jsonContent: "",
    language: "",
    urlN8N: "",
    typebotDelayMessage: 1000,
    typebotExpires: 1,
    typebotKeywordFinish: "",
    typebotKeywordRestart: "",
    typebotRestartMessage: "",
    typebotSlug: "",
    typebotUnknownMessage: "",

  };

  const [integration, setIntegration] = useState(initialState);

  useEffect(() => {
    (async () => {
      if (!integrationId) return;
      try {
        const { data } = await api.get(`/queueIntegration/${integrationId}`);
        setIntegration((prevState) => {
          return { ...prevState, ...data };
        });
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setIntegration(initialState);
    };

  }, [integrationId, open]);

  const handleClose = () => {
    onClose();
    setIntegration(initialState);
  };

  const typeDescription = (type) => {
    if (type === "flowbuilder") {
      return i18n.t("queueIntegrationModal.descriptions.flowbuilder");
    }
    if (type === "typebot") {
      return i18n.t("queueIntegrationModal.descriptions.typebot");
    }
    if (type === "n8n" || type === "webhook") {
      return i18n.t("queueIntegrationModal.descriptions.webhookN8n");
    }
    return "";
  };

  const handleSaveDialogflow = async (values) => {
    try {
      if (values.type === 'n8n' || values.type === 'webhook' || values.type === 'typebot' || values.type === "flowbuilder") values.projectName = values.name
      if (integrationId) {
        await api.put(`/queueIntegration/${integrationId}`, values);
        toast.success(i18n.t("queueIntegrationModal.messages.editSuccess"));
      } else {
        await api.post("/queueIntegration", values);
        toast.success(i18n.t("queueIntegrationModal.messages.addSuccess"));
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>
          {integrationId
            ? `${i18n.t("queueIntegrationModal.title.edit")}`
            : `${i18n.t("queueIntegrationModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={integrationSchema}
          onSubmit={(values, actions, event) => {
            setTimeout(() => {
              handleSaveDialogflow(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values }) => (
            <Form>
              <Paper square className={classes.mainPaper} elevation={1}>
                <DialogContent dividers>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Alert severity="info">{i18n.t("queueIntegrationModal.intro")}</Alert>
                    </Grid>
                    <Grid item xs={12} md={6} xl={6}>
                      <FormControl
                        variant="outlined"
                        className={classes.formControl}
                        margin="dense"
                        fullWidth
                      >
                        <InputLabel id="type-selection-input-label">
                          {i18n.t("queueIntegrationModal.form.type")}
                        </InputLabel>

                        <Field
                          as={Select}
                          label={i18n.t("queueIntegrationModal.form.type")}
                          name="type"
                          labelId="profile-selection-label"
                          error={touched.type && Boolean(errors.type)}
                          helpertext={touched.type && errors.type}
                          id="type"
                          required
                        >
                          <ListSubheader>{i18n.t("queueIntegrationModal.groups.internal")}</ListSubheader>
                          <MenuItem value="flowbuilder">
                            {i18n.t("queueIntegrationModal.types.flowbuilder")}
                          </MenuItem>
                          <MenuItem value="typebot">
                            {i18n.t("queueIntegrationModal.types.typebot")}
                          </MenuItem>
                          <ListSubheader>{i18n.t("queueIntegrationModal.groups.external")}</ListSubheader>
                          <MenuItem value="n8n">{i18n.t("queueIntegrationModal.types.n8n")}</MenuItem>
                          <MenuItem value="webhook">
                            {i18n.t("queueIntegrationModal.types.webhook")}
                          </MenuItem>
                          {values.type === "dialogflow" && (
                            <>
                              <ListSubheader>{i18n.t("queueIntegrationModal.groups.legacy")}</ListSubheader>
                              <MenuItem value="dialogflow" disabled>
                                {i18n.t("queueIntegrationModal.types.dialogflow")}
                              </MenuItem>
                            </>
                          )}
                        </Field>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      {values.type === "dialogflow" ? (
                        <Typography variant="body2" color="textSecondary" className={classes.typeHint}>
                          {i18n.t("queueIntegrationModal.form.legacyDialogflowHint")}
                        </Typography>
                      ) : (
                        typeDescription(values.type) && (
                          <Typography variant="body2" color="textSecondary" className={classes.typeHint}>
                            {typeDescription(values.type)}
                          </Typography>
                        )
                      )}
                      {(values.type === "flowbuilder" || values.type === "typebot") && (
                        <Alert severity="info" style={{ marginTop: 12 }}>
                          {i18n.t("queueIntegrationModal.alerts.internalHint")}
                        </Alert>
                      )}
                      {(values.type === "n8n" || values.type === "webhook") && (
                        <Alert severity="warning" style={{ marginTop: 12 }}>
                          {i18n.t("queueIntegrationModal.alerts.externalPost")}
                        </Alert>
                      )}
                    </Grid>
                    {values.type === "dialogflow" && (
                      <>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {i18n.t("queueIntegrationModal.form.legacyDialogflowHint")}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6}>
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                      </>
                    )}

                    {(values.type === "n8n" || values.type === "webhook") && (
                      <>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            required
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helperText={
                              (touched.urlN8N && errors.urlN8N) ||
                              i18n.t("queueIntegrationModal.form.urlWebhookHelper")
                            }
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                      </>
                    )}

                    {(values.type === "typebot") && (
                      <>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helpertext={touched.urlN8N && errors.urlN8N}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotSlug")}
                            name="typebotSlug"
                            error={touched.typebotSlug && Boolean(errors.typebotSlug)}
                            helpertext={touched.typebotSlug && errors.typebotSlug}
                            required
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotExpires")}
                            name="typebotExpires"
                            error={touched.typebotExpires && Boolean(errors.typebotExpires)}
                            helpertext={touched.typebotExpires && errors.typebotExpires}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotDelayMessage")}
                            name="typebotDelayMessage"
                            error={touched.typebotDelayMessage && Boolean(errors.typebotDelayMessage)}
                            helpertext={touched.typebotDelayMessage && errors.typebotDelayMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotKeywordFinish")}
                            name="typebotKeywordFinish"
                            error={touched.typebotKeywordFinish && Boolean(errors.typebotKeywordFinish)}
                            helpertext={touched.typebotKeywordFinish && errors.typebotKeywordFinish}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotKeywordRestart")}
                            name="typebotKeywordRestart"
                            error={touched.typebotKeywordRestart && Boolean(errors.typebotKeywordRestart)}
                            helpertext={touched.typebotKeywordRestart && errors.typebotKeywordRestart}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotUnknownMessage")}
                            name="typebotUnknownMessage"
                            error={touched.typebotUnknownMessage && Boolean(errors.typebotUnknownMessage)}
                            helpertext={touched.typebotUnknownMessage && errors.typebotUnknownMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotRestartMessage")}
                            name="typebotRestartMessage"
                            error={touched.typebotRestartMessage && Boolean(errors.typebotRestartMessage)}
                            helpertext={touched.typebotRestartMessage && errors.typebotRestartMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        
                      </>
                    )}

                    {(values.type === "flowbuilder") && (
                      <Grid item xs={12} md={6} xl={6} >
                        <Field
                          as={TextField}
                          label={i18n.t("queueIntegrationModal.form.name")}
                          autoFocus
                          name="name"
                          fullWidth
                          error={touched.name && Boolean(errors.name)}
                          helpertext={touched.name && errors.name}
                          variant="outlined"
                          margin="dense"
                          className={classes.textField}
                        />
                      </Grid>
                    )}
                  </Grid>
                </DialogContent>
              </Paper>

              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("queueIntegrationModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {integrationId
                    ? `${i18n.t("queueIntegrationModal.buttons.okEdit")}`
                    : `${i18n.t("queueIntegrationModal.buttons.okAdd")}`}
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
    </div >
  );
};

export default QueueIntegration;