import AppError from "../../../errors/AppError";

const INTERNAL_LEAK_RE =
  /sequelize|sql|stack|ENOENT|EACCES|password|token|api[_-]?key|\/Users\/|\/home\/|node_modules/i;

/**
 * Normaliza erros para resposta segura (sem stack/SQL/paths).
 */
export function toSafeAgentOsError(err: unknown): AppError {
  if (err instanceof AppError) {
    const msg = err.clientMessage || err.message;
    if (INTERNAL_LEAK_RE.test(msg)) {
      return new AppError(err.message, err.statusCode, "Operação não permitida");
    }
    return err;
  }
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.startsWith("ERR_")) {
    const code = raw.split(":")[0];
    return new AppError(code, 400, code);
  }
  return new AppError("ERR_INTERNAL", 500, "Erro interno");
}

export function safePublicErrorBody(err: AppError): {
  error: string;
  message?: string;
} {
  return {
    error: err.message,
    ...(err.clientMessage && !INTERNAL_LEAK_RE.test(err.clientMessage)
      ? { message: err.clientMessage }
      : {})
  };
}
