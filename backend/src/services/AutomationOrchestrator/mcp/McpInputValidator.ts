/**
 * McpInputValidator — valida args contra inputSchema.
 */
export type McpInputValidationResult = {
  valid: boolean;
  status: "VALID" | "INVALID" | "SANITIZED";
  errors: string[];
  warnings: string[];
  sanitizedArguments: Record<string, unknown>;
  schemaHash: string;
};

export function validateMcpInput(input: {
  schema: Record<string, unknown> | null;
  args: Record<string, unknown>;
  schemaHash?: string;
}): McpInputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const schema = input.schema || {};
  const properties = (schema.properties || {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = (schema.required || []) as string[];
  const additional =
    schema.additionalProperties === undefined
      ? true
      : schema.additionalProperties !== false;

  const sanitized: Record<string, unknown> = {};

  for (const key of required) {
    if (input.args[key] === undefined || input.args[key] === null) {
      errors.push(`missing_required:${key}`);
    }
  }

  for (const [key, value] of Object.entries(input.args || {})) {
    if (!properties[key] && !additional) {
      warnings.push(`stripped_extra:${key}`);
      continue;
    }
    const prop = properties[key];
    if (prop?.type === "string" && typeof value !== "string") {
      errors.push(`type_mismatch:${key}:string`);
      continue;
    }
    if (prop?.type === "number" && typeof value !== "number") {
      errors.push(`type_mismatch:${key}:number`);
      continue;
    }
    if (prop?.type === "boolean" && typeof value !== "boolean") {
      errors.push(`type_mismatch:${key}:boolean`);
      continue;
    }
    if (prop?.type === "object" && (typeof value !== "object" || value == null)) {
      errors.push(`type_mismatch:${key}:object`);
      continue;
    }
    sanitized[key] = value;
  }

  const status =
    errors.length > 0
      ? "INVALID"
      : warnings.some(w => w.startsWith("stripped_extra:"))
        ? "SANITIZED"
        : "VALID";

  return {
    valid: errors.length === 0,
    status,
    errors,
    warnings,
    sanitizedArguments: sanitized,
    schemaHash: input.schemaHash || ""
  };
}

export default { validateMcpInput };
