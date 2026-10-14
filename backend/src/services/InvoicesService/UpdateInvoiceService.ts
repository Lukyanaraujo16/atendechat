import AppError from "../../errors/AppError";
import Invoice from "../../models/Invoices";

interface InvoiceData {
  status: string;
  id?: number | string;
  companyId: number;
}

/**
 * Atualização genérica de status por tenant.
 * Não permite marcar como paid/cancelled — use comandos Super Admin.
 */
const UpdateInvoiceService = async (InvoiceData: InvoiceData): Promise<Invoice> => {
  const { id, status, companyId } = InvoiceData;

  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "cancelled") {
    throw new AppError(
      "ERR_INVOICE_STATUS_FORBIDDEN",
      403,
      "Marcação de pago/cancelado apenas via operações autorizadas do Super Admin ou gateway."
    );
  }

  const invoice = await Invoice.findOne({
    where: {
      id,
      companyId
    }
  });

  if (!invoice) {
    throw new AppError("ERR_NO_PLAN_FOUND", 404);
  }

  await invoice.update({
    status
  });

  return invoice;
};

export default UpdateInvoiceService;
