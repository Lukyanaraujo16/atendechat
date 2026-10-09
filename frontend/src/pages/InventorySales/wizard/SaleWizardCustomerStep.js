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
import { toast } from "react-toastify";

import { AppPrimaryButton, AppSecondaryButton } from "../../../ui";
import api from "../../../services/api";
import {
  createInventoryCustomerFromContact,
  searchInventoryCustomers,
} from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { useInventoryPermissions } from "../../../utils/inventoryAccess";
import InventoryCustomerFormDialog from "../InventoryCustomerFormDialog";
import {
  axiosAbortConfig,
  isAbortError,
} from "../saleProductSearch";
import { deliverySourceFromCustomer } from "./deliveryAddressUtils";

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
  banner: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "light"
        ? theme.palette.grey[50]
        : theme.palette.background.default,
  },
}));

function customerOptionFromSale(sale) {
  const customer = sale?.customer;
  if (customer?.id == null) return null;
  return {
    id: customer.id,
    name: customer.name || "",
    number: customer.phone || "",
    phone: customer.phone || null,
    document: customer.document || null,
    creditLimit: customer.creditLimit,
    creditAvailable: customer.creditAvailable,
    contactId: customer.contactId ?? null,
    postalCode: customer.postalCode || null,
    street: customer.street || null,
    addressNumber: customer.addressNumber || null,
    addressComplement: customer.addressComplement || null,
    district: customer.district || null,
    city: customer.city || null,
    state: customer.state || null,
    isActive: customer.isActive !== false,
  };
}

