import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Box,
  Typography,
} from "@material-ui/core";
import { FileCopyOutlined, Refresh } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const useStyles = makeStyles((theme) => ({
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
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("whatsappModal.formErrors.name.short"))
    .max(50, i18n.t("whatsappModal.formErrors.name.long"))
    .required(i18n.t("whatsappModal.formErrors.name.required")),
});

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {

  const classes = useStyles();
  const initialState = {
    name: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    isDefault: false,
    autoReadMessages: true,
    token: "",
    provider: "beta",
    //timeSendQueue: 0,
    //sendIdQueue: 0,
    expiresInactiveMessage: "",
    expiresTicket: 0,
    timeUseBotQueues: 0,
    maxUseBotQueues: 3,
    integration: null,
    flowIdWelcome: null,
    flowIdNotPhrase: null
  };

  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null)
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [flows, setFlows] = useState([]);
  const [selectedFlowWelcome, setSelectedFlowWelcome] = useState(null);
  const [selectedFlowNotPhrase, setSelectedFlowNotPhrase] = useState(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      toast.success(i18n.t("whatsappModal.form.tokenCopied"));
    }).catch(() => toastError(new Error("Falha ao copiar")));
  };

  const handleGenerateToken = async (setFieldValue) => {
    if (!whatsAppId) return;
    setGeneratingToken(true);
    try {
      const { data } = await api.put(`/whatsapp/${whatsAppId}/token`);
      setFieldValue("token", data.token);
      setWhatsApp(prev => ({ ...prev, token: data.token }));
      copyToClipboard(data.token);
    } catch (err) {
      toastError(err);
    } finally {
      setGeneratingToken(false);
    }
  };

    useEffect(() => {
      const fetchSession = async () => {
        if (!whatsAppId) return;

        try {
          
          const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);

          setWhatsApp(data);
          setSelectedPrompt( data.promptId );
          setSelectedIntegration(data.integrationId)

          const whatsQueueIds = data.queues?.map((queue) => queue.id);
          setSelectedQueueIds(whatsQueueIds);
          setSelectedQueueId(data.transferQueueId);
          setSelectedFlowWelcome(data.flowIdWelcome || null);
          setSelectedFlowNotPhrase(data.flowIdNotPhrase || null);
        } catch (err) {
          toastError(err);
        }
      };
      fetchSession();
    }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/prompt");
        setPrompts(data?.prompts ?? []);

        const { data: dataIntegration } = await api.get("/queueIntegration");
        setIntegrations(dataIntegration?.queueIntegrations ?? []);

        const { data: dataFlows } = await api.get("/flowbuilder");
        setFlows(dataFlows?.flows ?? []);

      } catch (err) {
        toastError(err);
      }
    })();
  }, [whatsAppId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const handleSaveWhatsApp = async (values) => {
    const whatsappData = {
      ...values, queueIds: selectedQueueIds, transferQueueId: selectedQueueId,
      promptId: selectedPrompt ? selectedPrompt : null,
      integrationId: selectedIntegration,
      flowIdWelcome: selectedFlowWelcome || null,
      flowIdNotPhrase: selectedFlowNotPhrase || null
    };
    delete whatsappData["queues"];
    delete whatsappData["session"];
    if (!whatsAppId) {
      delete whatsappData["token"];
    }

    try {
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
        toast.success(i18n.t("whatsappModal.success"));
        handleClose();
      } else {
        const { data } = await api.post("/whatsapp", whatsappData);
        toast.success(i18n.t("whatsappModal.success"));
        if (data.token) {
          setCreatedToken(data.token);
          setTokenDialogOpen(true);
        } else {
          handleClose();
        }
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleChangeQueue = (e) => {
    setSelectedQueueIds(e);
    setSelectedPrompt(null);
  };

  const handleChangePrompt = (e) => {
    setSelectedPrompt(e.target.value);
    setSelectedQueueIds([]);
  };

  const handleChangeIntegration = (e) => {
    setSelectedIntegration(e.target.value);
  }

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
	  setSelectedQueueId(null);
    setSelectedQueueIds([]);
    setSelectedFlowWelcome(null);
    setSelectedFlowNotPhrase(null);
    setTokenDialogOpen(false);
    setCreatedToken("");
  };

  const handleCloseTokenDialog = () => {
    setTokenDialogOpen(false);
    setCreatedToken("");
    handleClose();
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {whatsAppId
            ? i18n.t("whatsappModal.title.edit")
            : i18n.t("whatsappModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Grid spacing={2} container>
                    <Grid item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.name")}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        className={classes.textField}
                      />
                    </Grid>
                    <Grid style={{ paddingTop: 15 }} item>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="isDefault"
                            checked={values.isDefault}
                          />
                        }
                        label={i18n.t("whatsappModal.form.default")}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="autoReadMessages"
                            checked={values.autoReadMessages !== false}
                          />
                        }
                        label={i18n.t("whatsappModal.form.autoReadMessages")}
                      />
                      <Typography variant="caption" color="textSecondary" display="block">
                        {i18n.t("whatsappModal.form.autoReadMessagesHint")}
                      </Typography>
                    </Grid>
                  </Grid>
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.greetingMessage")}
                    type="greetingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="greetingMessage"
                    error={
                      touched.greetingMessage && Boolean(errors.greetingMessage)
                    }
                    helperText={
                      touched.greetingMessage && errors.greetingMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.complationMessage")}
                    type="complationMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="complationMessage"
                    error={
                      touched.complationMessage &&
                      Boolean(errors.complationMessage)
                    }
                    helperText={
                      touched.complationMessage && errors.complationMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.outOfHoursMessage")}
                    type="outOfHoursMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="outOfHoursMessage"
                    error={
                      touched.outOfHoursMessage &&
                      Boolean(errors.outOfHoursMessage)
                    }
                    helperText={
                      touched.outOfHoursMessage && errors.outOfHoursMessage
                    }
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("queueModal.form.ratingMessage")}
                    type="ratingMessage"
                    multiline
                    rows={4}
                    fullWidth
                    name="ratingMessage"
                    error={
                      touched.ratingMessage && Boolean(errors.ratingMessage)
                    }
                    helperText={touched.ratingMessage && errors.ratingMessage}
                    variant="outlined"
                    margin="dense"
                  />
                </div>
                <div>
                  {whatsAppId ? (
                    <Box display="flex" alignItems="flex-start" gap={1} flexWrap="wrap">
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.token")}
                        name="token"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">
                              <Button
                                size="small"
                                startIcon={<FileCopyOutlined />}
                                onClick={() => copyToClipboard(values.token)}
                                disabled={!values.token}
                              >
                                {i18n.t("whatsappModal.form.copyToken")}
                              </Button>
                              <Button
                                size="small"
                                startIcon={generatingToken ? <CircularProgress size={16} /> : <Refresh />}
                                onClick={() => handleGenerateToken(setFieldValue)}
                                disabled={generatingToken}
                                style={{ marginLeft: 8 }}
                              >
                                {i18n.t("whatsappModal.form.generateToken")}
                              </Button>
                            </InputAdornment>
                          ),
                        }}
                        helperText={i18n.t("whatsappModal.form.tokenReadOnly")}
                      />
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary" style={{ marginTop: 8, marginBottom: 8 }}>
                      {i18n.t("whatsappModal.form.tokenReadOnly")} {i18n.t("whatsappModal.form.tokenCreatedMessage").split(".")[0]}.
                    </Typography>
                  )}
                </div>
                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                />
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>
                    {i18n.t("whatsappModal.form.prompt")}
                  </InputLabel>
                  <Select
                    labelId="dialog-select-prompt-label"
                    id="dialog-select-prompt"
                    name="promptId"
                    value={selectedPrompt || ""}
                    onChange={handleChangePrompt}
                    label={i18n.t("whatsappModal.form.prompt")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    {prompts.map((prompt) => (
                      <MenuItem
                        key={prompt.id}
                        value={prompt.id}
                      >
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>
                    {i18n.t("whatsappModal.form.integration")}
                  </InputLabel>
                  <Select
                    labelId="dialog-select-integration-label"
                    id="dialog-select-integration"
                    name="promptId"
                    value={selectedIntegration || ""}
                    onChange={handleChangeIntegration}
                    label={i18n.t("whatsappModal.form.integration")}
                    fullWidth
                    MenuProps={{
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                      getContentAnchorEl: null,
                    }}
                  >
                    {(integrations || []).map((prompt) => (
                      <MenuItem
                        key={prompt.id}
                        value={prompt.id}
                      >
                        {prompt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>Fluxo de boas-vindas</InputLabel>
                  <Select
                    labelId="dialog-select-flow-welcome-label"
                    id="dialog-select-flow-welcome"
                    value={selectedFlowWelcome || ""}
                    onChange={(e) => setSelectedFlowWelcome(e.target.value || null)}
                    label="Fluxo de boas-vindas"
                    fullWidth
                    MenuProps={{
                      anchorOrigin: { vertical: "bottom", horizontal: "left" },
                      transformOrigin: { vertical: "top", horizontal: "left" },
                      getContentAnchorEl: null,
                    }}
                  >
                    <MenuItem value="">
                      <em>Nenhum</em>
                    </MenuItem>
                    {(flows || []).map((flow) => (
                      <MenuItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 4 }}>
                    Executa quando o cliente retorna e envia uma mensagem que não corresponde a nenhuma frase de campanha
                  </Typography>
                </FormControl>
                <FormControl
                  margin="dense"
                  variant="outlined"
                  fullWidth
                >
                  <InputLabel>Fluxo padrão (primeira mensagem)</InputLabel>
                  <Select
                    labelId="dialog-select-flow-notphrase-label"
                    id="dialog-select-flow-notphrase"
                    value={selectedFlowNotPhrase || ""}
                    onChange={(e) => setSelectedFlowNotPhrase(e.target.value || null)}
                    label="Fluxo padrão (primeira mensagem)"
                    fullWidth
                    MenuProps={{
                      anchorOrigin: { vertical: "bottom", horizontal: "left" },
                      transformOrigin: { vertical: "top", horizontal: "left" },
                      getContentAnchorEl: null,
                    }}
                  >
                    <MenuItem value="">
                      <em>Nenhum</em>
                    </MenuItem>
                    {(flows || []).map((flow) => (
                      <MenuItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 4 }}>
                    Executa na primeira mensagem do cliente quando não corresponde a nenhuma frase de campanha
                  </Typography>
                </FormControl>
                <div>
                  <h3>{i18n.t("whatsappModal.form.queueRedirection")}</h3>
                  <p>{i18n.t("whatsappModal.form.queueRedirectionDesc")}</p>
				<Grid container spacing={2}>
                  <Grid item sm={6} >
                    <Field
                      fullWidth
                      type="number"
                      as={TextField}
                      label={i18n.t("whatsappModal.form.timeToTransfer")}
                      name="timeToTransfer"
                      error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                      helperText={touched.timeToTransfer && errors.timeToTransfer}
                      variant="outlined"
                      margin="dense"
                      className={classes.textField}
                      InputLabelProps={{ shrink: values.timeToTransfer ? true : false }}
                    />

                  </Grid>

                  <Grid item sm={6}>
                    <QueueSelect
                      selectedQueueIds={selectedQueueId}
                      onChange={(selectedId) => {
                        setSelectedQueueId(selectedId)
                      }}
                      multiple={false}
                      title={i18n.t("whatsappModal.form.queue")}
                    />
                  </Grid>

                  </Grid>
                  <Grid spacing={2} container>
                    {/* ENCERRAR CHATS ABERTOS APÓS X HORAS */}
                    <Grid xs={12} md={12} item>
                      <Field
                        as={TextField}
                        label={i18n.t("whatsappModal.form.expiresTicket")}
                        fullWidth
                        name="expiresTicket"
                        variant="outlined"
                        margin="dense"
                        error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                        helperText={touched.expiresTicket && errors.expiresTicket}
                      />
                    </Grid>
                  </Grid>
                  {/* MENSAGEM POR INATIVIDADE*/}
                  <div>
                    <Field
                      as={TextField}
                      label={i18n.t("whatsappModal.form.expiresInactiveMessage")}
                      multiline
                      rows={4}
                      fullWidth
                      name="expiresInactiveMessage"
                      error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                      helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                      variant="outlined"
                      margin="dense"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {whatsAppId
                    ? i18n.t("whatsappModal.buttons.okEdit")
                    : i18n.t("whatsappModal.buttons.okAdd")}
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

      <Dialog open={tokenDialogOpen} onClose={handleCloseTokenDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("whatsappModal.form.tokenCreatedTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            {i18n.t("whatsappModal.form.tokenCreatedMessage")}
          </Typography>
          <TextField
            fullWidth
            label={i18n.t("whatsappModal.form.token")}
            value={createdToken}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    startIcon={<FileCopyOutlined />}
                    onClick={() => copyToClipboard(createdToken)}
                  >
                    {i18n.t("whatsappModal.form.copyToken")}
                  </Button>
                </InputAdornment>
              ),
            }}
            variant="outlined"
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTokenDialog} color="primary" variant="contained">
            {i18n.t("whatsappModal.buttons.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);
