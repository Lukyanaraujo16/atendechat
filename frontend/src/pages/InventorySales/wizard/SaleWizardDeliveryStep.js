import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
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

import {
  AppEmptyState,
  AppLoadingState,
  AppSecondaryButton,
} from "../../../ui";
import {
  listInventoryDeliveryMethods,
  updateInventorySaleDelivery,
} from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import CurrencyInput from "../CurrencyInput";
import { BRAZIL_UF_LIST } from "../brazilianStates";
import SaleWizardTotals from "./SaleWizardTotals";
import {
  addressFromContact,
  addressFromSaleDelivery,
  emptyDeliveryAddress,
  formatAddressOneLine,
  getSaleDeliverySnapshot,
  isContactAddressComplete,
  moneyNumber,
  requiredDeliveryAddressErrors,
} from "./deliveryAddressUtils";
import useCepLookup, { cepLookupHelperText } from "../../../hooks/useCepLookup";
import {
  formatCepDisplay,
  mergeCepLookupIntoAddress,
} from "../../../utils/cepLookup";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: theme.spacing(1.5),
  },
  card: {
    textAlign: "left",
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    cursor: "pointer",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },
  cardSelected: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 0 0 1px rgba(255,255,255,0.08)"
        : "0 0 0 1px rgba(0,0,0,0.04)",
    fontWeight: 600,
  },
  cardName: {
    fontWeight: 700,
    display: "block",
  },
  cardMeta: {
    marginTop: 4,
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  contactAddressBox: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: "pre-line",
  },
  selectedMark: {
    fontSize: "0.75rem",
    color: theme.palette.primary.main,
    fontWeight: 600,
    marginTop: 6,
    display: "block",
  },
}));

function methodFeeLabel(method) {
  if (!method) return "";
  if (method.kind === "pickup") {
    return i18n.t("inventorySales.sales.wizard.delivery.noCost");
  }
  const amount = moneyNumber(method.defaultAmount);
  if (!method.allowAmountOverride) {
    return formatCurrencyBRL(amount);
  }
  if (amount > 0) {
    return i18n.t("inventorySales.sales.wizard.delivery.defaultOrCustom", {
      amount: formatCurrencyBRL(amount),
    });
  }
  return i18n.t("inventorySales.sales.wizard.delivery.amountOnSale");
}

function buildInitialState(sale, contact) {
  const delivery = getSaleDeliverySnapshot(sale);
  const methodId =
    sale?.deliveryMethodId != null ? String(sale.deliveryMethodId) : "";
  const useOther =
    Boolean(delivery) &&
    contact &&
    isContactAddressComplete(contact) &&
    (delivery.street || "") !== (contact.street || "");
  // Se há snapshot e contact completo, assume "outro" só quando diverge;
  // se snapshot existe, prioriza snapshot nos campos.
  const address = delivery
    ? addressFromSaleDelivery(delivery, contact)
    : contact
      ? addressFromContact(contact)
      : emptyDeliveryAddress();

  let addressMode = "form";
  if (contact && isContactAddressComplete(contact) && !delivery) {
    addressMode = "contact";
  } else if (contact && isContactAddressComplete(contact) && delivery && !useOther) {
    addressMode = "contact";
  } else if (contact && isContactAddressComplete(contact) && useOther) {
    addressMode = "other";
  } else {
    addressMode = "form";
  }

  return {
    methodId,
    freightAmount: moneyNumber(sale?.freightAmount),
    address,
    addressMode,
  };
}

