import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import InventoryCustomer, {
  InventoryCustomerType
} from "../../models/InventoryCustomer";
import {
  normalizePhoneDigits,
  validateAndNormalizeDocument
} from "./inventoryDocumentHelpers";
import { parseOptionalId, roundMoney, toMoney } from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

export function parseCustomerType(value: unknown): InventoryCustomerType {
  const type = String(value ?? "individual").trim();
  if (type !== "individual" && type !== "company") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Tipo de cliente inválido."
    );
  }
  return type;
}

export function parseCreditLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Limite de crédito inválido."
    );
  }
  return roundMoney(n);
}

export function assertCustomerIdentification(input: {
  name: string | null;
  phone: string | null;
  document: string | null;
}): void {
  if (!input.name) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome do cliente é obrigatório."
    );
  }
}

export type InventoryCustomerBody = {
  type?: unknown;
  name?: unknown;
  tradeName?: unknown;
  document?: unknown;
  phone?: unknown;
  email?: unknown;
  postalCode?: unknown;
  street?: unknown;
  addressNumber?: unknown;
  addressComplement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  notes?: unknown;
  creditLimit?: unknown;
  contactId?: unknown;
  isActive?: unknown;
};

export function parseCustomerFields(
  body: InventoryCustomerBody,
  options: { requireName?: boolean; existingType?: InventoryCustomerType } = {}
): Partial<InventoryCustomer> {
  const patch: Partial<InventoryCustomer> = {};
  const type =
    body.type !== undefined
      ? parseCustomerType(body.type)
      : options.existingType ?? "individual";

  if (body.type !== undefined) patch.type = type;

  if (body.name !== undefined) {
    const name = normalizeOptionalString(body.name);
    if (!name) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Nome do cliente é obrigatório."
      );
    }
    if (name.length > 255) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome muito longo.");
    }
    patch.name = name;
  } else if (options.requireName) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Nome do cliente é obrigatório."
    );
  }

  if (body.tradeName !== undefined) {
    patch.tradeName = normalizeOptionalString(body.tradeName);
  }
  if (body.document !== undefined) {
    patch.document = validateAndNormalizeDocument(body.document, type);
  }
  if (body.phone !== undefined) {
    patch.phone = normalizePhoneDigits(body.phone);
  }
  if (body.email !== undefined) {
    const email = normalizeOptionalString(body.email);
    if (email && email.length > 255) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "E-mail muito longo.");
    }
    patch.email = email;
  }
  if (body.postalCode !== undefined) {
    patch.postalCode = normalizeOptionalString(body.postalCode);
  }
  if (body.street !== undefined) {
    patch.street = normalizeOptionalString(body.street);
  }
  if (body.addressNumber !== undefined) {
    patch.addressNumber = normalizeOptionalString(body.addressNumber);
  }
  if (body.addressComplement !== undefined) {
    patch.addressComplement = normalizeOptionalString(body.addressComplement);
  }
  if (body.district !== undefined) {
    patch.district = normalizeOptionalString(body.district);
  }
  if (body.city !== undefined) {
    patch.city = normalizeOptionalString(body.city);
  }
  if (body.state !== undefined) {
    patch.state = normalizeOptionalString(body.state);
  }
  if (body.notes !== undefined) {
    patch.notes = normalizeOptionalString(body.notes);
  }
  if (body.creditLimit !== undefined) {
    patch.creditLimit = parseCreditLimit(body.creditLimit);
  }
  if (body.contactId !== undefined) {
    patch.contactId = parseOptionalId(body.contactId);
  }
  if (body.isActive !== undefined) {
    patch.isActive =
      body.isActive === true ||
      body.isActive === "true" ||
      body.isActive === 1 ||
      body.isActive === "1";
  }

  return patch;
}

export async function assertContactAvailableForCustomer(input: {
  companyId: number;
  contactId: number | null | undefined;
  excludeCustomerId?: number;
}): Promise<void> {
  if (input.contactId == null) return;

  const contact = await Contact.findOne({
    where: { id: input.contactId, companyId: input.companyId }
  });
  if (!contact) {
    throw new AppError(
      "ERR_INVENTORY_CUSTOMER_CONTACT_NOT_FOUND",
      404,
      "Contact não encontrado nesta empresa."
    );
  }

  const where: any = {
    companyId: input.companyId,
    contactId: input.contactId
  };
  if (input.excludeCustomerId != null) {
    where.id = { [Op.ne]: input.excludeCustomerId };
  }

  const existing = await InventoryCustomer.findOne({ where });
  if (existing) {
    throw new AppError(
      "ERR_INVENTORY_CUSTOMER_CONTACT_IN_USE",
      409,
      "Este Contact já está vinculado a outro Cliente desta empresa."
    );
  }
}

export async function assertDocumentUniqueForCompany(input: {
  companyId: number;
  document: string | null | undefined;
  excludeCustomerId?: number;
}): Promise<void> {
  if (!input.document) return;
  const where: any = {
    companyId: input.companyId,
    document: input.document
  };
  if (input.excludeCustomerId != null) {
    where.id = { [Op.ne]: input.excludeCustomerId };
  }
  const existing = await InventoryCustomer.findOne({ where });
  if (existing) {
    throw new AppError(
      "ERR_INVENTORY_CUSTOMER_DOCUMENT_DUPLICATE",
      409,
      "Já existe um Cliente com este documento nesta empresa."
    );
  }
}

export function customerToJSON(
  customer: InventoryCustomer,
  options: { includeCreditLimit?: boolean } = {}
) {
  const base: Record<string, unknown> = {
    id: customer.id,
    companyId: customer.companyId,
    contactId: customer.contactId,
    type: customer.type,
    name: customer.name,
    tradeName: customer.tradeName,
    document: customer.document,
    phone: customer.phone,
    email: customer.email,
    postalCode: customer.postalCode,
    street: customer.street,
    addressNumber: customer.addressNumber,
    addressComplement: customer.addressComplement,
    district: customer.district,
    city: customer.city,
    state: customer.state,
    notes: customer.notes,
    isActive: customer.isActive === true,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
  if (options.includeCreditLimit !== false) {
    base.creditLimit = roundMoney(toMoney(customer.creditLimit));
  }
  return base;
}
