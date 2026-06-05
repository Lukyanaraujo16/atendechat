import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import Button from "@material-ui/core/Button";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import TextField from "@material-ui/core/TextField";
import CircularProgress from "@material-ui/core/CircularProgress";

import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  Box,
  Alert,
} from "@mui/material";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  TEMPLATE_META,
  buildFlowFromTemplate,
} from "../../flowBuilderTemplates/flowTemplates";

const FlowBuilderTemplateModal = ({ open, onClose }) => {
  const history = useHistory();
  const [templateId, setTemplateId] = useState(TEMPLATE_META[0]?.id || "");
  const [flowName, setFlowName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = TEMPLATE_META[0];
    if (first) {
      setTemplateId(first.id);
      setFlowName(first.suggestedFlowName);
    }
  }, [open]);

  const handleTemplateChange = (e) => {
    const id = e.target.value;
    setTemplateId(id);
    const meta = TEMPLATE_META.find((t) => t.id === id);
    if (meta) setFlowName(meta.suggestedFlowName);
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const selectedMeta = TEMPLATE_META.find((t) => t.id === templateId);

  const handleSubmit = async () => {
    const name = (flowName || "").trim();
    if (name.length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/flowbuilder", { name });
      const flowId = data?.id;
      if (!flowId) {
        toast.error("Não foi possível obter o ID do fluxo criado.");
        return;
      }
      const { nodes, connections } = buildFlowFromTemplate(templateId);
      await api.post("/flowbuilder/flow", {
        idFlow: flowId,
        nodes,
        connections,
      });
      toast.success("Fluxo criado a partir do template. Ajuste filas, listas e atendentes no editor.");
      onClose();
      history.push(`/flowbuilder/${flowId}`);
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error("Já existe um fluxo com esse nome. Escolha outro.");
      } else {
        toastError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="md" scroll="paper">
      <AppDialogTitle>Criar a partir de template</AppDialogTitle>
      <AppDialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Escolha um modelo pronto. O fluxo será criado já com blocos conectados; configure filas,
            listas, atendentes e telefones de notificação antes de publicar.
          </Typography>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup value={templateId} onChange={handleTemplateChange}>
              {TEMPLATE_META.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    border: "1px solid #e0e0e0",
                    borderRadius: 1,
                    p: 1.5,
                    mb: 1,
                    bgcolor: templateId === t.id ? "action.hover" : "transparent",
                  }}
                >
                  <FormControlLabel
                    value={t.id}
                    control={<Radio color="primary" />}
                    label={
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{t.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.shortDescription}
                        </Typography>
                      </Stack>
                    }
                  />
                </Box>
              ))}
            </RadioGroup>
          </FormControl>
          {Array.isArray(selectedMeta?.setupHints) && selectedMeta.setupHints.length > 0 && (
            <Alert severity="info" variant="outlined" sx={{ alignItems: "flex-start" }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                O que configurar neste template
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, mb: 0 }}>
                {selectedMeta.setupHints.map((line, i) => (
                  <li key={i}>
                    <Typography variant="body2" color="text.secondary">
                      {line}
                    </Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          )}
          <TextField
            label="Nome do fluxo"
            fullWidth
            variant="outlined"
            size="small"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            helperText="Este nome aparece na lista de fluxos."
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined" disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={submitting}
        >
          {submitting ? <CircularProgress size={22} color="inherit" /> : "Criar fluxo"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
};

export default FlowBuilderTemplateModal;
