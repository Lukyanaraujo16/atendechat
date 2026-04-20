import React, { useState, useEffect, useRef, useMemo } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";
import Alert from "@material-ui/lab/Alert";
import { getMenuNodeWarningIds } from "../../pages/FlowBuilderConfig/flowMenuWarnings";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  }
}));

const selectFieldStyles = {
  ".MuiOutlinedInput-notchedOutline": {
    borderColor: "#909090"
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000000",
    borderWidth: "thin"
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#0000FF",
    borderWidth: "thin"
  }
};


const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Muito curto!")
    .max(50, "Muito longo!")
    .required("Digite um nome!"),
  text: Yup.string()
    .min(2, "Muito curto!")
    .max(50, "Muito longo!")
    .required("Digite uma mensagem!")
});

const FlowBuilderMenuModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close,
  edges = []
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [rule, setRule] = useState();

  const [textDig, setTextDig] = useState();

  const [arrayOption, setArrayOption] = useState([]);
  const [invalidOptionMessage, setInvalidOptionMessage] = useState("");
  const [timeoutMessage, setTimeoutMessage] = useState("");
  const [menuTimeoutSeconds, setMenuTimeoutSeconds] = useState(0);

  const menuWarningIds = useMemo(() => {
    if (!activeModal || open !== "edit" || !data?.id) return [];
    const syntheticData = {
      ...(data.data || {}),
      arrayOption,
      menuTimeoutSeconds,
      invalidOptionMessage,
      timeoutMessage
    };
    return getMenuNodeWarningIds(data.id, edges, syntheticData);
  }, [
    activeModal,
    open,
    data,
    edges,
    arrayOption,
    menuTimeoutSeconds,
    invalidOptionMessage,
    timeoutMessage
  ]);

  const [labels, setLabels] = useState({
    title: "Adicionar menu ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar menu",
        btn: "Salvar"
      });
      setTextDig(data.data.message);
      setArrayOption(data.data.arrayOption);
      setInvalidOptionMessage(data.data.invalidOptionMessage || "");
      setTimeoutMessage(data.data.timeoutMessage || "");
      setMenuTimeoutSeconds(
        Math.max(0, parseInt(String(data.data.menuTimeoutSeconds || 0), 10) || 0)
      );
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar menu ao fluxo",
        btn: "Adicionar"
      });
      setTextDig();
      setArrayOption([]);
      setInvalidOptionMessage("");
      setTimeoutMessage("");
      setMenuTimeoutSeconds(0);
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveContact = async () => {
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: {
          message: textDig,
          arrayOption: arrayOption,
          invalidOptionMessage: invalidOptionMessage || "",
          timeoutMessage: timeoutMessage || "",
          menuTimeoutSeconds: Math.max(
            0,
            parseInt(String(menuTimeoutSeconds), 10) || 0
          )
        }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave({
        message: textDig,
        arrayOption: arrayOption,
        invalidOptionMessage: invalidOptionMessage || "",
        timeoutMessage: timeoutMessage || "",
        menuTimeoutSeconds: Math.max(
          0,
          parseInt(String(menuTimeoutSeconds), 10) || 0
        )
      });
    }
  };

  const removeOption = number => {
    setArrayOption(old => old.filter(item => item.number !== number));
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          {open === "create" && activeModal ? (
            <Alert severity="info" style={{ margin: "0 16px 8px" }}>
              {i18n.t("flowBuilderMenu.createHint")}
            </Alert>
          ) : null}
          {open === "edit" && activeModal && menuWarningIds.length > 0 ? (
            <Alert severity="warning" style={{ margin: "0 16px 8px" }}>
              <Typography variant="subtitle2" gutterBottom>
                {i18n.t("flowBuilderMenu.warningsHeader")}
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {menuWarningIds.map(wid => (
                  <li key={wid}>
                    <Typography variant="body2" component="span">
                      {i18n.t(`flowBuilderMenu.warnings.${wid}.detail`)}
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <Stack dividers style={{ gap: "8px", padding: "16px" }}>
            <TextField
              label={"Mensagem de explicação do menu"}
              rows={4}
              name="text"
              multiline
              variant="outlined"
              value={textDig}
              onChange={e => setTextDig(e.target.value)}
              className={classes.textField}
              style={{ width: "100%" }}
            />
            <Stack direction={"row"} justifyContent={"space-between"}>
              <Typography>Adicionar Opção</Typography>
              <Button
                onClick={() =>
                  setArrayOption(old => [
                    ...old,
                    { number: old.length + 1, value: "" }
                  ])
                }
                color="primary"
                variant="contained"
              >
                <AddCircle />
              </Button>
            </Stack>
            {arrayOption.map((item, index) => (
              <Stack width={"100%"} key={item.number}>
                <Typography>Digite {item.number}</Typography>
                <Stack direction={"row"} width={"100%"} style={{ gap: "8px" }}>
                  <TextField
                    placeholder={"Digite opção"}
                    variant="outlined"
                    defaultValue={item.value}
                    style={{ width: "100%" }}
                    onChange={event =>
                      setArrayOption(old => {
                        let newArr = old;
                        newArr[index].value = event.target.value;
                        return newArr;
                      })
                    }
                  />
                  {arrayOption.length === item.number && (
                    <IconButton onClick={() => removeOption(item.number)}>
                      <Delete />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            ))}
            <Typography variant="subtitle2" color="textSecondary">
              Ramo &quot;Opção inválida&quot; (vermelho no nó): mensagem opcional
              enviada ao cliente antes de seguir esse ramo.
            </Typography>
            <TextField
              label="Mensagem — opção inválida"
              rows={2}
              name="invalidOptionMessage"
              multiline
              variant="outlined"
              value={invalidOptionMessage}
              onChange={e => setInvalidOptionMessage(e.target.value)}
              className={classes.textField}
              style={{ width: "100%" }}
              placeholder="Ex.: Não entendi. Escolha uma das opções acima."
            />
            <Typography variant="subtitle2" color="textSecondary" style={{ marginTop: 8 }}>
              Ramo &quot;Sem resposta&quot; (laranja): tempo em segundos sem
              mensagem do cliente. 0 = desligado. Conecte a saída laranja no
              fluxo.
            </Typography>
            <TextField
              label="Tempo máximo de espera (segundos)"
              type="number"
              inputProps={{ min: 0, max: 86400 }}
              variant="outlined"
              value={menuTimeoutSeconds}
              onChange={e =>
                setMenuTimeoutSeconds(
                  Math.max(0, parseInt(e.target.value, 10) || 0)
                )
              }
              className={classes.textField}
              style={{ width: "100%" }}
            />
            <TextField
              label="Mensagem — sem resposta (opcional)"
              rows={2}
              name="timeoutMessage"
              multiline
              variant="outlined"
              value={timeoutMessage}
              onChange={e => setTimeoutMessage(e.target.value)}
              className={classes.textField}
              style={{ width: "100%" }}
            />
          </Stack>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.btnWrapper}
              onClick={() => handleSaveContact()}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderMenuModal;
