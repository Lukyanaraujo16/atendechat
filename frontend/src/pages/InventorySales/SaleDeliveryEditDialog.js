import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import {
  listInventoryDeliveryMethods,
  updateInventorySaleDelivery,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import CurrencyInput from "./CurrencyInput";
import { BRAZIL_UF_LIST } from "./brazilianStates";
import {
  addressFromSaleDelivery,
  emptyDeliveryAddress,
  getSaleDeliverySnapshot,
  moneyNumber,
  requiredDeliveryAddressErrors,
} from "./wizard/deliveryAddressUtils";
import useCepLookup, { cepLookupHelperText } from "../../hooks/useCepLookup";
import {
  formatCepDisplay,
  mergeCepLookupIntoAddress,
} from "../../utils/cepLookup";

const useStyles = makeStyles((theme) => ({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(0.5),
  },
  preview: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    [theme.breakpoints.up("sm")]: {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  previewLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  previewValue: {
    fontWeight: 700,
  },
}));

/** Mercadoria líquida após itens + global (sem frete) — backend autoritativo via total−freight. */
function merchandiseTotal(sale) {
  return (
    moneyNumber(sale?.totalAmount) - moneyNumber(sale?.freightAmount)
  );
}

export default function SaleDeliveryEditDialog({
  open,
  onClose,
  sale,
  onSaved,
}) {
  const classes = useStyles();
  const [methods, setMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [freightAmount, setFreightAmount] = useState(0);
  const [address, setAddress] = useState(emptyDeliveryAddress());
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const selectedMethod = useMemo(
    () => methods.find((m) => String(m.id) === String(methodId)) || null,
    [methods, methodId]
  );

  const applySaleToForm = useCallback((nextSale, methodList) => {
    if (!nextSale) return;
    const snapshot = getSaleDeliverySnapshot(nextSale);
    const currentId =
      nextSale.deliveryMethodId != null
        ? String(nextSale.deliveryMethodId)
        : "";
    let list = methodList;
    if (
      currentId &&
      nextSale.deliveryMethodName &&
      !methodList.some((m) => String(m.id) === currentId)
    ) {
      list = [
        ...methodList,
        {
          id: Number(currentId),
          name: nextSale.deliveryMethodName,
          kind: nextSale.deliveryKind || "other",
          defaultAmount: moneyNumber(nextSale.freightAmount),
          allowAmountOverride: true,
          requiresAddress: Boolean(snapshot?.street),
          active: false,
        },
      ];
    }
    setMethods(list);
    setMethodId(currentId);
    setFreightAmount(moneyNumber(nextSale.freightAmount));
    setAddress(addressFromSaleDelivery(snapshot, null));
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!open || !sale?.id) return undefined;
    let cancelled = false;
    setLoadingMethods(true);
    listInventoryDeliveryMethods({ active: true })
      .then(({ data }) => {
        if (cancelled) return;
        applySaleToForm(sale, Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        toastError(err);
        applySaleToForm(sale, []);
      })
      .finally(() => {
        if (!cancelled) setLoadingMethods(false);
      });
    return () => {
      cancelled = true;
    };
    // Prefill apenas ao abrir / trocar venda — não resetar a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale?.id, applySaleToForm]);

  const selectMethod = (id) => {
    const method = methods.find((m) => String(m.id) === String(id));
    setMethodId(String(id));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.method;
      return next;
    });
    if (!method) return;
    if (method.kind === "pickup") {
      setFreightAmount(0);
      return;
    }
    if (!method.allowAmountOverride) {
      setFreightAmount(moneyNumber(method.defaultAmount));
      return;
    }
    if (
      sale?.deliveryMethodId != null &&
      String(sale.deliveryMethodId) === String(method.id)
    ) {
      setFreightAmount(moneyNumber(sale.freightAmount));
    } else {
      setFreightAmount(moneyNumber(method.defaultAmount));
    }
  };

  const previewFreight =
    selectedMethod?.kind === "pickup"
      ? 0
      : selectedMethod && !selectedMethod.allowAmountOverride
        ? moneyNumber(selectedMethod.defaultAmount)
        : freightAmount;

  const currentTotal = moneyNumber(sale?.totalAmount);
  const newTotal = Math.max(
    0,
    Math.round((merchandiseTotal(sale) + previewFreight) * 100) / 100
  );
  const received = moneyNumber(sale?.paidAmount);

  const setAddressField = (field) => (e) => {
    const value = e.target.value;
    setAddress((prev) => ({
      ...prev,
      [field]: field === "state" ? String(value).toUpperCase() : value,
    }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const cepLookupEnabled = Boolean(
    !submitting &&
      selectedMethod &&
      selectedMethod.kind !== "pickup" &&
      selectedMethod.requiresAddress
  );

  const { status: cepStatus, lookup: lookupCep } = useCepLookup({
    enabled: cepLookupEnabled,
    onSuccess: (addr) => {
      setAddress((prev) => mergeCepLookupIntoAddress(prev, addr));
    },
  });

  const handlePostalCodeChange = (e) => {
    const formatted = formatCepDisplay(e.target.value);
    setAddress((prev) => ({ ...prev, postalCode: formatted }));
    setFieldErrors((prev) => {
      if (!prev.postalCode) return prev;
      const next = { ...prev };
      delete next.postalCode;
      return next;
    });
    if (cepLookupEnabled) lookupCep(formatted);
  };

  const handleSave = async () => {
    if (!sale?.id || submitLock.current || submitting) return;
    if (!selectedMethod) {
      setFieldErrors({ method: true });
      return;
    }
    if (selectedMethod.active === false &&
      String(selectedMethod.id) !== String(sale.deliveryMethodId)) {
      setFieldErrors({ method: true });
      return;
    }

    let recipientPayload;
    if (selectedMethod.requiresAddress && selectedMethod.kind !== "pickup") {
      const errors = requiredDeliveryAddressErrors(address);
      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        return;
      }
      recipientPayload = { ...address };
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const body = {
        deliveryMethodId: Number(selectedMethod.id),
        freightAmount: previewFreight,
      };
      if (recipientPayload) {
        body.recipient = recipientPayload;
      }
      const { data } = await updateInventorySaleDelivery(sale.id, body);
      toast.success(
        i18n.t("inventorySales.sales.delivery.editSuccess", "Entrega atualizada.")
      );
      if (onSaved) await onSaved(data);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const showAddress =
    selectedMethod &&
    selectedMethod.kind !== "pickup" &&
    selectedMethod.requiresAddress;
  const freightEditable =
    selectedMethod &&
    selectedMethod.kind !== "pickup" &&
    selectedMethod.allowAmountOverride;

  return (
    <AppDialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
      data-testid="sale-delivery-edit-dialog"
    >
      <AppDialogTitle>
        {i18n.t("inventorySales.sales.delivery.editTitle", "Editar entrega")}
      </AppDialogTitle>
      <AppDialogContent dividers>
        <Box className={classes.form}>
          <Box className={classes.preview} data-testid="sale-delivery-edit-preview">
            <Box>
              <Typography className={classes.previewLabel}>
                {i18n.t("inventorySales.sales.delivery.currentTotal", "Total atual")}
              </Typography>
              <Typography className={classes.previewValue}>
                {formatCurrencyBRL(currentTotal)}
              </Typography>
            </Box>
            <Box>
              <Typography className={classes.previewLabel}>
                {i18n.t("inventorySales.sales.delivery.newTotal", "Novo total")}
              </Typography>
              <Typography
                className={classes.previewValue}
                data-testid="sale-delivery-edit-new-total"
              >
                {formatCurrencyBRL(newTotal)}
              </Typography>
            </Box>
            <Box>
              <Typography className={classes.previewLabel}>
                {i18n.t("inventorySales.sales.delivery.alreadyReceived", "Já recebido")}
              </Typography>
              <Typography className={classes.previewValue}>
                {formatCurrencyBRL(received)}
              </Typography>
            </Box>
          </Box>

          <FormControl
            variant="outlined"
            fullWidth
            size="small"
            error={Boolean(fieldErrors.method)}
            disabled={loadingMethods || submitting}
          >
            <InputLabel id="sale-delivery-edit-method-label">
              {i18n.t("inventorySales.sales.wizard.delivery.reviewLabel")}
            </InputLabel>
            <Select
              labelId="sale-delivery-edit-method-label"
              label={i18n.t("inventorySales.sales.wizard.delivery.reviewLabel")}
              value={methodId}
              onChange={(e) => selectMethod(e.target.value)}
              data-testid="sale-delivery-edit-method"
            >
              {methods.map((method) => (
                <MenuItem
                  key={method.id}
                  value={String(method.id)}
                  disabled={method.active === false &&
                    String(method.id) !== String(sale?.deliveryMethodId)}
                >
                  {method.name}
                  {method.active === false ? " (inativa)" : ""}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.method ? (
              <FormHelperText>
                {i18n.t("inventorySales.sales.wizard.delivery.methodRequired")}
              </FormHelperText>
            ) : null}
          </FormControl>

          {selectedMethod && selectedMethod.kind !== "pickup" ? (
            <CurrencyInput
              label={i18n.t("inventorySales.sales.wizard.delivery.feeLabel")}
              value={previewFreight}
              onChange={setFreightAmount}
              disabled={!freightEditable || submitting}
              fullWidth
              size="small"
              variant="outlined"
              data-testid="sale-delivery-edit-freight"
            />
          ) : null}

          {showAddress ? (
            <Grid container spacing={1}>
              {[
                ["recipientName", "recipientName", 12],
                ["recipientPhone", "recipientPhone", 12],
                ["postalCode", "postalCode", 4],
                ["street", "street", 8],
                ["number", "number", 4],
                ["complement", "complement", 8],
                ["district", "district", 6],
                ["city", "city", 6],
              ].map(([field, labelKey, xs]) => (
                <Grid item xs={xs} key={field}>
                  <TextField
                    label={i18n.t(
                      `inventorySales.sales.wizard.delivery.fields.${labelKey}`
                    )}
                    value={address[field] || ""}
                    onChange={
                      field === "postalCode"
                        ? handlePostalCodeChange
                        : setAddressField(field)
                    }
                    error={Boolean(fieldErrors[field])}
                    helperText={
                      field === "postalCode"
                        ? cepLookupHelperText(cepStatus, (key) => i18n.t(key))
                        : undefined
                    }
                    FormHelperTextProps={
                      field === "postalCode"
                        ? { "data-testid": "sale-delivery-edit-cep-helper" }
                        : undefined
                    }
                    disabled={submitting}
                    fullWidth
                    size="small"
                    variant="outlined"
                    inputProps={{
                      "data-testid": `sale-delivery-edit-${field}`,
                      ...(field === "postalCode"
                        ? { inputMode: "numeric", maxLength: 9 }
                        : {}),
                    }}
                  />
                </Grid>
              ))}
              <Grid item xs={4}>
                <FormControl
                  variant="outlined"
                  fullWidth
                  size="small"
                  error={Boolean(fieldErrors.state)}
                  disabled={submitting}
                >
                  <InputLabel id="sale-delivery-edit-state-label">
                    {i18n.t("inventorySales.sales.wizard.delivery.fields.state")}
                  </InputLabel>
                  <Select
                    labelId="sale-delivery-edit-state-label"
                    label={i18n.t(
                      "inventorySales.sales.wizard.delivery.fields.state"
                    )}
                    value={address.state || ""}
                    onChange={setAddressField("state")}
                    data-testid="sale-delivery-edit-state"
                  >
                    {BRAZIL_UF_LIST.map((uf) => (
                      <MenuItem key={uf} value={uf}>
                        {uf}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={i18n.t(
                    "inventorySales.sales.wizard.delivery.fields.notes"
                  )}
                  value={address.notes || ""}
                  onChange={setAddressField("notes")}
                  disabled={submitting}
                  fullWidth
                  size="small"
                  variant="outlined"
                  multiline
                  minRows={2}
                  inputProps={{ "data-testid": "sale-delivery-edit-notes" }}
                />
              </Grid>
            </Grid>
          ) : null}
        </Box>
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={onClose} disabled={submitting}>
          {i18n.t("inventorySales.common.cancel")}
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={handleSave}
          disabled={submitting || loadingMethods || !methodId}
          data-testid="sale-delivery-edit-submit"
        >
          {submitting
            ? i18n.t("inventorySales.sales.wizard.nav.saving")
            : i18n.t("inventorySales.common.save")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
