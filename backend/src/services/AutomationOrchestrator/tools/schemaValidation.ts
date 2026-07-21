import {
  ToolInputSchema,
  ToolOutputSchema,
  ToolSchemaField
} from "./contracts/ToolContract";

function typeOfValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateField(
  field: ToolSchemaField,
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (value === undefined || value === null || value === "") {
    if (field.required) {
      errors.push(`missing:${path}`);
    }
    return;
  }

  if (field.type === "any") return;

  const actual = typeOfValue(value);
  if (field.type === "object" && actual !== "object") {
    errors.push(`type:${path}:expected_object`);
    return;
  }
  if (field.type === "array" && actual !== "array") {
    errors.push(`type:${path}:expected_array`);
    return;
  }
  if (
    (field.type === "string" ||
      field.type === "number" ||
      field.type === "boolean") &&
    actual !== field.type
  ) {
    errors.push(`type:${path}:expected_${field.type}`);
    return;
  }

  if (field.enum && field.enum.length > 0) {
    if (!field.enum.includes(value as never)) {
      errors.push(`enum:${path}`);
    }
  }

  if (field.type === "string" && typeof value === "string") {
    if (field.maxLength != null && value.length > field.maxLength) {
      errors.push(`maxLength:${path}`);
    }
  }

  if (field.type === "number" && typeof value === "number") {
    if (field.minimum != null && value < field.minimum) {
      errors.push(`minimum:${path}`);
    }
    if (field.maximum != null && value > field.maximum) {
      errors.push(`maximum:${path}`);
    }
  }

  if (
    field.type === "object" &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    field.properties
  ) {
    const obj = value as Record<string, unknown>;
    for (const child of field.properties) {
      validateField(child, obj[child.name], `${path}.${child.name}`, errors);
    }
  }

  if (field.type === "array" && Array.isArray(value) && field.items) {
    value.forEach((item, i) => {
      validateField(field.items!, item, `${path}[${i}]`, errors);
    });
  }
}

/**
 * Validação declarativa de schema (independente de provider).
 * Yup é usado em formulários de domínio; Tools usam schema serializável
 * para function calling futuro (JSON Schema).
 */
export function validateToolSchema(
  schema: ToolInputSchema | ToolOutputSchema,
  data: Record<string, unknown> | null | undefined,
  kind: "input" | "output" = "input"
): string[] {
  const errors: string[] = [];
  const payload = data && typeof data === "object" ? data : {};

  for (const field of schema.fields || []) {
    validateField(field, payload[field.name], field.name, errors);
  }

  if (schema.additionalProperties === false) {
    const allowed = new Set((schema.fields || []).map(f => f.name));
    for (const key of Object.keys(payload)) {
      if (!allowed.has(key)) {
        errors.push(`additionalProperty:${key}`);
      }
    }
  }

  return errors.map(e => `${kind}:${e}`);
}

/** Conversão neutra → JSON Schema draft-07 simplificado. */
export function toolSchemaToJsonSchema(
  schema: ToolInputSchema | ToolOutputSchema
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  const mapField = (field: ToolSchemaField): Record<string, unknown> => {
    const node: Record<string, unknown> = {
      type: field.type === "any" ? undefined : field.type,
      description: field.description
    };
    if (field.enum) node.enum = field.enum;
    if (field.maxLength != null) node.maxLength = field.maxLength;
    if (field.minimum != null) node.minimum = field.minimum;
    if (field.maximum != null) node.maximum = field.maximum;
    if (field.type === "object" && field.properties) {
      const nestedProps: Record<string, unknown> = {};
      const nestedReq: string[] = [];
      for (const child of field.properties) {
        nestedProps[child.name] = mapField(child);
        if (child.required) nestedReq.push(child.name);
      }
      node.properties = nestedProps;
      if (nestedReq.length) node.required = nestedReq;
      node.additionalProperties = false;
    }
    if (field.type === "array" && field.items) {
      node.items = mapField(field.items);
    }
    if (node.type === undefined) delete node.type;
    return node;
  };

  for (const field of schema.fields || []) {
    properties[field.name] = mapField(field);
    if (field.required) required.push(field.name);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: schema.additionalProperties === true
  };
}
