import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import { useFormikContext } from "formik";

import { i18n } from "../../../translate/i18n";
import { AppSectionCard } from "../../../ui";
import {
  BR_STATES,
  fetchViaCep,
  maskCep,
  maskCpfCnpj,
  maskPhone,
  onlyDigits,
  validateDocument,
  viaCepErrorMessage,
} from "../../../helpers/brMasks";

const useStyles = makeStyles((theme) => ({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    lineHeight: 1.35,
    marginBottom: theme.spacing(0.5),
  },
  sectionHint: {
    marginBottom: theme.spacing(1),
    lineHeight: 1.5,
    maxWidth: 720,
  },
}));

/**
 * Aba Cadastro: dados cadastrais da empresa (não mistura dados do usuário administrador).
 * Todos os campos além do nome são opcionais; cadastros antigos incompletos continuam salváveis.
 */
export default function TabCadastro() {
  const classes = useStyles();
  const formik = useFormikContext();
  const { values, errors, touched, submitCount, setFieldValue, setFieldTouched } = formik;

  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState({ text: "", error: false });
  const lastLookupRef = useRef(onlyDigits(values.addressZipCode));
  const requestSeq = useRef(0);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const showError = (name) => Boolean(errors[name] && (touched[name] || submitCount > 0));

  const textProps = (name, extra = {}) => ({
    id: `company-field-${name}`,
    name,
    value: values[name] ?? "",
    onChange: (e) => setFieldValue(name, e.target.value),
    onBlur: () => setFieldTouched(name, true),
    variant: "outlined",
    margin: "dense",
    fullWidth: true,
    error: showError(name),
    helperText: showError(name) ? errors[name] : extra.helperText,
    ...extra,
  });

  const lookupCep = async (cepValue, { force = false } = {}) => {
    const digits = onlyDigits(cepValue);
    if (digits.length !== 8) return;
    if (!force && digits === lastLookupRef.current) return;
    lastLookupRef.current = digits;
    const seq = ++requestSeq.current;
    setCepLoading(true);
    setCepMessage({ text: "", error: false });
    try {
      const addr = await fetchViaCep(digits);
      if (!mountedRef.current || seq !== requestSeq.current) return;
      if (addr.street) setFieldValue("addressStreet", addr.street);
      if (addr.neighborhood) setFieldValue("addressNeighborhood", addr.neighborhood);
      if (addr.city) setFieldValue("addressCity", addr.city);
      if (addr.state) setFieldValue("addressState", addr.state);
      if (addr.complement && !String(values.addressComplement || "").trim()) {
        setFieldValue("addressComplement", addr.complement);
      }
      setCepMessage({
        text: "Endereço preenchido pelo CEP. Confira os dados e informe o número.",
        error: false,
      });
    } catch (err) {
      if (!mountedRef.current || seq !== requestSeq.current) return;
      setCepMessage({ text: viaCepErrorMessage(err), error: true });
    } finally {
      if (mountedRef.current && seq === requestSeq.current) setCepLoading(false);
    }
  };

  const doc = validateDocument(values.document);
  const docHelper = showError("document")
    ? errors.document
    : doc.type === "cpf"
      ? "CPF"
      : doc.type === "cnpj"
        ? "CNPJ"
        : "CPF ou CNPJ (opcional)";

  const cepHelper = showError("addressZipCode")
    ? errors.addressZipCode
    : cepMessage.text || "Digite o CEP para preencher o endereço automaticamente.";

  return (
    <Box className={classes.stack}>
      <AppSectionCard>
        <Typography className={classes.sectionTitle} component="h2">
          Identificação
        </Typography>
        <Typography variant="body2" color="textSecondary" className={classes.sectionHint}>
          Dados cadastrais da empresa cliente. Os dados do usuário administrador ficam na aba
          “Usuários”.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              {...textProps("name")}
              label={i18n.t("settings.company.form.name")}
              required
              inputProps={{ maxLength: 255 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField {...textProps("tradeName")} label="Nome fantasia" inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField {...textProps("legalName")} label="Razão social" inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              {...textProps("document")}
              label="CPF/CNPJ"
              onChange={(e) => setFieldValue("document", maskCpfCnpj(e.target.value))}
              inputProps={{ inputMode: "numeric", maxLength: 18 }}
              helperText={docHelper}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              {...textProps("email")}
              type="email"
              label={i18n.t("settings.company.form.emailMain")}
              inputProps={{ maxLength: 255 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              {...textProps("phone")}
              label="Telefone (com DDD)"
              placeholder="(11) 91234-5678"
              onChange={(e) => setFieldValue("phone", maskPhone(e.target.value))}
              inputProps={{ inputMode: "tel", maxLength: 20 }}
            />
          </Grid>
        </Grid>
      </AppSectionCard>

      <AppSectionCard>
        <Typography className={classes.sectionTitle} component="h2">
          Endereço
        </Typography>
        <Typography variant="body2" color="textSecondary" className={classes.sectionHint}>
          A busca pelo CEP usa o ViaCEP. Todos os campos podem ser editados manualmente.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              {...textProps("addressZipCode")}
              label="CEP"
              placeholder="00000-000"
              onChange={(e) => {
                const masked = maskCep(e.target.value);
                setFieldValue("addressZipCode", masked);
                if (onlyDigits(masked).length === 8) lookupCep(masked);
              }}
              onBlur={() => {
                setFieldTouched("addressZipCode", true);
                lookupCep(values.addressZipCode);
              }}
              inputProps={{ inputMode: "numeric", maxLength: 9 }}
              error={showError("addressZipCode") || cepMessage.error}
              helperText={cepHelper}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {cepLoading ? (
                      <CircularProgress size={18} />
                    ) : (
                      <Tooltip title="Buscar endereço pelo CEP">
                        <span>
                          <IconButton
                            size="small"
                            edge="end"
                            aria-label="Buscar endereço pelo CEP"
                            disabled={onlyDigits(values.addressZipCode).length !== 8}
                            onClick={() => lookupCep(values.addressZipCode, { force: true })}
                          >
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={8} md={6}>
            <TextField {...textProps("addressStreet")} label="Logradouro" inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <TextField {...textProps("addressNumber")} label="Número" inputProps={{ maxLength: 20 }} />
          </Grid>
          <Grid item xs={6} sm={8} md={3}>
            <TextField
              {...textProps("addressComplement")}
              label="Complemento"
              inputProps={{ maxLength: 255 }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField {...textProps("addressNeighborhood")} label="Bairro" inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid item xs={8} sm={4} md={3}>
            <TextField {...textProps("addressCity")} label="Cidade" inputProps={{ maxLength: 255 }} />
          </Grid>
          <Grid item xs={4} sm={2} md={2}>
            <TextField
              {...textProps("addressState")}
              select
              label="UF"
              SelectProps={{ displayEmpty: false }}
            >
              <MenuItem value="">
                <em>—</em>
              </MenuItem>
              {values.addressState && !BR_STATES.includes(values.addressState) ? (
                <MenuItem value={values.addressState}>{values.addressState}</MenuItem>
              ) : null}
              {BR_STATES.map((uf) => (
                <MenuItem key={uf} value={uf}>
                  {uf}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </AppSectionCard>
    </Box>
  );
}
