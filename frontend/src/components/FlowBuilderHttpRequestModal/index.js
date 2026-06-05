import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import TextField from "@material-ui/core/TextField";
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

const defaultData = () => ({
  method: "GET",
  url: "",
  headers: [],
  queryParams: [],
  bodyType: "json",
  body: "",
  timeoutMs: 10000,
  saveResponseMode: "none",
  saveResponseKey: "",
  extractRules: [],
});

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const FlowBuilderHttpRequestModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [form, setForm] = useState(defaultData());

  useEffect(() => {
    if (open === "edit" && data?.data) {
      setForm({
        ...defaultData(),
        ...data.data,
        headers: Array.isArray(data.data.headers) ? data.data.headers : [],
        queryParams: Array.isArray(data.data.queryParams) ? data.data.queryParams : [],
        extractRules: Array.isArray(data.data.extractRules) ? data.data.extractRules : [],
      });
      setActiveModal(true);
    } else if (open === "create") {
      setForm(defaultData());
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open, data]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(
    String(form.method || "GET").toUpperCase()
  );

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const isValidFlowBuilderUrl = (raw) => {
    const url = String(raw || "").trim();
    if (!url) return false;
    if (url.includes("{{")) {
      if (!/\bhttps?:\/\//i.test(url)) {
        return false;
      }
      return true;
    }
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  const validate = () => {
    const url = (form.url || "").trim();
    if (!url) {
      toast.error("Informe a URL.");
      return false;
    }
    if (!isValidFlowBuilderUrl(url)) {
      toast.error(
        "URL inválida. Use http:// ou https:// (em URLs com {{variável}}, inclua o protocolo no texto, ex.: https://api.exemplo.com/{{path}})."
      );
      return false;
    }
    if (hasBody && (form.bodyType || "json") === "json" && String(form.body || "").trim()) {
      const bodyStr = String(form.body).trim();
      if (!bodyStr.includes("{{")) {
        try {
          JSON.parse(bodyStr);
        } catch {
          toast.error("Body JSON inválido.");
          return false;
        }
      }
    }
    if (form.saveResponseMode === "full" && !(form.saveResponseKey || "").trim()) {
      toast.error("Informe a chave para salvar a resposta completa.");
      return false;
    }
    if (form.saveResponseMode === "extract") {
      const rules = Array.isArray(form.extractRules) ? form.extractRules : [];
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (!r?.key?.trim() || !r?.path?.trim()) {
          toast.error(`Regra ${i + 1}: preencha chave e path.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload = {
      ...form,
      method: String(form.method || "GET").toUpperCase(),
      timeoutMs: Math.min(60000, Math.max(1000, Number(form.timeoutMs) || 10000)),
      headers: (form.headers || []).filter((h) => h && (h.key || "").trim()),
      queryParams: (form.queryParams || []).filter((q) => q && (q.key || "").trim()),
      extractRules: (form.extractRules || []).filter((r) => r && (r.key || "").trim() && (r.path || "").trim()),
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

  const addHeader = () => {
    setForm((f) => ({
      ...f,
      headers: [...(f.headers || []), { key: "", value: "" }],
    }));
  };

  const setHeader = (i, field, value) => {
    setForm((f) => {
      const headers = [...(f.headers || [])];
      headers[i] = { ...headers[i], [field]: value };
      return { ...f, headers };
    });
  };

  const removeHeader = (i) => {
    setForm((f) => ({
      ...f,
      headers: (f.headers || []).filter((_, j) => j !== i),
    }));
  };

  const addQuery = () => {
    setForm((f) => ({
      ...f,
      queryParams: [...(f.queryParams || []), { key: "", value: "" }],
    }));
  };

  const setQuery = (i, field, value) => {
    setForm((f) => {
      const queryParams = [...(f.queryParams || [])];
      queryParams[i] = { ...queryParams[i], [field]: value };
      return { ...f, queryParams };
    });
  };

  const removeQuery = (i) => {
    setForm((f) => ({
      ...f,
      queryParams: (f.queryParams || []).filter((_, j) => j !== i),
    }));
  };

  const addRule = () => {
    setForm((f) => ({
      ...f,
      extractRules: [...(f.extractRules || []), { key: "", path: "" }],
    }));
  };

  const setRule = (i, field, value) => {
    setForm((f) => {
      const extractRules = [...(f.extractRules || [])];
      extractRules[i] = { ...extractRules[i], [field]: value };
      return { ...f, extractRules };
    });
  };

  const removeRule = (i) => {
    setForm((f) => ({
      ...f,
      extractRules: (f.extractRules || []).filter((_, j) => j !== i),
    }));
  };

  return (
    <AppDialog open={activeModal} onClose={handleClose} fullWidth maxWidth="md">
      <AppDialogTitle>HTTP Request</AppDialogTitle>
      <AppDialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Método</InputLabel>
              <Select
                label="Método"
                value={form.method || "GET"}
                onChange={(e) => setField("method", e.target.value)}
              >
                {METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Timeout (ms)"
              type="number"
              size="small"
              variant="outlined"
              fullWidth
              value={form.timeoutMs}
              onChange={(e) => setField("timeoutMs", e.target.value)}
              inputProps={{ min: 1000, max: 60000 }}
            />
          </Stack>
          <TextField
            label="URL"
            required
            size="small"
            variant="outlined"
            fullWidth
            multiline
            minRows={2}
            placeholder="https://api.exemplo.com/endpoint"
            value={form.url}
            onChange={(e) => setField("url", e.target.value)}
            helperText="Use {{variável}} para interpolar dados do fluxo."
          />

          <Typography variant="subtitle2" color="text.secondary">
            Query params
          </Typography>
          {(form.queryParams || []).map((row, i) => (
            <Stack key={`q-${i}`} direction="row" spacing={1} alignItems="center">
              <TextField
                label="Chave"
                size="small"
                value={row.key}
                onChange={(e) => setQuery(i, "key", e.target.value)}
                fullWidth
              />
              <TextField
                label="Valor"
                size="small"
                value={row.value}
                onChange={(e) => setQuery(i, "value", e.target.value)}
                fullWidth
              />
              <IconButton size="small" onClick={() => removeQuery(i)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddCircleOutlineIcon />} size="small" onClick={addQuery}>
            Adicionar query param
          </Button>

          <Divider />

          <Typography variant="subtitle2" color="text.secondary">
            Headers
          </Typography>
          {(form.headers || []).map((row, i) => (
            <Stack key={`h-${i}`} direction="row" spacing={1} alignItems="center">
              <TextField
                label="Chave"
                size="small"
                value={row.key}
                onChange={(e) => setHeader(i, "key", e.target.value)}
                fullWidth
              />
              <TextField
                label="Valor"
                size="small"
                value={row.value}
                onChange={(e) => setHeader(i, "value", e.target.value)}
                fullWidth
              />
              <IconButton size="small" onClick={() => removeHeader(i)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button startIcon={<AddCircleOutlineIcon />} size="small" onClick={addHeader}>
            Adicionar header
          </Button>

          {hasBody && (
            <>
              <Divider />
              <FormControl variant="outlined" size="small" sx={{ maxWidth: 200 }}>
                <InputLabel>Body</InputLabel>
                <Select
                  label="Body"
                  value={form.bodyType || "json"}
                  onChange={(e) => setField("bodyType", e.target.value)}
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="raw">Texto bruto</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={form.bodyType === "json" ? "Body (JSON)" : "Body"}
                size="small"
                variant="outlined"
                fullWidth
                multiline
                minRows={4}
                value={form.body}
                onChange={(e) => setField("body", e.target.value)}
                placeholder='Ex.: {"cliente":"{{nome}}"}'
                helperText={
                  form.bodyType === "json"
                    ? "JSON válido após interpolação {{chave}}."
                    : "Texto livre com {{chave}}."
                }
              />
            </>
          )}

          <Divider />

          <FormControl variant="outlined" size="small" fullWidth>
            <InputLabel>Salvar resposta</InputLabel>
            <Select
              label="Salvar resposta"
              value={form.saveResponseMode || "none"}
              onChange={(e) => setField("saveResponseMode", e.target.value)}
            >
              <MenuItem value="none">Não salvar</MenuItem>
              <MenuItem value="full">Resposta completa</MenuItem>
              <MenuItem value="extract">Extrair campos (path)</MenuItem>
            </Select>
          </FormControl>

          {form.saveResponseMode === "full" && (
            <TextField
              label="Chave em variables"
              required
              size="small"
              variant="outlined"
              fullWidth
              value={form.saveResponseKey}
              onChange={(e) => setField("saveResponseKey", e.target.value)}
              helperText="Ex.: apiCliente — fica em {{apiCliente}} nas mensagens."
            />
          )}

          {form.saveResponseMode === "extract" && (
            <>
              <Typography variant="caption" color="text.secondary">
                Path com pontos (ex.: customer.name)
              </Typography>
              {(form.extractRules || []).map((row, i) => (
                <Stack key={`r-${i}`} direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Chave (variable)"
                    size="small"
                    value={row.key}
                    onChange={(e) => setRule(i, "key", e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Path"
                    size="small"
                    value={row.path}
                    onChange={(e) => setRule(i, "path", e.target.value)}
                    fullWidth
                  />
                  <IconButton size="small" onClick={() => removeRule(i)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddCircleOutlineIcon />} size="small" onClick={addRule}>
                Adicionar regra
              </Button>
            </>
          )}
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined">
          {i18n.t("contactModal.buttons.cancel")}
        </Button>
        <Button
          color="primary"
          variant="contained"
          className={classes.btnWrapper}
          onClick={handleSave}
        >
          {open === "create" ? "Adicionar" : "Salvar"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
};

export default FlowBuilderHttpRequestModal;
