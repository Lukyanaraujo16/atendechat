import AppError from "../../../errors/AppError";
import AiAgentExecutionReplay from "../../../models/AiAgentExecutionReplay";

export type PromptDiffLine = {
  type: "same" | "add" | "remove";
  text: string;
};

function extractPrompt(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const prompt =
    snapshot.prompt ??
    snapshot.systemPrompt ??
    snapshot.finalPrompt ??
    snapshot.messages;
  if (typeof prompt === "string") return prompt;
  if (Array.isArray(prompt)) {
    return prompt
      .map(m => {
        if (typeof m === "string") return m;
        if (m && typeof m === "object" && "content" in (m as object)) {
          return String((m as { content?: unknown }).content ?? "");
        }
        return JSON.stringify(m);
      })
      .join("\n");
  }
  return "";
}

function extractContextChunkIds(
  snapshot: Record<string, unknown> | null | undefined
): number[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const ctx =
    snapshot.context ??
    snapshot.knowledgeContext ??
    snapshot.sources ??
    snapshot.chunks;
  if (!Array.isArray(ctx)) return [];
  const ids: number[] = [];
  for (const item of ctx) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = Number(row.chunkId ?? row.id);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}

/** Diff linha a linha simples (LCS aproximado por varredura linear). */
export function lineDiff(a: string, b: string): PromptDiffLine[] {
  const linesA = String(a || "").split("\n");
  const linesB = String(b || "").split("\n");
  const result: PromptDiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < linesA.length && j < linesB.length) {
    if (linesA[i] === linesB[j]) {
      result.push({ type: "same", text: linesA[i] });
      i += 1;
      j += 1;
      continue;
    }

    const lookAheadB = linesB.indexOf(linesA[i], j);
    const lookAheadA = linesA.indexOf(linesB[j], i);

    if (
      lookAheadB !== -1 &&
      (lookAheadA === -1 || lookAheadB - j <= lookAheadA - i)
    ) {
      while (j < lookAheadB) {
        result.push({ type: "add", text: linesB[j] });
        j += 1;
      }
    } else if (lookAheadA !== -1) {
      while (i < lookAheadA) {
        result.push({ type: "remove", text: linesA[i] });
        i += 1;
      }
    } else {
      result.push({ type: "remove", text: linesA[i] });
      result.push({ type: "add", text: linesB[j] });
      i += 1;
      j += 1;
    }
  }

  while (i < linesA.length) {
    result.push({ type: "remove", text: linesA[i] });
    i += 1;
  }
  while (j < linesB.length) {
    result.push({ type: "add", text: linesB[j] });
    j += 1;
  }

  return result;
}

export default async function CompareAiAgentPromptDiffService(input: {
  companyId: number;
  replayIdA: number;
  replayIdB: number;
}) {
  const [replayA, replayB] = await Promise.all([
    AiAgentExecutionReplay.findOne({
      where: { id: input.replayIdA, companyId: input.companyId }
    }),
    AiAgentExecutionReplay.findOne({
      where: { id: input.replayIdB, companyId: input.companyId }
    })
  ]);

  if (!replayA || !replayB) {
    throw new AppError(
      "ERR_NOT_FOUND",
      404,
      "Um ou ambos os replays não foram encontrados nesta empresa."
    );
  }

  const promptA = extractPrompt(replayA.snapshot);
  const promptB = extractPrompt(replayB.snapshot);
  const chunksA = new Set(extractContextChunkIds(replayA.snapshot));
  const chunksB = new Set(extractContextChunkIds(replayB.snapshot));

  const onlyInA = [...chunksA].filter(id => !chunksB.has(id));
  const onlyInB = [...chunksB].filter(id => !chunksA.has(id));
  const shared = [...chunksA].filter(id => chunksB.has(id));

  return {
    replayIdA: replayA.id,
    replayIdB: replayB.id,
    promptA,
    promptB,
    promptDiff: lineDiff(promptA, promptB),
    contextDiff: {
      chunkIdsOnlyA: onlyInA,
      chunkIdsOnlyB: onlyInB,
      chunkIdsShared: shared,
      summary: `${onlyInA.length} só em A, ${onlyInB.length} só em B, ${shared.length} compartilhados`
    },
    responseA: replayA.responsePreview,
    responseB: replayB.responsePreview,
    decisionA: replayA.decision,
    decisionB: replayB.decision
  };
}
