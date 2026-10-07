/**
 * Helpers de endereço para etapa Entrega (snapshot da venda).
 * Não altera Contact.
 */

export function emptyDeliveryAddress() {
  return {
    recipientName: "",
    recipientPhone: "",
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    notes: "",
  };
}

export function addressFromContact(contact) {
  if (!contact) return emptyDeliveryAddress();
  return {
    recipientName: contact.name || "",
    recipientPhone: contact.number || "",
    postalCode: contact.postalCode || "",
    street: contact.street || "",
    number: contact.addressNumber || "",
    complement: contact.addressComplement || "",
    district: contact.district || "",
    city: contact.city || "",
    state: (contact.state || "").toUpperCase(),
    notes: "",
  };
}

export function addressFromSaleDelivery(delivery, contactFallback) {
  if (!delivery) {
    return contactFallback
      ? addressFromContact(contactFallback)
      : emptyDeliveryAddress();
  }
  return {
    recipientName: delivery.recipientName || contactFallback?.name || "",
    recipientPhone: delivery.recipientPhone || contactFallback?.number || "",
    postalCode: delivery.postalCode || "",
    street: delivery.street || "",
    number: delivery.number || "",
    complement: delivery.complement || "",
    district: delivery.district || "",
    city: delivery.city || "",
    state: (delivery.state || "").toUpperCase(),
    notes: delivery.notes || "",
  };
}

/** Campos obrigatórios para requiresAddress (CEP/complemento opcionais). */
export function requiredDeliveryAddressErrors(address) {
  const errors = {};
  const req = [
    ["recipientName", "recipientName"],
    ["recipientPhone", "recipientPhone"],
    ["street", "street"],
    ["number", "number"],
    ["district", "district"],
    ["city", "city"],
    ["state", "state"],
  ];
  for (const [key] of req) {
    const v = String(address?.[key] ?? "").trim();
    if (!v) errors[key] = true;
  }
  if (address?.state && String(address.state).trim().length !== 2) {
    errors.state = true;
  }
  return errors;
}

export function isContactAddressComplete(contact) {
  if (!contact) return false;
  const a = addressFromContact(contact);
  return Object.keys(requiredDeliveryAddressErrors(a)).length === 0;
}

export function formatAddressOneLine(address) {
  if (!address) return "";
  const line1 = [address.street, address.number].filter(Boolean).join(", ");
  const line2 = [address.district, [address.city, address.state].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(" — ");
  return [line1, line2].filter(Boolean).join("\n");
}

export function getSaleDeliverySnapshot(sale) {
  return sale?.delivery || sale?.InventorySaleDelivery || null;
}

export function moneyNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}
