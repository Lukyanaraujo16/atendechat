import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import { financeErrorMessage, isNotFoundRoute } from "./financeFormat";

/**
 * Exibe erro de operação financeira: códigos conhecidos com texto claro,
 * rota indisponível (404 sem código) com aviso amigável, demais via toastError.
 */
export default function showFinanceError(err, fallbackFeature) {
  const known = financeErrorMessage(err);
  if (known) {
    toast.error(known);
    return;
  }
  if (isNotFoundRoute(err)) {
    toast.error(
      `${fallbackFeature || "Este recurso"} ainda não está disponível neste servidor. Tente novamente após a atualização.`
    );
    return;
  }
  toastError(err);
}