/** Compat: vendas antigas só com Contact. */
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
  selectedCustomer,
  setSelectedCustomer,
  walkIn,
  setWalkIn,
  users,
  setUsers,
  disabled,
}) {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerInput, setCustomerInput] = useState(
    selectedCustomer?.name || ""
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [sellerEditing, setSellerEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [creatingFromContact, setCreatingFromContact] = useState(false);
  const abortRef = useRef(null);
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const mountedRef = useRef(true);

  const orphanContact =
    !selectedCustomer &&
    !walkIn &&
    sale?.contactId != null &&
    sale?.customerId == null &&
    sale?.contact
      ? sale.contact
      : null;

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      clearTimeout(debounceRef.current);
    },
    []
  );

  useEffect(() => {
    if (!selectedCustomer) {
      if (walkIn) setCustomerInput("");
      return;
    }
    setCustomerInput(selectedCustomer.name || "");
  }, [selectedCustomer, walkIn]);

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

  const applyCustomer = useCallback(
    (value) => {
      setSelectedCustomer(value);
      setWalkIn(false);
      setHeaderForm((prev) => ({
        ...prev,
        customerId: value?.id != null ? String(value.id) : "",
        contactId:
          value?.contactId != null
            ? String(value.contactId)
            : prev.contactId && !value
              ? ""
              : value?.contactId == null
                ? ""
                : prev.contactId,
      }));
    },
    [setHeaderForm, setSelectedCustomer, setWalkIn]
  );

  const runCustomerSearch = useCallback(async (rawTerm, { browse } = {}) => {
    const query = String(rawTerm ?? "").trim();
    if (!query && !browse) {
      setSearchLoading(false);
      setSearchError(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setSearchLoading(true);
    setSearchError(false);
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
        requestId !== requestRef.current
      ) {
        return;
      }
      setCustomerOptions(Array.isArray(data?.customers) ? data.customers : []);
    } catch (err) {
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        isAbortError(err) ||
        requestId !== requestRef.current
      ) {
        return;
      }
      setSearchError(true);
      setCustomerOptions([]);
    } finally {
      if (mountedRef.current && requestId === requestRef.current) {
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (disabled || walkIn) return undefined;
    const query = customerInput.trim();
    if (!query && !popupOpen) {
      setCustomerOptions(selectedCustomer ? [selectedCustomer] : []);
      return undefined;
    }
    if (!query) {
      runCustomerSearch("", { browse: true });
      return undefined;
    }
    if (
      selectedCustomer &&
      query === String(selectedCustomer.name || "").trim()
    ) {
      return undefined;
    }
    debounceRef.current = setTimeout(() => runCustomerSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [
    customerInput,
    popupOpen,
    disabled,
    walkIn,
    selectedCustomer,
    runCustomerSearch,
  ]);

  const options = useMemo(() => {
    if (!selectedCustomer) return customerOptions;
    if (customerOptions.some((row) => row.id === selectedCustomer.id)) {
      return customerOptions;
    }
    return [selectedCustomer, ...customerOptions];
  }, [customerOptions, selectedCustomer]);

  const sellerName =
    users.find((u) => String(u.id) === String(headerForm.sellerUserId))?.name ||
    sale?.seller?.name ||
    "—";

  const chooseWalkIn = () => {
    setWalkIn(true);
    setSelectedCustomer(null);
    setCustomerInput("");
    setHeaderForm((prev) => ({
      ...prev,
      customerId: "",
      contactId: "",
    }));
  };

  const chooseSearch = () => {
    setWalkIn(false);
  };

  const handleCreateFromContact = async () => {
    if (!orphanContact?.id || creatingFromContact) return;
    setCreatingFromContact(true);
    try {
      const { data } = await createInventoryCustomerFromContact(
        orphanContact.id
      );
      toast.success(
        i18n.t("inventorySales.customers.toasts.createdFromContact")
      );
      applyCustomer({
        id: data.id,
        name: data.name,
        number: data.phone || "",
        phone: data.phone,
        document: data.document,
        contactId: data.contactId ?? orphanContact.id,
        postalCode: data.postalCode,
        street: data.street,
        addressNumber: data.addressNumber,
        addressComplement: data.addressComplement,
        district: data.district,
        city: data.city,
        state: data.state,
        creditLimit: data.creditLimit,
        isActive: data.isActive !== false,
      });
    } catch (err) {
      toastError(err);
    } finally {
      setCreatingFromContact(false);
    }
  };

  return (
    <Box className={classes.root} data-testid="sale-wizard-customer-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.customer.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("inventorySales.sales.wizard.customer.subtitle")}
      </Typography>

      {orphanContact ? (
        <Box className={classes.banner} data-testid="sale-wizard-from-contact">
          <Typography variant="body2" gutterBottom>
            {i18n.t("inventorySales.sales.wizard.customer.createFromContactHint")}
          </Typography>
          <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
            {orphanContact.name}
            {orphanContact.number ? ` · ${orphanContact.number}` : ""}
          </Typography>
          <Box mt={1} className={classes.choiceRow}>
            <AppPrimaryButton
              onClick={handleCreateFromContact}
              disabled={disabled || creatingFromContact}
              data-testid="sale-wizard-create-from-contact"
            >
              {creatingFromContact
                ? i18n.t("inventorySales.common.loading")
                : i18n.t("inventorySales.sales.wizard.customer.createFromContact")}
            </AppPrimaryButton>
          </Box>
        </Box>
      ) : null}

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
        {perms.canManageCustomers ? (
          <AppSecondaryButton
            onClick={() => setFormOpen(true)}
            disabled={disabled}
            data-testid="sale-wizard-new-customer"
          >
            {i18n.t("inventorySales.sales.wizard.customer.newCustomer")}
          </AppSecondaryButton>
        ) : null}
      </Box>

      {walkIn ? (
        <Box
          className={classes.selectedCard}
          data-testid="sale-wizard-walk-in-selected"
        >
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
            options={options}
            value={selectedCustomer}
            inputValue={customerInput}
            open={popupOpen}
            onOpen={() => setPopupOpen(true)}
            onClose={() => {
              if (abortRef.current) abortRef.current.abort();
              setSearchLoading(false);
              setPopupOpen(false);
            }}
            disabled={disabled}
            onChange={(_, value) => {
              applyCustomer(value);
              if (!value) {
                setCustomerOptions([]);
                setCustomerInput("");
              }
            }}
            onInputChange={(_, value, reason) => {
              setCustomerInput(value);
              if (reason === "input" || reason === "clear") {
                setSelectedCustomer(null);
                setWalkIn(false);
                setHeaderForm((prev) => ({
                  ...prev,
                  customerId: "",
                  contactId: "",
                }));
                setPopupOpen(true);
              }
            }}
            loading={searchLoading}
            filterOptions={(opts) => opts}
            getOptionSelected={(option, value) => option.id === value.id}
            getOptionLabel={(option) => option?.name || ""}
            noOptionsText={
              searchError
                ? i18n.t("inventorySales.sales.customerSearch.error")
                : i18n.t("inventorySales.sales.customerSearch.empty")
            }
            loadingText={i18n.t("inventorySales.sales.customerSearch.loading")}
            renderOption={(option) => (
              <Box minWidth={0}>
                <Typography variant="body2">{option.name}</Typography>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  display="block"
                >
                  {[option.document, option.phone || option.number]
                    .filter(Boolean)
                    .join(" · ")}
                  {option.creditAvailable != null
                    ? ` · ${formatCurrencyBRL(option.creditAvailable)}`
                    : ""}
                </Typography>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label={i18n.t("inventorySales.sales.fields.contact")}
                placeholder={i18n.t(
                  "inventorySales.sales.customerSearch.placeholder"
                )}
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
                      {searchLoading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {selectedCustomer ? (
            <Box
              className={classes.selectedCard}
              data-testid="sale-wizard-customer-selected"
            >
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {selectedCustomer.name}
              </Typography>
              {selectedCustomer.document ||
              selectedCustomer.phone ||
              selectedCustomer.number ? (
                <Typography variant="body2" color="textSecondary">
                  {[
                    selectedCustomer.document,
                    selectedCustomer.phone || selectedCustomer.number,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              ) : null}
              {selectedCustomer.creditAvailable != null ? (
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("inventorySales.sales.wizard.customer.selectedCredit", {
                    amount: formatCurrencyBRL(selectedCustomer.creditAvailable),
                  })}
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
          <FormControl
            variant="outlined"
            size="small"
            fullWidth
            disabled={disabled}
          >
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

      <InventoryCustomerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        canManageCustomerCredit={perms.canManageCustomerCredit}
        onSaved={(created) => {
          applyCustomer({
            id: created.id,
            name: created.name,
            number: created.phone || "",
            phone: created.phone,
            document: created.document,
            contactId: created.contactId,
            postalCode: created.postalCode,
            street: created.street,
            addressNumber: created.addressNumber,
            addressComplement: created.addressComplement,
            district: created.district,
            city: created.city,
            state: created.state,
            creditLimit: created.creditLimit,
            creditAvailable: created.creditLimit,
            isActive: created.isActive !== false,
          });
          setWalkIn(false);
        }}
      />
    </Box>
  );
}

export {
  contactOptionFromSale,
  customerOptionFromSale,
  deliverySourceFromCustomer,
};
