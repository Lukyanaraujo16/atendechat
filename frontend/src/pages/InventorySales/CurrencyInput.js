import React, { useEffect, useState } from "react";
import { TextField } from "@material-ui/core";

/**
 * Input monetário BRL com digitação por centavos (PDV).
 * Digitar 1 → R$ 0,01; 100 → R$ 1,00. Sem vírgula manual.
 *
 * value: número decimal (reais) ou null/undefined → 0
 * onChange: (reaisNumber) => void
 */
export function reaisToCents(value) {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

export function centsToReais(cents) {
  const safe = Number.isFinite(Number(cents)) ? Math.max(0, Math.trunc(Number(cents))) : 0;
  return safe / 100;
}

export function formatCentsAsBRL(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centsToReais(cents));
}

export function parseCurrencyKeyToCents(prevCents, key) {
  const base = Math.max(0, Math.trunc(Number(prevCents) || 0));
  if (key === "Backspace") {
    return Math.trunc(base / 10);
  }
  if (/^\d$/.test(key)) {
    const next = base * 10 + Number(key);
    if (next > Number.MAX_SAFE_INTEGER) return base;
    return next;
  }
  return base;
}

export default function CurrencyInput({
  value,
  onChange,
  disabled = false,
  error = false,
  helperText,
  label,
  fullWidth = true,
  size = "small",
  variant = "outlined",
  /** Quando true, value null/undefined mostra vazio até o primeiro dígito. */
  allowEmpty = false,
  inputProps,
  InputProps,
  name,
  id,
  "data-testid": dataTestId,
  ...rest
}) {
  const isEmptyValue =
    allowEmpty && (value === null || value === undefined || value === "");
  const [cents, setCents] = useState(() =>
    isEmptyValue ? null : reaisToCents(value)
  );

  useEffect(() => {
    if (allowEmpty && (value === null || value === undefined || value === "")) {
      setCents(null);
      return;
    }
    setCents(reaisToCents(value));
  }, [value, allowEmpty]);

  const emit = (nextCents) => {
    setCents(nextCents);
    if (!onChange) return;
    if (nextCents == null) onChange(null);
    else onChange(centsToReais(nextCents));
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    const { key } = event;
    if (
      key === "Tab" ||
      key === "Escape" ||
      key === "Enter" ||
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "Home" ||
      key === "End"
    ) {
      return;
    }
    if (key === "Backspace") {
      event.preventDefault();
      const next = parseCurrencyKeyToCents(cents ?? 0, "Backspace");
      if (allowEmpty && next === 0) emit(null);
      else emit(next);
      return;
    }
    if (/^\d$/.test(key)) {
      event.preventDefault();
      emit(parseCurrencyKeyToCents(cents ?? 0, key));
      return;
    }
    // Bloqueia letras, vírgula, ponto, etc.
    if (key.length === 1) {
      event.preventDefault();
    }
  };

  const handlePaste = (event) => {
    if (disabled) return;
    event.preventDefault();
    const text = String(event.clipboardData?.getData("text") || "").replace(
      /\D/g,
      ""
    );
    if (!text) {
      emit(0);
      return;
    }
    const next = Number(text);
    emit(Number.isFinite(next) ? next : 0);
  };

  const display =
    cents == null && allowEmpty ? "" : formatCentsAsBRL(cents ?? 0);

  return (
    <TextField
      {...rest}
      id={id}
      name={name}
      label={label}
      value={display}
      placeholder={allowEmpty ? "R$ 0,00" : undefined}
      disabled={disabled}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={() => {}}
      inputProps={{
        inputMode: "numeric",
        autoComplete: "off",
        "data-testid": dataTestId,
        ...inputProps,
      }}
      InputProps={InputProps}
    />
  );
}
