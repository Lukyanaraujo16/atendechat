import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import useCepLookup, { cepLookupHelperText } from "../../hooks/useCepLookup";
import {
  createInventoryCustomer,
  searchInventoryContacts,
  updateInventoryCustomer,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { BRAZIL_UF_LIST } from "./brazilianStates";
import { CUSTOMER_TYPES } from "./constants";
import CurrencyInput from "./CurrencyInput";
import {
  axiosAbortConfig,
  isAbortError,
} from "./saleProductSearch";

const emptyForm = {
  type: "individual",
  name: "",
  tradeName: "",
  document: "",
  phone: "",
  email: "",
  postalCode: "",
  street: "",
  addressNumber: "",
  addressComplement: "",
  district: "",
  city: "",
  state: "",
  notes: "",
  creditLimit: 0,
  contactId: "",
};

export default function InventoryCustomerFormDialog({
  open,
  onClose,
  customer,
  onSaved,
  canManageCustomerCredit,
  initialContact,
}) {
  const isEdit = customer?.id != null;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [contactOptions, setContactOptions] = useState([]);
  const [contactInput, setContactInput] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const contactAbortRef = useRef(null);
  const debounceRef = useRef(null);

  const applyCep = useCallback((addr) => {
    setForm((prev) => ({
      ...prev,
      postalCode: addr.postalCode || prev.postalCode,
      street: addr.street || prev.street,
      district: addr.district || prev.district,
      city: addr.city || prev.city,
      state: addr.state || prev.state,
    }));
  }, []);

  const { status: cepStatus, lookup } = useCepLookup({
    enabled: open,
    onSuccess: applyCep,
  });
  const cepHelper = cepLookupHelperText(cepStatus, (key) => i18n.t(key));

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        type: customer.type || "individual",
        name: customer.name || "",
        tradeName: customer.tradeName || "",
        document: customer.document || "",
        phone: customer.phone || "",
        email: customer.email || "",
        postalCode: customer.postalCode || "",
        street: customer.street || "",
        addressNumber: customer.addressNumber || "",
        addressComplement: customer.addressComplement || "",
        district: customer.district || "",
        city: customer.city || "",
        state: customer.state || "",
        notes: customer.notes || "",
        creditLimit: Number(customer.creditLimit) || 0,
        contactId: customer.contactId != null ? String(customer.contactId) : "",
      });
      setSelectedContact(customer.contact || null);
      setContactInput(customer.contact?.name || "");
    } else if (initialContact) {
      setForm({
        ...emptyForm,
        name: initialContact.name || "",
        phone: initialContact.number || "",
        email: initialContact.email || "",
        postalCode: initialContact.postalCode || "",
        street: initialContact.street || "",
        addressNumber: initialContact.addressNumber || "",
        addressComplement: initialContact.addressComplement || "",
        district: initialContact.district || "",
        city: initialContact.city || "",
        state: initialContact.state || "",
        contactId: String(initialContact.id),
      });
      setSelectedContact(initialContact);
      setContactInput(initialContact.name || "");
    } else {
      setForm(emptyForm);
      setSelectedContact(null);
      setContactInput("");
    }
  }, [open, isEdit, customer, initialContact]);

  useEffect(
    () => () => {
      if (contactAbortRef.current) contactAbortRef.current.abort();
      clearTimeout(debounceRef.current);
    },
    []
  );

  const runContactSearch = useCallback(async (raw) => {
    const query = String(raw ?? "").trim();
    if (contactAbortRef.current) contactAbortRef.current.abort();
    const controller = new AbortController();
    contactAbortRef.current = controller;
    setContactLoading(true);
    try {
      const params = { limit: 20 };
      if (query) params.search = query;
      const { data } = await searchInventoryContacts(
        params,
        axiosAbortConfig(controller)
      );
      if (controller.signal.aborted) return;
      setContactOptions(Array.isArray(data?.contacts) ? data.contacts : []);
    } catch (err) {
      if (!isAbortError(err) && !controller.signal.aborted) {
        setContactOptions([]);
      }
    } finally {
      if (!controller.signal.aborted) setContactLoading(false);
    }
  }, []);

  const setField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(i18n.t("inventorySales.customers.validation.name"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        type: form.type,
        name: form.name.trim(),
        tradeName: form.tradeName.trim() || null,
        document: form.document.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        postalCode: form.postalCode.trim() || null,
        street: form.street.trim() || null,
        addressNumber: form.addressNumber.trim() || null,
        addressComplement: form.addressComplement.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        notes: form.notes.trim() || null,
        contactId: form.contactId ? Number(form.contactId) : null,
      };
      if (canManageCustomerCredit) {
        body.creditLimit = Number(form.creditLimit) || 0;
      }
      let saved;
      if (isEdit) {
        const { data } = await updateInventoryCustomer(customer.id, body);
        saved = data;
        toast.success(i18n.t("inventorySales.customers.toasts.updated"));
      } else {
        const { data } = await createInventoryCustomer(body);
        saved = data;
        toast.success(i18n.t("inventorySales.customers.toasts.created"));
      }
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="md"
      data-testid="inventory-customer-form-dialog"
    >
      <form onSubmit={handleSubmit}>
        <AppDialogTitle>
          {isEdit
            ? i18n.t("inventorySales.customers.form.editTitle")
            : i18n.t("inventorySales.customers.form.newTitle")}
        </AppDialogTitle>
        <AppDialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>
                  {i18n.t("inventorySales.customers.form.type")}
                </InputLabel>
                <Select
                  label={i18n.t("inventorySales.customers.form.type")}
                  value={form.type}
                  onChange={setField("type")}
                  disabled={saving}
                >
                  {CUSTOMER_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {i18n.t(`inventorySales.customers.types.${type}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                label={i18n.t("inventorySales.customers.form.name")}
                value={form.name}
                onChange={setField("name")}
                variant="outlined"
                size="small"
                fullWidth
                required
                disabled={saving}
                inputProps={{ "data-testid": "customer-form-name" }}
              />
            </Grid>
            {form.type === "company" ? (
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.customers.form.tradeName")}
                  value={form.tradeName}
                  onChange={setField("tradeName")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={saving}
                />
              </Grid>
            ) : null}
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("inventorySales.customers.form.document")}
                value={form.document}
                onChange={setField("document")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("inventorySales.customers.form.phone")}
                value={form.phone}
                onChange={setField("phone")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("inventorySales.customers.form.email")}
                value={form.email}
                onChange={setField("email")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={i18n.t("inventorySales.customers.form.postalCode")}
                value={form.postalCode}
                onChange={(e) => {
                  const formatted = lookup(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    postalCode: formatted || e.target.value,
                  }));
                }}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
                helperText={cepHelper}
                inputProps={{ inputMode: "numeric", maxLength: 9 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("inventorySales.customers.form.street")}
                value={form.street}
                onChange={setField("street")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label={i18n.t("inventorySales.customers.form.addressNumber")}
                value={form.addressNumber}
                onChange={setField("addressNumber")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                label={i18n.t("inventorySales.customers.form.addressComplement")}
                value={form.addressComplement}
                onChange={setField("addressComplement")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={i18n.t("inventorySales.customers.form.district")}
                value={form.district}
                onChange={setField("district")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={8} sm={4}>
              <TextField
                label={i18n.t("inventorySales.customers.form.city")}
                value={form.city}
                onChange={setField("city")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={saving}
              />
            </Grid>
            <Grid item xs={4} sm={2}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>
                  {i18n.t("inventorySales.customers.form.state")}
                </InputLabel>
                <Select
                  label={i18n.t("inventorySales.customers.form.state")}
                  value={form.state}
                  onChange={setField("state")}
                  disabled={saving}
                >
                  <MenuItem value="">—</MenuItem>
                  {BRAZIL_UF_LIST.map((uf) => (
                    <MenuItem key={uf} value={uf}>
                      {uf}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {canManageCustomerCredit ? (
              <Grid item xs={12} sm={6}>
                <CurrencyInput
                  label={i18n.t("inventorySales.customers.form.creditLimit")}
                  value={form.creditLimit}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, creditLimit: v }))
                  }
                  disabled={saving}
                  fullWidth
                  size="small"
                  variant="outlined"
                />
              </Grid>
            ) : null}
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("inventorySales.customers.form.linkContact")}
              </Typography>
              <Autocomplete
                options={contactOptions}
                value={selectedContact}
                inputValue={contactInput}
                onOpen={() => runContactSearch(contactInput)}
                loading={contactLoading}
                disabled={saving}
                filterOptions={(opts) => opts}
                getOptionSelected={(a, b) => a?.id === b?.id}
                getOptionLabel={(o) => o?.name || ""}
                onChange={(_, value) => {
                  setSelectedContact(value);
                  setForm((prev) => ({
                    ...prev,
                    contactId: value?.id != null ? String(value.id) : "",
                  }));
                  if (value && !isEdit) {
                    setForm((prev) => ({
                      ...prev,
                      contactId: String(value.id),
                      name: prev.name || value.name || "",
                      phone: prev.phone || value.number || "",
                      email: prev.email || value.email || "",
                      postalCode: prev.postalCode || value.postalCode || "",
                      street: prev.street || value.street || "",
                      addressNumber:
                        prev.addressNumber || value.addressNumber || "",
                      addressComplement:
                        prev.addressComplement || value.addressComplement || "",
                      district: prev.district || value.district || "",
                      city: prev.city || value.city || "",
                      state: prev.state || value.state || "",
                    }));
                  }
                }}
                onInputChange={(_, value, reason) => {
                  setContactInput(value);
                  if (reason === "input" || reason === "clear") {
                    clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(
                      () => runContactSearch(value),
                      300
                    );
                  }
                }}
                renderOption={(option) => (
                  <Box>
                    <Typography variant="body2">{option.name}</Typography>
                    {option.number ? (
                      <Typography variant="caption" color="textSecondary">
                        {option.number}
                      </Typography>
                    ) : null}
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={i18n.t("inventorySales.customers.form.searchContact")}
                    variant="outlined"
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {contactLoading ? (
                            <CircularProgress color="inherit" size={18} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("inventorySales.customers.form.notes")}
                value={form.notes}
                onChange={setField("notes")}
                variant="outlined"
                size="small"
                fullWidth
                multiline
                rows={2}
                disabled={saving}
              />
            </Grid>
          </Grid>
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton onClick={onClose} disabled={saving}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton
            type="submit"
            disabled={saving}
            data-testid="customer-form-save"
          >
            {saving
              ? i18n.t("inventorySales.common.loading")
              : i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}
