import { Op } from "sequelize";
import AiAgent from "../../models/AiAgent";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../../models/AiAgentSuggestionReview";
import Ticket from "../../models/Ticket";
import {
  buildShadowSuggestionWhere,
  getShadowListLimit,
  parseShadowPage,
  ShadowSuggestionListFilters
} from "./shadowSuggestionFilters";
import { serializeShadowSuggestionRow } from "./serializeShadowSuggestion";

export default async function ListAiAgentShadowSuggestionsService(
  input: ShadowSuggestionListFilters
) {
  const page = parseShadowPage(input.pageNumber);
  const limit = getShadowListLimit();
  const offset = limit * (page - 1);
  const where = buildShadowSuggestionWhere(input);

  const { count, rows } = await AiAgentRuntimeLog.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: AiAgent,
        attributes: ["id", "name"],
        required: false
      },
      {
        model: Ticket,
        attributes: ["id", "uuid"],
        required: false
      }
    ]
  });

  const logIds = rows.map((row) => row.id);
  const reviews =
    logIds.length > 0
      ? await AiAgentSuggestionReview.findAll({
          where: {
            companyId: input.companyId,
            aiAgentRuntimeLogId: { [Op.in]: logIds }
          }
        })
      : [];
  const reviewByLogId = new Map(
    reviews.map((review) => [review.aiAgentRuntimeLogId, review])
  );

  const records = rows.map((row) =>
    serializeShadowSuggestionRow({
      log: row,
      aiAgent: row.aiAgent,
      ticket: row.ticket,
      review: reviewByLogId.get(row.id) ?? null
    })
  );

  return {
    records,
    count,
    hasMore: count > offset + rows.length,
    page,
    limit
  };
}
