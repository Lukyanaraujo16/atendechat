import React, { useState, useEffect, useRef, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field, useFormikContext } from "formik";
import { head } from "lodash";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import moment from "moment";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";

const PREVIEW_VARS = {
  nome: "João",
  numero: "5511999999999",
  email: "joao@email.com",
};

function buildPreviewMessage(text) {
  if (!text) return "";
  let s = String(text);
  s = s.replace(/{nome}/g, PREVIEW_VARS.nome);
  s = s.replace(/{numero}/g, PREVIEW_VARS.numero);
  s = s.replace(/{email}/g, PREVIEW_VARS.email);
  return s;
}

function hasNumericTag(tagListId) {
  if (tagListId === "" || tagListId === "Nenhuma" || tagListId == null) {
    return false;
  }
  const n = Number(tagListId);
  return Number.isFinite(n) && n > 0;
}

function hasContactList(contactListId) {
  if (contactListId === "" || contactListId == null) return false;
  const n = Number(contactListId);
  return Number.isFinite(n) && n > 0;
}

function CampaignFormEffects({ campaignId, open, setContactStats }) {
  const { values } = useFormikContext();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setContactStats((prev) => ({ ...prev, loading: true }));

      const listId = values.contactListId;
      const tagSel = hasNumericTag(values.tagListId);

      try {
        if (tagSel && hasContactList(listId)) {
          const { data } = await api.get("/campaigns/tag-estimate", {
            params: {
              tagId: values.tagListId,
              contactListId: listId,
            },
          });
          if (!cancelled) {
            setContactStats({
              total: data.total,
              valid: data.valid,
              invalid: data.invalid,
              loading: false,
            });
          }
          return;
        }

        if (tagSel && !hasContactList(listId)) {
          const { data } = await api.get("/campaigns/tag-estimate", {
            params: { tagId: values.tagListId },
          });
          if (!cancelled) {
            setContactStats({
              total: data.total,
              valid: data.valid,
              invalid: data.invalid,
              loading: false,
            });
          }
          return;
        }

        if (hasContactList(listId)) {
          const { data } = await api.get("/campaigns/contact-list-count", {
            params: { contactListId: listId },
          });
          if (!cancelled) {
            setContactStats({
              total: data.total,
              valid: data.valid,
              invalid: data.invalid,
              loading: false,
            });
          }
          return;
        }

        if (campaignId) {
          const { data } = await api.get(
            `/campaigns/${campaignId}/contacts-count`
          );
          if (!cancelled) {
            setContactStats({
              total: data.total,
              valid: data.valid,
              invalid: data.invalid,
              loading: false,
            });
          }
          return;
        }

        if (!cancelled) {
          setContactStats({
            total: 0,
            valid: 0,
            invalid: 0,
            loading: false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          toastError(err);
          setContactStats({
            total: 0,
            valid: 0,
            invalid: 0,
            loading: false,
          });
        }
      }
    }

    if (open) {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, [
    values.contactListId,
    values.tagListId,
    campaignId,
    open,
    setContactStats,
  ]);

  return null;
}

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    backgroundColor: "#fff",
  },

  tabmsg: {
    backgroundColor: theme.palette.campaigntab,
  },

  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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

  previewBox: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
}));

const CampaignSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("campaigns.dialog.form.nameShort"))
    .max(50, i18n.t("campaigns.dialog.form.nameLong"))
    .required(i18n.t("campaigns.dialog.form.nameRequired")),
});

