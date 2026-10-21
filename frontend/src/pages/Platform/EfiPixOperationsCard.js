import React, { useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AppSectionCard, AppPrimaryButton, AppSecondaryButton } from "../../ui";

/**
 * Fase 8.3-B3.2 — consulta de txid (RF2.6) e webhook Pix (RF2.7), só Super Admin.
 * O cadastro do webhook só fica disponível com a cobrança Pix v2 ativa (C3); a URL e a
 * chave chegam mascaradas do backend.
 */
export default function EfiPixOperationsCard() {
  const [webhook, setWebhook] = useState(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [txid, setTxid] = useState("");
  const [charge, setCharge] = useState(null);
  const [loadingCharge, setLoadingCharge] = useState(false);

  const loadWebhook = async () => {
    setLoadingWebhook(true);
    try {
      const { data } = await api.get("/saas/finance/efi/webhook");
      setWebhook(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingWebhook(false);
    }
  };

  const registerWebhook = async () => {
    if (
      !window.confirm(
        "Cadastrar o webhook Pix na Efí com a URL atual do backend?\n\nIsso substitui a URL cadastrada para a chave Pix."
      )
    ) {
      return;
    }
    setRegistering(true);
    try {
      const { data } = await api.post("/saas/finance/efi/webhook/register", {
        confirm: true,
      });
      toast.success(
        data?.conferred
          ? "Webhook cadastrado e conferido na Efí."
          : "Webhook cadastrado; a conferência por GET não confirmou a URL."
      );
      await loadWebhook();
    } catch (e) {
      toastError(e);
    } finally {
      setRegistering(false);
    }
  };

  const lookupCharge = async () => {
    const value = txid.trim();
    if (!value) return;
    setLoadingCharge(true);
    setCharge(null);
    try {
      const { data } = await api.get(
        `/saas/finance/efi/charges/${encodeURIComponent(value)}`
      );
      setCharge(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingCharge(false);
    }
  };

  return (
    <AppSectionCard>
      <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
        Webhook e cobranças Pix
      </Typography>

      <Box mt={1} display="flex" style={{ gap: 8 }} flexWrap="wrap">
        <AppSecondaryButton onClick={loadWebhook} disabled={loadingWebhook}>
          {loadingWebhook ? "Consultando..." : "Consultar webhook"}
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={registerWebhook}
          disabled={registering || !webhook?.registerAvailable}
        >
          {registering ? "Cadastrando..." : "Cadastrar webhook"}
        </AppPrimaryButton>
      </Box>
      {webhook ? (
        <Box mt={1}>
          <Typography variant="body2">
            URL cadastrada: <strong>{webhook.webhookUrlMasked || "nenhuma"}</strong>
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Chave: {webhook.chaveMasked || "—"} · Fonte: {webhook.credentialsSource} ·
            Ambiente: {webhook.efiEnvironment}
          </Typography>
          {!webhook.registerAvailable ? (
            <Typography variant="caption" color="textSecondary" component="p">
              Cadastro pelo painel indisponível: exige a cobrança Pix v2 ativa (o checkout
              atual recadastra a URL a cada pagamento).
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <Box mt={2} display="flex" style={{ gap: 8 }} alignItems="center">
        <TextField
          size="small"
          variant="outlined"
          label="txid"
          value={txid}
          onChange={(e) => setTxid(e.target.value)}
          inputProps={{ maxLength: 35 }}
        />
        <AppSecondaryButton onClick={lookupCharge} disabled={loadingCharge || !txid.trim()}>
          {loadingCharge ? "Consultando..." : "Consultar cobrança"}
        </AppSecondaryButton>
      </Box>
      {charge ? (
        <Box mt={1}>
          <Typography variant="body2">
            Status Efí: <strong>{charge.status || "—"}</strong> · Valor: {charge.valor || "—"}
            {" "}· Criação: {charge.criacao ? new Date(charge.criacao).toLocaleString() : "—"}
          </Typography>
          {(charge.pagamentos || []).map((p) => (
            <Typography key={p.endToEndId || p.horario} variant="body2" color="textSecondary">
              Pago {p.valor} em {p.horario ? new Date(p.horario).toLocaleString() : "—"} (e2e{" "}
              {p.endToEndId || "—"})
            </Typography>
          ))}
          <Typography variant="caption" color="textSecondary" component="p">
            {charge.local
              ? `Fatura #${charge.local.invoiceId} · empresa ${charge.local.companyId} · tentativa ${charge.local.attemptStatus} (${charge.local.source})`
              : "Sem tentativa local para este txid."}
          </Typography>
        </Box>
      ) : null}
    </AppSectionCard>
  );
}
