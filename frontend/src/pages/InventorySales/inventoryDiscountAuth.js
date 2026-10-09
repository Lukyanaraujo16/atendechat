export function isDiscountAuthorizationRequiredError(err) {
  return (
    err?.response?.data?.error ===
    "ERR_INVENTORY_DISCOUNT_AUTHORIZATION_REQUIRED"
  );
}

export function discountAuthorizationRequiredMessage(err) {
  const msg = err?.response?.data?.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

/** Corpo `discountAuthorization` enviado ao backend (userId vem do token). */
export function buildDiscountAuthorizationBody(reason) {
  return {
    authorize: true,
    reason: String(reason || "").trim() || null,
  };
}
