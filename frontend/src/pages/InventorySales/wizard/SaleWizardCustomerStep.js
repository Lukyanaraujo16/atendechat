import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { makeStyles } from "@material-ui/core/styles";

import { AppPrimaryButton, AppSecondaryButton } from "../../../ui";
import api from "../../../services/api";
import { searchInventoryCustomers } from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";
import {
  axiosAbortConfig,
  isAbortError,
} from "../saleProductSearch";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
  },
  choiceRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  sellerRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  selectedCard: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
}));

function contactOptionFromSale(sale) {
  const contact = sale?.contact;
  if (contact?.id == null) return null;
  return {
    id: contact.id,
    name: contact.name || "",
    number: contact.number || "",
    postalCode: contact.postalCode || null,
    street: contact.street || null,
    addressNumber: contact.addressNumber || null,
    addressComplement: contact.addressComplement || null,
    district: contact.district || null,
    city: contact.city || null,
    state: contact.state || null,
  };
}

export default function SaleWizardCustomerStep({
  sale,
  headerForm,
  setHeaderForm,
  selectedContact,
  setSelectedContact,
  walkIn,
  setWalkIn,
  users,
  setUsers,
  disabled,
}) {
  const classes = useStyles();
  const [contactOptions, setContactOptions] = useState([]);
  const [contactInput, setContactInput] = useState(selectedContact?.name || "");
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [contactSearchError, setContactSearchError] = useState(false);
  const [contactPopupOpen, setContactPopupOpen] = useState(false);
  const [sellerEditing, setSellerEditing] = useState(false);
  const contactAbortRef = useRef(null);
  const contactRequestRef = useRef(0);
  const contactTypedRef = useRef("");
  const contactDebounceRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (contactAbortRef.current) contactAbortRef.current.abort();
    clearTimeout(contactDebounceRef.current);
  }, []);

  useEffect(() => {
    if (!selectedContact) {
      if (walkIn) setContactInput("");
      return;
    }
    setContactInput(selectedContact.name || "");
  }, [selectedContact, walkIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/users/list");
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        toastError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUsers]);

  const runContactSearch = useCallback(async (rawTerm, { browse } = {}) => {
    const query = String(rawTerm ?? "").trim();
    if (!query && !browse) {
      setContactSearchLoading(false);
      setContactSearchError(false);
      return;
    }
    contactTypedRef.current = query;
    if (contactAbortRef.current) contactAbortRef.current.abort();
    const controller = new AbortController();
    contactAbortRef.current = controller;
    const requestId = ++contactRequestRef.current;
    setContactSearchLoading(true);
    setContactSearchError(false);
    try {
      const params = { limit: 20 };
      if (query) params.search = query;
      const { data } = await searchInventoryCustomers(
        params,
        axiosAbortConfig(controller)
      );
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestId !== contactRequestRef.current
      ) {
        return;
      }
      setContactOptions(Array.isArray(data?.customers) ? data.customers : []);
    } catch (err) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        isAbortError(err) ||
        requestId !== contactRequestRef.current
      ) {
        return;
      }
      setContactSearchError(true);
      setContactOptions([]);
    } finally {
      if (mountedRef.current && requestId === contactRequestRef.current) {
        setContactSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (disabled || walkIn) return undefined;
    const query = contactInput.trim();
    if (!query && !contactPopupOpen) {
      setContactOptions(selectedContact ? [selectedContact] : []);
      return undefined;
    }
    if (!query) {
      runContactSearch("", { browse: true });
      return undefined;
    }
    if (
      selectedContact &&
      query === String(selectedContact.name || "").trim()
    ) {
      return undefined;
    }
    contactDebounceRef.current = setTimeout(() => runContactSearch(query), 300);
    return () => clearTimeout(contactDebounceRef.current);
  }, [
    contactInput,
    contactPopupOpen,
    disabled,
    walkIn,
    selectedContact,
    runContactSearch,
  ]);

  const customerOptions = useMemo(() => {
    if (!selectedContact) return contactOptions;
    if (contactOptions.some((row) => row.id === selectedContact.id)) {
      return contactOptions;
    }
    return [selectedContact, ...contactOptions];
  }, [contactOptions, selectedContact]);

  const sellerName =
    users.find((u) => String(u.id) === String(headerForm.sellerUserId))?.name ||
    sale?.seller?.name ||
    "—";

  const chooseWalkIn = () => {
    setWalkIn(true);
    setSelectedContact(null);
    setContactInput("");
    setHeaderForm((prev) => ({ ...prev, contactId: "" }));
  };

  const chooseSearch = () => {
    setWalkIn(false);
  };

  return (
    <Box className={classes.root} data-testid="sale-wizard-customer-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.customer.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("inventorySales.sales.wizard.customer.subtitle")}
      </Typography>

      <Box className={classes.choiceRow}>
        <AppPrimaryButton onClick={chooseSearch} disabled={disabled}>
          {i18n.t("inventorySales.sales.wizard.customer.search")}
        </AppPrimaryButton>
        <AppSecondaryButton
          onClick={chooseWalkIn}
          disabled={disabled}
          data-testid="sale-wizard-walk-in"
        >
          {i18n.t("inventorySales.sales.wizard.customer.walkIn")}
        </AppSecondaryButton>
      </Box>

      {walkIn ? (
        <Box className={classes.selectedCard} data-testid="sale-wizard-walk-in-selected">
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.sales.wizard.customer.walkInSelected")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.wizard.customer.walkInHint")}
          </Typography>
          <Box mt={1}>
            <AppSecondaryButton onClick={chooseSearch} disabled={disabled}>
              {i18n.t("inventorySales.sales.wizard.customer.changeCustomer")}
            </AppSecondaryButton>
          </Box>
        </Box>
      ) : (
        <>
          <Autocomplete
            options={customerOptions}
            value={selectedContact}
            inputValue={contactInput}
            open={contactPopupOpen}
            onOpen={() => setContactPopupOpen(true)}
            onClose={() => {
              if (contactAbortRef.current) contactAbortRef.current.abort();
              setContactSearchLoading(false);
              setContactPopupOpen(false);
            }}
            disabled={disabled}
            onChange={(_, value) => {
              setSelectedContact(value);
              setWalkIn(false);
              setHeaderForm((prev) => ({
                ...prev,
                contactId: value?.id != null ? String(value.id) : "",
              }));
              if (!value) {
                setContactOptions([]);
                setContactInput("");
              }
            }}
            onInputChange={(_, value, reason) => {
              setContactInput(value);
              if (reason === "input" || reason === "clear") {
                setSelectedContact(null);
                setWalkIn(false);
                setHeaderForm((prev) => ({ ...prev, contactId: "" }));
                setContactPopupOpen(true);
              }
            }}
            loading={contactSearchLoading}
            filterOptions={(opts) => opts}
            getOptionSelected={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option?.name || ""}
            noOptionsText={
              contactSearchError
                ? i18n.t("inventorySales.sales.customerSearch.error")
                : i18n.t("inventorySales.sales.customerSearch.empty")
            }
            loadingText={i18n.t("inventorySales.sales.customerSearch.loading")}
            renderOption={(option) => (
              <Box minWidth={0}>
                <Typography variant="body2">{option.name}</Typography>
                {option.number ? (
                  <Typography variant="caption" color="textSecondary" display="block">
                    {option.number}
                  </Typography>
                ) : null}
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={i18n.t("inventorySales.sales.fields.contact")}
                placeholder={i18n.t("inventorySales.sales.customerSearch.placeholder")}
                variant="outlined"
                size="small"
                inputProps={{
                  ...params.inputProps,
                  "data-testid": "sale-wizard-customer-search",
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {contactSearchLoading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {selectedContact ? (
            <Box className={classes.selectedCard} data-testid="sale-wizard-customer-selected">
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {selectedContact.name}
              </Typography>
              {selectedContact.number ? (
                <Typography variant="body2" color="textSecondary">
                  {selectedContact.number}
                </Typography>
              ) : null}
            </Box>
          ) : null}
        </>
      )}

      <Box>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("inventorySales.sales.fields.seller")}
        </Typography>
        {!sellerEditing ? (
          <Box className={classes.sellerRow}>
            <Typography variant="body1" data-testid="sale-wizard-seller-name">
              {sellerName}
            </Typography>
            <AppSecondaryButton
              size="small"
              onClick={() => setSellerEditing(true)}
              disabled={disabled}
              data-testid="sale-wizard-seller-change"
            >
              {i18n.t("inventorySales.sales.wizard.customer.changeSeller")}
            </AppSecondaryButton>
          </Box>
        ) : (
          <FormControl variant="outlined" size="small" fullWidth disabled={disabled}>
            <InputLabel id="wizard-seller-label">
              {i18n.t("inventorySales.sales.fields.seller")}
            </InputLabel>
            <Select
              labelId="wizard-seller-label"
              value={headerForm.sellerUserId}
              onChange={(e) => {
                setHeaderForm((prev) => ({
                  ...prev,
                  sellerUserId: e.target.value,
                }));
                setSellerEditing(false);
              }}
              label={i18n.t("inventorySales.sales.fields.seller")}
              data-testid="sale-wizard-seller-select"
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      <TextField
        label={i18n.t("inventorySales.sales.fields.notes")}
        value={headerForm.notes}
        onChange={(e) =>
          setHeaderForm((prev) => ({ ...prev, notes: e.target.value }))
        }
        variant="outlined"
        size="small"
        fullWidth
        multiline
        rows={2}
        disabled={disabled}
        inputProps={{ "data-testid": "sale-wizard-notes" }}
      />
    </Box>
  );
}

export { contactOptionFromSale };
