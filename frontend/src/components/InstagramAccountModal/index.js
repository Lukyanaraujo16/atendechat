import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
} from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
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
  textField: {
    width: "100%",
  },
  formSection: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
}));

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("instagramAccountModal.formErrors.name.short"))
    .max(50, i18n.t("instagramAccountModal.formErrors.name.long"))
    .required(i18n.t("instagramAccountModal.formErrors.name.required")),
});

const InstagramAccountModal = ({ open, onClose, instagramAccountId, onSaved }) => {
  const classes = useStyles();
  const isMobile = useIsMobile();

  const initialState = {
    name: "",
    isDefault: false,
  };

  const [account, setAccount] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);

  useEffect(() => {
    const fetchAccount = async () => {
      if (!instagramAccountId) {
        setAccount(initialState);
        setSelectedQueueIds([]);
        return;
      }

      try {
        const { data } = await api.get(`/instagram-accounts/${instagramAccountId}`);
        setAccount(data);
        const queueIds = data.queues?.map((queue) => queue.id) || [];
        setSelectedQueueIds(queueIds);
      } catch (err) {
        toastError(err);
      }
    };

    if (open) {
      fetchAccount();
    }
  }, [instagramAccountId, open]);

  const handleClose = () => {
    setAccount(initialState);
    setSelectedQueueIds([]);
    onClose();
  };

  const handleSave = async (values) => {
    const payload = {
      name: values.name,
      isDefault: values.isDefault,
      queueIds: selectedQueueIds,
    };

    try {
      if (instagramAccountId) {
        await api.put(`/instagram-accounts/${instagramAccountId}`, payload);
        toast.success(i18n.t("instagramAccountModal.success"));
      } else {
        await api.post("/instagram-accounts", payload);
        toast.success(i18n.t("instagramAccountModal.successCreate"));
      }
      if (onSaved) onSaved();
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <AppDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <AppDialogTitle>
        {instagramAccountId
          ? i18n.t("instagramAccountModal.title.edit")
          : i18n.t("instagramAccountModal.title.add")}
      </AppDialogTitle>
      <Formik
        initialValues={account}
        enableReinitialize
        validationSchema={SessionSchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 400);
        }}
      >
        {({ values, touched, errors, isSubmitting, setFieldValue }) => (
          <Form>
            <AppDialogContent dividers className={classes.formSection}>
              <div className={classes.multFieldLine}>
                <Grid spacing={2} container>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      label={i18n.t("instagramAccountModal.form.name")}
                      autoFocus
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      variant="outlined"
                      margin="dense"
                      className={classes.textField}
                    />
                  </Grid>
                  <Grid style={{ paddingTop: isMobile ? 0 : 15 }} item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.isDefault}
                          onChange={(e) => setFieldValue("isDefault", e.target.checked)}
                          color="primary"
                        />
                      }
                      label={i18n.t("instagramAccountModal.form.default")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <QueueSelect
                      selectedQueueIds={selectedQueueIds}
                      onChange={(ids) => setSelectedQueueIds(ids)}
                    />
                  </Grid>
                </Grid>
              </div>
            </AppDialogContent>
            <AppDialogActions>
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting} variant="outlined">
                {i18n.t("instagramAccountModal.buttons.cancel")}
              </Button>
              <div className={classes.btnWrapper}>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                >
                  {instagramAccountId
                    ? i18n.t("instagramAccountModal.buttons.okEdit")
                    : i18n.t("instagramAccountModal.buttons.okAdd")}
                </Button>
                {isSubmitting && (
                  <CircularProgress size={24} className={classes.buttonProgress} />
                )}
              </div>
            </AppDialogActions>
          </Form>
        )}
      </Formik>
    </AppDialog>
  );
};

export default InstagramAccountModal;
