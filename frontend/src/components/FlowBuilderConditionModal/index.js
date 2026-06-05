import React, { useState, useEffect, useRef } from "react";
import { Formik, Form, FieldArray } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

import { i18n } from "../../translate/i18n";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  Divider,
} from "@mui/material";

const useStyles = makeStyles((theme) => ({
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
}));

const OPERATORS_NO_VALUE = [
  "exists",
  "notExists",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
];

const OPERATORS_ALL = [
  { v: "equals", l: "Igual a" },
  { v: "notEquals", l: "Diferente de" },
  { v: "contains", l: "Contém" },
  { v: "notContains", l: "Não contém" },
  { v: "startsWith", l: "Começa com" },
  { v: "endsWith", l: "Termina com" },
  { v: "exists", l: "Existe (tem valor)" },
  { v: "notExists", l: "Não existe" },
  { v: "isEmpty", l: "Está vazio" },
  { v: "isNotEmpty", l: "Não está vazio" },
  { v: "greaterThan", l: "Maior que (número)" },
  { v: "greaterThanOrEqual", l: "Maior ou igual" },
  { v: "lessThan", l: "Menor que" },
  { v: "lessThanOrEqual", l: "Menor ou igual" },
  { v: "in", l: "Está na lista (vírgula)" },
  { v: "notIn", l: "Não está na lista" },
  { v: "isTrue", l: "É verdadeiro" },
  { v: "isFalse", l: "É falso" },
  { v: "matchesRegex", l: "Regex" },
];

const FIELDS_BY_SOURCE = {
  variable: [{ v: "__custom__", l: "Nome da variável (chave)" }],
  ticket: [
    { v: "status", l: "status" },
    { v: "queueId", l: "queueId" },
    { v: "userId", l: "userId" },
    { v: "chatbot", l: "chatbot" },
    { v: "protocol", l: "protocol (id do ticket)" },
    { v: "contactId", l: "contactId" },
    { v: "whatsappId", l: "whatsappId" },
  ],
  contact: [
    { v: "name", l: "name" },
    { v: "number", l: "number" },
    { v: "email", l: "email" },
  ],
  context: [
    { v: "body", l: "body (última mensagem)" },
    { v: "isFirstInteraction", l: "isFirstInteraction" },
    { v: "hasQueue", l: "hasQueue" },
    { v: "hasUser", l: "hasUser" },
  ],
};

const defaultRule = () => ({
  source: "variable",
  field: "",
  operator: "exists",
  value: "",
});

const FlowBuilderConditionModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const [activeModal, setActiveModal] = useState(false);
  const [labels, setLabels] = useState({
    title: "Condição",
    btn: "Adicionar",
  });

  const [initial, setInitial] = useState({
    mode: "all",
    rules: [defaultRule()],
  });

  useEffect(() => {
    if (open === "edit" && data?.data) {
      setLabels({ title: "Editar condição", btn: "Salvar" });
      const d = data.data;
      let rules;
      if (Array.isArray(d.rules) && d.rules.length > 0) {
        rules = d.rules.map((r) => ({
          source: r.source || "variable",
          field: r.field || "",
          operator: r.operator || "equals",
          value: r.value != null ? String(r.value) : "",
        }));
      } else if (d.key != null && String(d.key).trim() !== "") {
        const mapOp = {
          1: "equals",
          2: "greaterThanOrEqual",
          3: "lessThanOrEqual",
          4: "lessThan",
          5: "greaterThan",
        };
        rules = [
          {
            source: "variable",
            field: String(d.key),
            operator: mapOp[d.condition] || "equals",
            value: d.value != null ? String(d.value) : "",
          },
        ];
      } else {
        rules = [defaultRule()];
      }
      setInitial({
        mode: d.mode === "any" ? "any" : "all",
        rules,
      });
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: "Nova condição", btn: "Adicionar" });
      setInitial({
        mode: "all",
        rules: [defaultRule()],
      });
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const validateRules = (values) => {
    if (!values.rules || values.rules.length < 1) {
      toast.error("Adicione pelo menos uma regra.");
      return false;
    }
    for (let i = 0; i < values.rules.length; i++) {
      const r = values.rules[i];
      if (!r.source || !r.operator) {
        toast.error(`Regra ${i + 1}: preencha origem e operador.`);
        return false;
      }
      const fieldTrim = String(r.field || "").trim();
      if (!fieldTrim) {
        toast.error(`Regra ${i + 1}: informe o campo.`);
        return false;
      }
      if (r.source !== "variable") {
        const allowed = (FIELDS_BY_SOURCE[r.source] || []).map((f) => f.v);
        if (!allowed.includes(fieldTrim)) {
          toast.error(
            `Regra ${i + 1}: selecione um campo válido para a origem escolhida.`
          );
          return false;
        }
      } else if (fieldTrim.length > 120) {
        toast.error(`Regra ${i + 1}: nome da variável muito longo (máx. 120 caracteres).`);
        return false;
      }
      const needVal = !OPERATORS_NO_VALUE.includes(r.operator);
      if (needVal && String(r.value || "").trim() === "") {
        toast.error(`Regra ${i + 1}: informe o valor esperado.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (values) => {
    if (!validateRules(values)) return;
    const payload = {
      mode: values.mode,
      rules: values.rules.map((r) => ({
        source: r.source,
        field: String(r.field).trim(),
        operator: r.operator,
        ...(OPERATORS_NO_VALUE.includes(r.operator)
          ? {}
          : { value: String(r.value ?? "").trim() }),
      })),
    };
    if (open === "edit") {
      onUpdate({
        ...data,
        data: payload,
      });
    } else {
      onSave(payload);
    }
    handleClose();
  };

  return (
    <div>
      <AppDialog
        open={activeModal}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <AppDialogTitle>{labels.title}</AppDialogTitle>
        <Formik
          enableReinitialize
          initialValues={initial}
          onSubmit={handleSubmit}
        >
          {({ values, setFieldValue }) => (
            <Form>
              <AppDialogContent dividers>
                <Stack spacing={2}>
                  <Typography variant="body2" color="textSecondary">
                    Combine regras com <strong>E</strong> (todas) ou{" "}
                    <strong>OU</strong> (qualquer). Conecte as saídas{" "}
                    <strong>Sim</strong> e <strong>Não</strong> no fluxo.
                  </Typography>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Modo</InputLabel>
                    <Select
                      label="Modo"
                      value={values.mode}
                      onChange={(e) => setFieldValue("mode", e.target.value)}
                    >
                      <MenuItem value="all">Todas as regras (AND)</MenuItem>
                      <MenuItem value="any">Qualquer regra (OR)</MenuItem>
                    </Select>
                  </FormControl>

                  <FieldArray name="rules">
                    {({ push, remove }) => (
                      <Stack spacing={2}>
                        {values.rules.map((rule, index) => (
                          <Stack
                            key={index}
                            spacing={1.5}
                            sx={{
                              border: "1px solid #e0e0e0",
                              borderRadius: 1,
                              p: 1.5,
                            }}
                          >
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="subtitle2">
                                Regra {index + 1}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => remove(index)}
                                disabled={values.rules.length <= 1}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <FormControl fullWidth size="small" variant="outlined">
                                <InputLabel>Origem</InputLabel>
                                <Select
                                  label="Origem"
                                  value={rule.source}
                                  onChange={(e) => {
                                    const src = e.target.value;
                                    setFieldValue(`rules[${index}].source`, src);
                                    const first =
                                      FIELDS_BY_SOURCE[src]?.[0]?.v || "";
                                    setFieldValue(
                                      `rules[${index}].field`,
                                      src === "variable" ? "" : first
                                    );
                                  }}
                                >
                                  <MenuItem value="variable">Variável (fluxo)</MenuItem>
                                  <MenuItem value="ticket">Ticket</MenuItem>
                                  <MenuItem value="contact">Contato</MenuItem>
                                  <MenuItem value="context">Contexto</MenuItem>
                                </Select>
                              </FormControl>
                              {rule.source === "variable" ? (
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Chave da variável"
                                  variant="outlined"
                                  value={rule.field}
                                  onChange={(e) =>
                                    setFieldValue(
                                      `rules[${index}].field`,
                                      e.target.value
                                    )
                                  }
                                  placeholder="ex: nome"
                                />
                              ) : (
                                <FormControl fullWidth size="small" variant="outlined">
                                  <InputLabel>Campo</InputLabel>
                                  <Select
                                    label="Campo"
                                    value={
                                      FIELDS_BY_SOURCE[rule.source]?.some(
                                        (f) => f.v === rule.field
                                      )
                                        ? rule.field
                                        : ""
                                    }
                                    onChange={(e) =>
                                      setFieldValue(
                                        `rules[${index}].field`,
                                        e.target.value
                                      )
                                    }
                                  >
                                    {(FIELDS_BY_SOURCE[rule.source] || []).map(
                                      (f) => (
                                        <MenuItem key={f.v} value={f.v}>
                                          {f.l}
                                        </MenuItem>
                                      )
                                    )}
                                  </Select>
                                </FormControl>
                              )}
                            </Stack>
                            <FormControl fullWidth size="small" variant="outlined">
                              <InputLabel>Operador</InputLabel>
                              <Select
                                label="Operador"
                                value={rule.operator}
                                onChange={(e) =>
                                  setFieldValue(
                                    `rules[${index}].operator`,
                                    e.target.value
                                  )
                                }
                              >
                                {OPERATORS_ALL.map((o) => (
                                  <MenuItem key={o.v} value={o.v}>
                                    {o.l}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            {!OPERATORS_NO_VALUE.includes(rule.operator) && (
                              <TextField
                                size="small"
                                fullWidth
                                label="Valor"
                                variant="outlined"
                                value={rule.value}
                                onChange={(e) =>
                                  setFieldValue(
                                    `rules[${index}].value`,
                                    e.target.value
                                  )
                                }
                              />
                            )}
                          </Stack>
                        ))}
                        <Button
                          startIcon={<AddCircleOutlineIcon />}
                          variant="outlined"
                          onClick={() => push(defaultRule())}
                        >
                          Adicionar regra
                        </Button>
                      </Stack>
                    )}
                  </FieldArray>
                </Stack>
              </AppDialogContent>
              <Divider />
              <AppDialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  variant="outlined"
                >
                  {i18n.t("contactModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {labels.btn}
                </Button>
              </AppDialogActions>
            </Form>
          )}
        </Formik>
      </AppDialog>
    </div>
  );
};

export default FlowBuilderConditionModal;
