import React, { useState, useEffect, useRef, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
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
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
    width: "100%",
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
  fieldStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    width: "100%",
  },
}));

const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, i18n.t("contactListItems.dialog.nameShort"))
    .max(50, i18n.t("contactListItems.dialog.nameLong"))
    .required(i18n.t("contactListItems.dialog.nameRequired")),
  number: Yup.string().min(8, i18n.t("contactListItems.dialog.numberShort")).max(50, i18n.t("contactListItems.dialog.numberLong")),
  email: Yup.string().email(i18n.t("contactListItems.dialog.emailInvalid")),
});

const ContactListItemModal = ({
  open,
  onClose,
  contactId,
  initialValues,
  onSave,
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const {
    user: { companyId },
  } = useContext(AuthContext);
  const { contactListId } = useParams();

  const initialState = {
    name: "",
    number: "",
    email: "",
  };

  const [contact, setContact] = useState(initialState);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchContact = async () => {
      if (initialValues) {
        setContact((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      if (!contactId) return;

      try {
        const { data } = await api.get(`/contact-list-items/${contactId}`);
        if (isMounted.current) {
          setContact(data);
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchContact();
  }, [contactId, open, initialValues]);

  const handleClose = () => {
    onClose();
    setContact(initialState);
  };

  const handleSaveContact = async (values) => {
    try {
      if (contactId) {
        await api.put(`/contact-list-items/${contactId}`, {
          ...values,
          companyId,
          contactListId,
        });
        handleClose();
      } else {
        const { data } = await api.post("/contact-list-items", {
          ...values,
          companyId,
          contactListId,
        });
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("contactModal.success"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <AppDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
        <AppDialogTitle id="form-dialog-title">
          {contactId
            ? `${i18n.t("contactModal.title.edit")}`
            : `${i18n.t("contactModal.title.add")}`}
        </AppDialogTitle>
        <Formik
          initialValues={contact}
          enableReinitialize={true}
          validationSchema={ContactSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveContact(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting }) => (
            <Form>
              <AppDialogContent dividers>
                <Typography variant="subtitle1" gutterBottom>
                  {i18n.t("contactModal.form.mainInfo")}
                </Typography>
                <div className={classes.fieldStack}>
                  <Field
                    as={TextField}
                    label={i18n.t("contactModal.form.name")}
                    name="name"
                    autoFocus
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("contactModal.form.number")}
                    name="number"
                    error={touched.number && Boolean(errors.number)}
                    helperText={touched.number && errors.number}
                    placeholder="5513912344321"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("contactModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    placeholder={i18n.t("contactModal.form.email")}
                    fullWidth
                    margin="dense"
                    variant="outlined"
                  />
                </div>
              </AppDialogContent>
              <AppDialogActions>
                <AppSecondaryButton
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  {i18n.t("contactModal.buttons.cancel")}
                </AppSecondaryButton>
                <AppPrimaryButton
                  type="submit"
                  disabled={isSubmitting}
                  className={classes.btnWrapper}
                >
                  {contactId
                    ? `${i18n.t("contactModal.buttons.okEdit")}`
                    : `${i18n.t("contactModal.buttons.okAdd")}`}
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

export default ContactListItemModal;
