/**
 * Payload persistido em CrmSavedViews.filters (v1).
 */

export function buildCrmViewFiltersPayload({
  advancedFilterRows,
  search,
  searchDraft,
  statusFilter,
  assigneeFilter,
  priorityFilter,
  sourceFilter,
  tagFilter,
  tagDraft,
  staleFilter,
  followUpFilter,
  attentionFilter,
}) {
  const s = String(search || searchDraft || "").trim();
  return {
    version: 1,
    advanced: Array.isArray(advancedFilterRows) ? advancedFilterRows : [],
    basic: {
      search: s,
      statusFilter: statusFilter || "",
      assigneeFilter: assigneeFilter || "",
      priorityFilter: priorityFilter || "",
      sourceFilter: sourceFilter || "",
      tagFilter: String(tagFilter || tagDraft || "").trim(),
      staleFilter: staleFilter || "",
      followUpFilter: followUpFilter || "",
      attentionFilter: attentionFilter || "",
    },
  };
}

export function parseCrmViewFiltersPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return emptyApplyResult();
  }
  const b = payload.basic && typeof payload.basic === "object" ? payload.basic : {};
  const rawA = payload.advanced;
  const advanced = Array.isArray(rawA) ? rawA : [];
  return {
    advancedFilterRows: advanced,
    search: b.search != null ? String(b.search) : "",
    statusFilter: b.statusFilter != null ? String(b.statusFilter) : "",
    assigneeFilter: b.assigneeFilter != null ? String(b.assigneeFilter) : "",
    priorityFilter: b.priorityFilter != null ? String(b.priorityFilter) : "",
    sourceFilter: b.sourceFilter != null ? String(b.sourceFilter) : "",
    tagFilter: b.tagFilter != null ? String(b.tagFilter) : "",
    staleFilter: b.staleFilter != null ? String(b.staleFilter) : "",
    followUpFilter: b.followUpFilter != null ? String(b.followUpFilter) : "",
    attentionFilter: b.attentionFilter != null ? String(b.attentionFilter) : "",
  };
}

function emptyApplyResult() {
  return {
    advancedFilterRows: [],
    search: "",
    statusFilter: "",
    assigneeFilter: "",
    priorityFilter: "",
    sourceFilter: "",
    tagFilter: "",
    staleFilter: "",
    followUpFilter: "",
    attentionFilter: "",
  };
}
