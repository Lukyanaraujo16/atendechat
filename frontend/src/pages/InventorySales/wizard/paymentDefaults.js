/**
 * Defaults de "Registrar como pago" por método (UX).
 * credit_card é sempre pago na conclusão (backend); checkbox fica locked.
 */
export function defaultRegisterAsPaid(paymentMethod) {
  switch (paymentMethod) {
    case "cash":
    case "pix":
    case "debit_card":
    case "credit_card":
    case "bank_transfer":
      return true;
    case "boleto":
    case "other":
      return false;
    default:
      return false;
  }
}

export function isRegisterAsPaidLocked(paymentMethod) {
  return paymentMethod === "credit_card";
}

export function resolveRegisterAsPaidForComplete(paymentMethod, checkboxValue) {
  if (paymentMethod === "credit_card") return true;
  return Boolean(checkboxValue);
}
