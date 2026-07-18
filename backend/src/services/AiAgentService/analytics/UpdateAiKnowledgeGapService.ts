import AppError from "../../../errors/AppError";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeGap from "../../../models/AiKnowledgeGap";

export type UpdateAiKnowledgeGapAction = "resolve" | "ignore" | "reopen";

export default async function UpdateAiKnowledgeGapService(input: {
  companyId: number;
  id: number;
  action: UpdateAiKnowledgeGapAction;
  documentId?: number | null;
  resolvedBy?: number | null;
}) {
  const gap = await AiKnowledgeGap.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!gap) {
    throw new AppError("ERR_NOT_FOUND", 404, "Knowledge gap não encontrado.");
  }

  const action = String(input.action || "").toLowerCase() as UpdateAiKnowledgeGapAction;

  if (action === "resolve") {
    const documentId = Number(input.documentId);
    if (!Number.isFinite(documentId) || documentId <= 0) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "documentId é obrigatório para resolver o gap."
      );
    }

    const document = await AiKnowledgeDocument.findOne({
      where: { id: documentId, companyId: input.companyId }
    });
    if (!document) {
      throw new AppError(
        "ERR_NOT_FOUND",
        404,
        "Documento não encontrado nesta empresa."
      );
    }

    await gap.update({
      resolved: true,
      resolutionStatus: "resolved",
      resolvedDocumentId: document.id,
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy ?? null
    });
    return gap;
  }

  if (action === "ignore") {
    await gap.update({
      resolved: true,
      resolutionStatus: "ignored",
      resolvedDocumentId: null,
      resolvedAt: new Date(),
      resolvedBy: input.resolvedBy ?? null
    });
    return gap;
  }

  if (action === "reopen") {
    await gap.update({
      resolved: false,
      resolutionStatus: "open",
      resolvedDocumentId: null,
      resolvedAt: null,
      resolvedBy: null
    });
    return gap;
  }

  throw new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "Ação inválida. Use resolve, ignore ou reopen."
  );
}
