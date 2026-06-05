import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";

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
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
}));

const ContactListSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("contactLists.dialog.nameShort"))
    .max(50, i18n.t("contactLists.dialog.nameLong"))
    .required(i18n.t("contactLists.dialog.nameRequired")),
});

const ContactListModal = ({ open, onClose, contactListId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
  };

  const [contactList, setContactList] = useState(initialState);

  useEffect(() => {
    const fetchContactList = async () => {
      if (!contactListId) return;
      try {
        const { data } = await api.get(`/contact-lists/${contactListId}`);
        setContactList((prevState) => {
          return { ...prevState, ...data };
        });
      } catch (err) {
        toastError(err);
      }
    };

    fetchContactList();
  }, [contactListId, open]);

  const handleClose = () => {
    onClose();
    setContactList(initialState);
  };

  const handleSaveContactList = async (values) => {
    const contactListData = { ...values };
    try {
      if (contactListId) {
        await api.put(`/contact-lists/${contactListId}`, contactListData);
      } else {
        await api.post("/contact-lists", contactListData);
      }
      toast.success(i18n.t("contactList.toasts.success"));
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  return (
    <div className={classes.root}>
      <AppDialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
      >
        <AppDialogTitle id="form-dialog-title">
          {contactListId
            ? `${i18n.t("contactLists.dialog.edit")}`
            : `${i18n.t("contactLists.dialog.add")}`}
        </AppDialogTitle>
        <Formik
          initialValues={contactList}
          enableReinitialize={true}
          validationSchema={ContactListSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveContactList(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting }) => (
            <Form>
              <AppDialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("contactLists.dialog.name")}
                    autoFocus
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>
              </AppDialogContent>
              <AppDialogActions>
                <AppSecondaryButton
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  {i18n.t("contactLists.dialog.cancel")}
                </AppSecondaryButton>
                <AppPrimaryButton
                  type="submit"
                  disabled={isSubmitting}
                  className={classes.btnWrapper}
                >
                  {contactListId
                    ? `${i18n.t("contactLists.dialog.okEdit")}`
                    : `${i18n.t("contactLists.dialog.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </AppPrimaryButton>
              </AppDialogActions>
            </Form>
          )}
        </Formik>
      </AppDialog>
    </div>
  );
};

export default ContactListModal;
