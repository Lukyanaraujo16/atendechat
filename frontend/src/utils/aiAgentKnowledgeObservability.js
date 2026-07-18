export function extractShadowKnowledge(row) {
  return row?.metadata?.knowledge || row?.knowledge || null;
}

export function shadowKnowledgeSummary(knowledge) {
  if (!knowledge) return null;
  const sourceCount =
    knowledge.sourceCount ??
    (Array.isArray(knowledge.sources) ? knowledge.sources.length : 0);
  const maxScore = knowledge.maxScore ?? null;
  return { sourceCount, maxScore, status: knowledge.status };
}