const SaleWizardDeliveryStep = forwardRef(function SaleWizardDeliveryStep(
  { sale, contact, itemCount, disabled, onSaleUpdated },
  ref
) {
  const classes = useStyles();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [methodId, setMethodId] = useState("");
  const [freightAmount, setFreightAmount] = useState(0);
  const [address, setAddress] = useState(emptyDeliveryAddress());
  const [addressMode, setAddressMode] = useState("form");
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedMethod = useMemo(
    () => methods.find((m) => String(m.id) === String(methodId)) || null,
    [methods, methodId]
  );

  const hydrateFromSale = useCallback(
    (nextSale) => {
      const init = buildInitialState(nextSale, contact);
      setMethodId(init.methodId);
      setFreightAmount(init.freightAmount);
      setAddress(init.address);
      setAddressMode(init.addressMode);
      setFieldErrors({});
    },
    [contact]
  );

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await listInventoryDeliveryMethods({ active: true });
      const rows = Array.isArray(data) ? data : [];
      setMethods(rows);
    } catch (err) {
      setLoadError(true);
      setMethods([]);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    if (sale) hydrateFromSale(sale);
  }, [
    sale?.id,
    sale?.deliveryMethodId,
    sale?.freightAmount,
    sale?.updatedAt,
    contact?.id,
    hydrateFromSale,
  ]);

  const selectMethod = (method) => {
    setMethodId(String(method.id));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.method;
      return next;
    });
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

  const setAddressField = (field) => (e) => {
    const value = e.target.value;
    setAddress((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const cepLookupEnabled = Boolean(
    !disabled &&
      selectedMethod?.requiresAddress &&
      selectedMethod?.kind !== "pickup"
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

  const resolveAddressPayload = () => {
    if (!selectedMethod?.requiresAddress) return null;
    if (addressMode === "contact" && contact && isContactAddressComplete(contact)) {
      return addressFromContact(contact);
    }
    return { ...address };
  };

  useImperativeHandle(ref, () => ({
    async persist() {
      if (!sale?.id) return null;
      if (!selectedMethod) {
        setFieldErrors({ method: true });
        return null;
      }

      let recipientPayload = undefined;
      if (selectedMethod.requiresAddress) {
        const addr = resolveAddressPayload();
        const errors = requiredDeliveryAddressErrors(addr);
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          return null;
        }
        recipientPayload = {
          recipientName: String(addr.recipientName || "").trim(),
          recipientPhone: String(addr.recipientPhone || "").trim(),
          postalCode: String(addr.postalCode || "").trim() || null,
          street: String(addr.street || "").trim(),
          number: String(addr.number || "").trim(),
          complement: String(addr.complement || "").trim() || null,
          district: String(addr.district || "").trim(),
          city: String(addr.city || "").trim(),
          state: String(addr.state || "").trim().toUpperCase(),
          notes: String(addr.notes || address.notes || "").trim() || null,
        };
      }

      const body = {
        deliveryMethodId: selectedMethod.id,
      };
      if (
        selectedMethod.kind !== "pickup" &&
        selectedMethod.allowAmountOverride
      ) {
        body.freightAmount = moneyNumber(freightAmount);
      }
      if (recipientPayload) {
        body.recipient = {
          recipientName: recipientPayload.recipientName,
          recipientPhone: recipientPayload.recipientPhone,
          postalCode: recipientPayload.postalCode,
          street: recipientPayload.street,
          number: recipientPayload.number,
          complement: recipientPayload.complement,
          district: recipientPayload.district,
          city: recipientPayload.city,
          state: recipientPayload.state,
        };
        if (recipientPayload.notes) {
          body.notes = recipientPayload.notes;
        }
      }

      const { data } = await updateInventorySaleDelivery(sale.id, body);
      if (onSaleUpdated) onSaleUpdated(data);
      return data;
    },
  }));

  if (loading) {
    return (
      <AppLoadingState
        message={i18n.t("inventorySales.sales.wizard.delivery.loading")}
      />
    );
  }

  if (loadError) {
    return (
      <AppEmptyState
        title={i18n.t("inventorySales.sales.wizard.delivery.loadError")}
      >
        <AppSecondaryButton onClick={loadMethods}>
          {i18n.t("inventorySales.common.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  if (!methods.length) {
    return (
      <AppEmptyState
        title={i18n.t("inventorySales.sales.wizard.delivery.empty")}
        description={i18n.t("inventorySales.sales.wizard.delivery.emptyHint")}
      >
        <AppSecondaryButton onClick={loadMethods}>
          {i18n.t("inventorySales.common.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  const contactComplete = contact && isContactAddressComplete(contact);
  const showAddressSection = Boolean(selectedMethod?.requiresAddress);

  return (
    <Box className={classes.root} data-testid="sale-wizard-delivery-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.delivery.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("inventorySales.sales.wizard.delivery.subtitle")}
      </Typography>

      {fieldErrors.method ? (
        <Typography color="error" variant="body2">
          {i18n.t("inventorySales.sales.wizard.delivery.methodRequired")}
        </Typography>
      ) : null}

      <Box className={classes.cards} role="listbox" aria-label={i18n.t("inventorySales.sales.wizard.delivery.title")}>
        {methods.map((method) => {
          const selected = String(method.id) === String(methodId);
          return (
            <button
              key={method.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              data-testid={`delivery-method-card-${method.id}`}
              className={`${classes.card} ${selected ? classes.cardSelected : ""}`}
              onClick={() => selectMethod(method)}
            >
              <span className={classes.cardName}>{method.name}</span>
              <span className={classes.cardMeta}>{methodFeeLabel(method)}</span>
              {selected ? (
                <span className={classes.selectedMark}>
                  {i18n.t("inventorySales.sales.wizard.delivery.selected")}
                </span>
              ) : null}
            </button>
          );
        })}
      </Box>

      {selectedMethod?.kind === "pickup" ? (
        <Typography variant="body1" data-testid="delivery-pickup-info">
          {i18n.t("inventorySales.sales.wizard.delivery.pickupInfo")}
        </Typography>
      ) : null}

      {selectedMethod && selectedMethod.kind !== "pickup" && !selectedMethod.allowAmountOverride ? (
        <Box data-testid="delivery-fixed-fee">
          <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.sales.wizard.delivery.feeLabel")}
          </Typography>
          <Typography variant="h6">
            {formatCurrencyBRL(selectedMethod.defaultAmount)}
          </Typography>
        </Box>
      ) : null}

      {selectedMethod &&
      selectedMethod.kind !== "pickup" &&
      selectedMethod.allowAmountOverride ? (
        <Box data-testid="delivery-override-fee">
          <CurrencyInput
            label={i18n.t("inventorySales.sales.wizard.delivery.feeLabel")}
            value={freightAmount}
            onChange={(v) => setFreightAmount(moneyNumber(v))}
            disabled={disabled}
            fullWidth
          />
        </Box>
      ) : null}

      {showAddressSection ? (
        <Box className={classes.section} data-testid="delivery-address-section">
          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
            {i18n.t("inventorySales.sales.wizard.delivery.addressTitle")}
          </Typography>

          {contactComplete ? (
            <>
              <Box
                className={classes.contactAddressBox}
                data-testid="delivery-contact-address"
                style={
                  addressMode === "contact"
                    ? { outline: "2px solid", outlineColor: "currentColor" }
                    : undefined
                }
              >
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.sales.wizard.delivery.contactAddress")}
                </Typography>
                <Typography variant="body2">
                  {formatAddressOneLine(addressFromContact(contact))}
                </Typography>
                {addressMode !== "contact" ? (
                  <Box mt={1}>
                    <AppSecondaryButton
                      onClick={() => {
                        setAddressMode("contact");
                        setAddress(addressFromContact(contact));
                        setFieldErrors({});
                      }}
                      disabled={disabled}
                    >
                      {i18n.t("inventorySales.sales.wizard.delivery.useContactAddress")}
                    </AppSecondaryButton>
                  </Box>
                ) : null}
              </Box>
              {addressMode === "contact" ? (
                <AppSecondaryButton
                  onClick={() => setAddressMode("other")}
                  disabled={disabled}
                  data-testid="delivery-other-address"
                >
                  {i18n.t("inventorySales.sales.wizard.delivery.otherAddress")}
                </AppSecondaryButton>
              ) : null}
            </>
          ) : null}

          {(addressMode === "other" || addressMode === "form" || !contactComplete) &&
          !(addressMode === "contact" && contactComplete) ? (
            <Grid container spacing={2} data-testid="delivery-address-form">
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.recipientName")}
                  value={address.recipientName}
                  onChange={setAddressField("recipientName")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.recipientName)}
                  helperText={
                    fieldErrors.recipientName
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-recipientName" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.recipientPhone")}
                  value={address.recipientPhone}
                  onChange={setAddressField("recipientPhone")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.recipientPhone)}
                  helperText={
                    fieldErrors.recipientPhone
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-recipientPhone" }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.postalCode")}
                  value={address.postalCode}
                  onChange={handlePostalCodeChange}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={disabled}
                  helperText={cepLookupHelperText(cepStatus, (key) =>
                    i18n.t(key)
                  )}
                  FormHelperTextProps={{
                    "data-testid": "delivery-cep-helper",
                  }}
                  inputProps={{
                    "data-testid": "delivery-field-postalCode",
                    inputMode: "numeric",
                    maxLength: 9,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.street")}
                  value={address.street}
                  onChange={setAddressField("street")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.street)}
                  helperText={
                    fieldErrors.street
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-street" }}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.number")}
                  value={address.number}
                  onChange={setAddressField("number")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.number)}
                  helperText={
                    fieldErrors.number
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-number" }}
                />
              </Grid>
              <Grid item xs={6} sm={8}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.complement")}
                  value={address.complement}
                  onChange={setAddressField("complement")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={disabled}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.district")}
                  value={address.district}
                  onChange={setAddressField("district")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.district)}
                  helperText={
                    fieldErrors.district
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-district" }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.city")}
                  value={address.city}
                  onChange={setAddressField("city")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.city)}
                  helperText={
                    fieldErrors.city
                      ? i18n.t("inventorySales.sales.wizard.delivery.errors.required")
                      : undefined
                  }
                  disabled={disabled}
                  inputProps={{ "data-testid": "delivery-field-city" }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  error={Boolean(fieldErrors.state)}
                  disabled={disabled}
                >
                  <InputLabel id="delivery-uf-label">
                    {i18n.t("inventorySales.sales.wizard.delivery.fields.state")}
                  </InputLabel>
                  <Select
                    labelId="delivery-uf-label"
                    label={i18n.t("inventorySales.sales.wizard.delivery.fields.state")}
                    value={address.state || ""}
                    onChange={setAddressField("state")}
                    data-testid="delivery-state-select"
                  >
                    {BRAZIL_UF_LIST.map((uf) => (
                      <MenuItem key={uf} value={uf}>
                        {uf}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.state ? (
                    <FormHelperText>
                      {i18n.t("inventorySales.sales.wizard.delivery.errors.required")}
                    </FormHelperText>
                  ) : null}
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label={i18n.t("inventorySales.sales.wizard.delivery.fields.notes")}
                  value={address.notes}
                  onChange={setAddressField("notes")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  disabled={disabled}
                />
              </Grid>
            </Grid>
          ) : null}
        </Box>
      ) : null}

      <SaleWizardTotals
        sale={sale}
        itemCount={itemCount}
        previewFreightAmount={previewFreight}
      />
    </Box>
  );
});

export default SaleWizardDeliveryStep;