const CampaignModal = ({
  open,
  onClose,
  campaignId,
  initialValues,
  onSave,
  resetPagination,
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const { user } = useContext(AuthContext);
  const { companyId } = user;
  const [file, setFile] = useState(null);

  const initialState = {
    name: "",
    message1: "",
    message2: "",
    message3: "",
    message4: "",
    message5: "",
    status: "INATIVA",
    scheduledAt: "",
    whatsappId: "",
    contactListId: "",
    tagListId: "Nenhuma",
    companyId,
  };

  const [campaign, setCampaign] = useState(initialState);
  const [whatsapps, setWhatsapps] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [messageTab, setMessageTab] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [campaignEditable, setCampaignEditable] = useState(true);
  const attachmentFile = useRef(null);
  const [tagLists, setTagLists] = useState([]);
  const [contactStats, setContactStats] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    loading: false,
  });
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const pendingSubmitRef = useRef(null);
  const [opsSummary, setOpsSummary] = useState(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/files/", {
          params: { companyId },
        });

        setFile(Array.isArray(data?.files) ? data.files : []);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      if (initialValues) {
        setCampaign((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      api
        .get(`/contact-lists/list`, { params: { companyId } })
        .then(({ data }) => setContactLists(Array.isArray(data) ? data : []));

      api
        .get(`/whatsapp`, { params: { companyId, session: 0 } })
        .then(({ data }) => setWhatsapps(Array.isArray(data) ? data : []));

      api
        .get(`/tags`, { params: { companyId } })
        .then(({ data }) => {
          const fetchedTags = Array.isArray(data?.tags) ? data.tags : [];
          const formattedTagLists = fetchedTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
          }));
          setTagLists(formattedTagLists);
        })
        .catch((error) => {
          console.error("Error retrieving tags:", error);
        });

      if (!campaignId) return;

      api.get(`/campaigns/${campaignId}`).then(({ data }) => {
        setCampaign((prev) => {
          let prevCampaignData = Object.assign({}, prev);

          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value !== "" && value !== null) {
              prevCampaignData[key] = moment(value).format("YYYY-MM-DDTHH:mm");
            } else {
              prevCampaignData[key] = value === null ? "" : value;
            }
          });

          return { ...prevCampaignData, tagListId: data.tagId || "Nenhuma" };
        });
      });
    }
  }, [campaignId, open, initialValues, companyId]);

  useEffect(() => {
    const now = moment();
    const scheduledAt = moment(campaign.scheduledAt);
    const moreThenAnHour =
      !Number.isNaN(scheduledAt.diff(now)) && scheduledAt.diff(now, "hour") > 1;
    const isEditable =
      campaign.status === "INATIVA" ||
      (campaign.status === "PROGRAMADA" && moreThenAnHour);

    setCampaignEditable(isEditable);
  }, [campaign.status, campaign.scheduledAt]);

  useEffect(() => {
    if (!open || !campaignId) {
      setOpsSummary(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/campaigns/${campaignId}/progress`)
      .then(({ data }) => {
        if (!cancelled) {
          setOpsSummary(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpsSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, campaignId, campaign.status]);

  const handleClose = () => {
    onClose();
    setCampaign(initialState);
    pendingSubmitRef.current = null;
    setSubmitConfirmOpen(false);
    setOpsSummary(null);
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveCampaign = async (values, actions = null) => {
    try {
      const dataValues = {};
      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          dataValues[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
        } else {
          dataValues[key] = value === "" ? null : value;
        }
      });

      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${campaignId}/media-upload`, formData);
        }
        handleClose();
      } else {
        const { data } = await api.post("/campaigns", dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${data.id}/media-upload`, formData);
        }
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      showSuccessToast("campaigns.toasts.success");
    } catch (err) {
      console.log(err);
      toastError(err);
    } finally {
      if (actions && typeof actions.setSubmitting === "function") {
        actions.setSubmitting(false);
      }
    }
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (campaign.mediaPath) {
      await api.delete(`/campaigns/${campaign.id}/media-upload`);
      setCampaign((prev) => ({ ...prev, mediaPath: null, mediaName: null }));
      showSuccessToast("campaigns.toasts.deleted");
    }
  };

  const renderMessageField = (identifier) => {
    return (
      <Field
        as={TextField}
        id={identifier}
        name={identifier}
        fullWidth
        rows={5}
        label={i18n.t(`campaigns.dialog.form.${identifier}`)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        multiline={true}
        variant="outlined"
        helperText={i18n.t("campaigns.dialog.form.helper")}
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    );
  };

  const cancelCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      showSuccessToast("campaigns.toasts.cancel");
      setCampaign((prev) => ({ ...prev, status: "CANCELADA" }));
      resetPagination();
    } catch (err) {
      toastError(err);
    }
  };

  const runRestartCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      showSuccessToast("campaigns.toasts.restart");
      setCampaign((prev) => ({ ...prev, status: "EM_ANDAMENTO" }));
      resetPagination();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmSubmitMessage = () => {
    if (contactStats.valid > 0) {
      return i18n.t("campaigns.dialog.confirmSend.messageWithCount", {
        count: contactStats.valid,
      });
    }
    return i18n.t("campaigns.dialog.confirmSend.generic");
  };

  const previewField = `message${messageTab + 1}`;

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ConfirmationModal
        title={i18n.t("campaigns.dialog.confirmSend.title")}
        open={submitConfirmOpen}
        onClose={() => {
          setSubmitConfirmOpen(false);
          if (pendingSubmitRef.current?.actions) {
            pendingSubmitRef.current.actions.setSubmitting(false);
          }
          pendingSubmitRef.current = null;
        }}
        onConfirm={() => {
          const p = pendingSubmitRef.current;
          pendingSubmitRef.current = null;
          setSubmitConfirmOpen(false);
          if (p) {
            handleSaveCampaign(p.values, p.actions);
          }
        }}
        confirmText={i18n.t("campaigns.dialog.confirmSend.confirm")}
      >
        {confirmSubmitMessage()}
      </ConfirmationModal>
      <ConfirmationModal
        title={i18n.t("campaigns.dialog.confirmRestart.title")}
        open={restartConfirmOpen}
        onClose={() => setRestartConfirmOpen(false)}
        onConfirm={() => {
          setRestartConfirmOpen(false);
          runRestartCampaign();
        }}
        confirmText={i18n.t("campaigns.dialog.confirmRestart.confirm")}
      >
        {i18n.t("campaigns.dialog.confirmRestart.message")}
      </ConfirmationModal>
      <AppDialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <AppDialogTitle id="form-dialog-title">
          {campaignEditable ? (
            <>
              {campaignId
                ? `${i18n.t("campaigns.dialog.update")}`
                : `${i18n.t("campaigns.dialog.new")}`}
            </>
          ) : (
            <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
          )}
        </AppDialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        <Formik
          initialValues={campaign}
          enableReinitialize={true}
          validationSchema={CampaignSchema}
          onSubmit={(values, actions) => {
            pendingSubmitRef.current = { values, actions };
            setSubmitConfirmOpen(true);
          }}
        >
          {({ values, errors, touched, isSubmitting }) => (
            <Form>
              <CampaignFormEffects
                campaignId={campaignId}
                open={open}
                setContactStats={setContactStats}
              />
              <AppDialogContent dividers>
                <Grid spacing={2} container>
                  <Grid xs={12} md={9} item>
                    <Field
                      as={TextField}
                      label={i18n.t("campaigns.dialog.form.name")}
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.textField}
                      disabled={!campaignEditable}
                    />
                  </Grid>
                  <Grid xs={12} md={4} item>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="contactList-selection-label">
                        {i18n.t("campaigns.dialog.form.contactList")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.contactList")}
                        placeholder={i18n.t(
                          "campaigns.dialog.form.contactList"
                        )}
                        labelId="contactList-selection-label"
                        id="contactListId"
                        name="contactListId"
                        error={
                          touched.contactListId && Boolean(errors.contactListId)
                        }
                        disabled={!campaignEditable}
                      >
                        <MenuItem value="">Nenhuma</MenuItem>
                        {(Array.isArray(contactLists) ? contactLists : []).map(
                          (contactList) => (
                            <MenuItem
                              key={contactList.id}
                              value={contactList.id}
                            >
                              {contactList.name}
                            </MenuItem>
                          )
                        )}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} md={4} item>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="tagList-selection-label">
                        {i18n.t("campaigns.dialog.form.tagList")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.tagList")}
                        placeholder={i18n.t("campaigns.dialog.form.tagList")}
                        labelId="tagList-selection-label"
                        id="tagListId"
                        name="tagListId"
                        error={touched.tagListId && Boolean(errors.tagListId)}
                        disabled={!campaignEditable}
                      >
                        <MenuItem value="">Nenhuma</MenuItem>
                        {(Array.isArray(tagLists) ? tagLists : []).map(
                          (tagList) => (
                            <MenuItem key={tagList.id} value={tagList.id}>
                              {tagList.name}
                            </MenuItem>
                          )
                        )}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} md={4} item>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="whatsapp-selection-label">
                        {i18n.t("campaigns.dialog.form.whatsapp")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.whatsapp")}
                        placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
                        labelId="whatsapp-selection-label"
                        id="whatsappId"
                        name="whatsappId"
                        error={touched.whatsappId && Boolean(errors.whatsappId)}
                        disabled={!campaignEditable}
                      >
                        <MenuItem value="">Nenhuma</MenuItem>
                        {(Array.isArray(whatsapps) ? whatsapps : []).map(
                          (whatsapp) => (
                            <MenuItem key={whatsapp.id} value={whatsapp.id}>
                              {whatsapp.name}
                            </MenuItem>
                          )
                        )}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} md={4} item>
                    <Field
                      as={TextField}
                      label={i18n.t("campaigns.dialog.form.scheduledAt")}
                      name="scheduledAt"
                      error={touched.scheduledAt && Boolean(errors.scheduledAt)}
                      helperText={touched.scheduledAt && errors.scheduledAt}
                      variant="outlined"
                      margin="dense"
                      type="datetime-local"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      fullWidth
                      className={classes.textField}
                      disabled={!campaignEditable}
                    />
                  </Grid>
                  <Grid xs={12} md={4} item>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      className={classes.FormControl}
                      fullWidth
                    >
                      <InputLabel id="fileListId-selection-label">
                        {i18n.t("campaigns.dialog.form.fileList")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.fileList")}
                        name="fileListId"
                        id="fileListId"
                        placeholder={i18n.t("campaigns.dialog.form.fileList")}
                        labelId="fileListId-selection-label"
                        value={values.fileListId || ""}
                      >
                        <MenuItem value={""}>{"Nenhum"}</MenuItem>
                        {(Array.isArray(file) ? file : []).map((f) => (
                          <MenuItem key={f.id} value={f.id}>
                            {f.name}
                          </MenuItem>
                        ))}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} item>
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        {i18n.t("campaigns.dialog.contactStats.title")}
                      </Typography>
                      {contactStats.loading ? (
                        <Typography variant="body2">
                          {i18n.t("campaigns.dialog.contactStats.loading")}
                        </Typography>
                      ) : (
                        <Typography variant="body2">
                          {i18n.t("campaigns.dialog.contactStats.line", {
                            total: contactStats.total,
                            valid: contactStats.valid,
                            invalid: contactStats.invalid,
                          })}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                  {campaignId && opsSummary && (
                    <Grid xs={12} item>
                      <Box>
                        <Typography variant="subtitle2" color="textSecondary">
                          {i18n.t("campaigns.dialog.opsSummary.title")}
                        </Typography>
                        <Typography variant="body2">
                          {i18n.t("campaigns.dialog.opsSummary.line", {
                            total: opsSummary.total,
                            sent: opsSummary.sent,
                            pending: opsSummary.pending,
                            failed: opsSummary.failed ?? 0,
                          })}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  <Grid xs={12} item>
                    <Tabs
                      value={messageTab}
                      indicatorColor="primary"
                      textColor="primary"
                      className={classes.tabmsg}
                      onChange={(e, v) => setMessageTab(v)}
                      variant="fullWidth"
                      centered
                      style={{
                        borderRadius: 2,
                      }}
                    >
                      <Tab label="Msg. 1" index={0} />
                      <Tab label="Msg. 2" index={1} />
                      <Tab label="Msg. 3" index={2} />
                      <Tab label="Msg. 4" index={3} />
                      <Tab label="Msg. 5" index={4} />
                    </Tabs>
                    <Box style={{ paddingTop: 20, border: "none" }}>
                      {messageTab === 0 && (
                        <>{renderMessageField("message1")}</>
                      )}
                      {messageTab === 1 && (
                        <>{renderMessageField("message2")}</>
                      )}
                      {messageTab === 2 && (
                        <>{renderMessageField("message3")}</>
                      )}
                      {messageTab === 3 && (
                        <>{renderMessageField("message4")}</>
                      )}
                      {messageTab === 4 && (
                        <>{renderMessageField("message5")}</>
                      )}
                    </Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {i18n.t("campaigns.dialog.preview.title")}
                    </Typography>
                    <Typography variant="caption" display="block" gutterBottom>
                      {i18n.t("campaigns.dialog.preview.mockLine")}
                    </Typography>
                    <Box className={classes.previewBox} component="div">
                      <Typography variant="body2">
                        {buildPreviewMessage(values[previewField]) ||
                          i18n.t("campaigns.dialog.preview.empty")}
                      </Typography>
                    </Box>
                  </Grid>
                  {(campaign.mediaPath || attachment) && (
                    <Grid xs={12} item>
                      <Button startIcon={<AttachFileIcon />}>
                        {attachment != null
                          ? attachment.name
                          : campaign.mediaName}
                      </Button>
                      {campaignEditable && (
                        <IconButton
                          onClick={() => setConfirmationOpen(true)}
                          color="secondary"
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      )}
                    </Grid>
                  )}
                </Grid>
              </AppDialogContent>
              <AppDialogActions>
                {campaign.status === "CANCELADA" && (
                  <AppSecondaryButton
                    onClick={() => setRestartConfirmOpen(true)}
                  >
                    {i18n.t("campaigns.dialog.buttons.restart")}
                  </AppSecondaryButton>
                )}
                {campaign.status === "EM_ANDAMENTO" && (
                  <AppSecondaryButton onClick={() => cancelCampaign()}>
                    {i18n.t("campaigns.dialog.buttons.cancel")}
                  </AppSecondaryButton>
                )}
                {!attachment && !campaign.mediaPath && campaignEditable && (
                  <AppSecondaryButton
                    onClick={() => attachmentFile.current.click()}
                    disabled={isSubmitting}
                  >
                    {i18n.t("campaigns.dialog.buttons.attach")}
                  </AppSecondaryButton>
                )}
                <AppNeutralButton onClick={handleClose} disabled={isSubmitting}>
                  {i18n.t("campaigns.dialog.buttons.close")}
                </AppNeutralButton>
                {(campaignEditable || campaign.status === "CANCELADA") && (
                  <AppPrimaryButton
                    type="submit"
                    disabled={isSubmitting}
                    className={classes.btnWrapper}
                  >
                    {campaignId
                      ? `${i18n.t("campaigns.dialog.buttons.edit")}`
                      : `${i18n.t("campaigns.dialog.buttons.add")}`}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </AppPrimaryButton>
                )}
              </AppDialogActions>
            </Form>
          )}
        </Formik>
      </AppDialog>
    </div>
  );
};

export default CampaignModal;
