import { UniqueConstraintError } from "sequelize";
import AppError from "../../errors/AppError";

/**
 * Converte violação de UNIQUE em Queues (companyId+name / companyId+color) em AppError estável.
 */
export const rethrowIfQueueUniqueConstraint = (err: unknown): void => {
  if (!(err instanceof UniqueConstraintError)) {
    throw err;
  }

  const parent = err.parent as { constraint?: string } | undefined;
  const constraint = parent?.constraint || "";

  if (
    constraint === "Queues_companyId_name_key" ||
    err.errors?.some((e) => e.path === "name")
  ) {
    throw new AppError(
      "ERR_QUEUE_DUPLICATE_NAME",
      409,
      "Já existe um setor com este nome nesta empresa."
    );
  }

  if (
    constraint === "Queues_companyId_color_key" ||
    err.errors?.some((e) => e.path === "color")
  ) {
    throw new AppError(
      "ERR_QUEUE_COLOR_ALREADY_EXISTS",
      409,
      "Esta cor já está em uso nesta empresa. Escolha outra."
    );
  }

  throw new AppError("ERR_QUEUE_DUPLICATE", 409);
};
