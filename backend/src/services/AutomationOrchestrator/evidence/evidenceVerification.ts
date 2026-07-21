import {
  EvidenceFinding,
  ShadowEvaluationEvidenceInput,
  ToolResolutionFact,
  collectResolutions,
  extractFactualValues,
  isEmptyModelResult,
  replyIndicatesNotFound,
  valueAppearsInReply
} from "./evidenceTypes";

/**
 * Verificação objetiva Tool → Resposta.
 * Sem IA, sem CoT.
 */
export function evaluateToolEvidence(
  evaluation: ShadowEvaluationEvidenceInput
): EvidenceFinding[] {
  const reply = String(evaluation.shadowReply || "");
  const resolutions = collectResolutions(evaluation);
  const findings: EvidenceFinding[] = [];

  if (!resolutions.length) {
    if (!evaluation.usedTools && (evaluation.toolCallCount || 0) === 0) {
      findings.push({
        type: "NO_TOOL_NEEDED",
        justification:
          "Nenhuma Tool chamada nesta avaliação Shadow (observacional).",
        facts: {}
      });
    }
    return findings;
  }

  const toolValueSets: Array<{ toolId: string; values: string[] }> = [];

  for (const res of resolutions) {
    findings.push(...evaluateSingleResolution(res, reply));
    const values = extractFactualValues(res.modelResult);
    if (values.length && !isEmptyModelResult(res.modelResult)) {
      toolValueSets.push({ toolId: res.toolId, values });
    }
  }

  if (toolValueSets.length >= 2) {
    findings.push(...evaluateMultiToolConsistency(toolValueSets));
  }

  return findings;
}

function evaluateSingleResolution(
  res: ToolResolutionFact,
  reply: string
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];
  const status = res.status;
  const mr = res.modelResult;

  if (status === "denied") {
    findings.push({
      type: "INVALID_TOOL_SELECTION",
      toolId: res.toolId,
      justification: `Tool ${res.toolId} negada pela policy/allowlist.`,
      facts: {}
    });
    return findings;
  }

  if (status === "failure" || status === "invalid") {
    findings.push({
      type: "INVALID_TOOL_SELECTION",
      toolId: res.toolId,
      justification: `Tool ${res.toolId} falhou ou argumentos inválidos.`,
      facts: {}
    });
    return findings;
  }

  if (isEmptyModelResult(mr)) {
    findings.push({
      type: "EMPTY_RESULT",
      toolId: res.toolId,
      justification: replyIndicatesNotFound(reply)
        ? `Tool ${res.toolId} retornou vazio e a resposta indicou ausência de dados.`
        : `Tool ${res.toolId} retornou vazio.`,
      facts: {}
    });
    return findings;
  }

  const values = extractFactualValues(mr);
  if (!values.length) {
    // Sucesso sem fatos extraíveis — não marca VERIFIED
    findings.push({
      type: "PARTIALLY_VERIFIED",
      toolId: res.toolId,
      justification: `Tool ${res.toolId} retornou dados sem fatos escalares extraíveis.`,
      facts: {}
    });
    return findings;
  }

  const matched = values.filter(v => valueAppearsInReply(v, reply));
  const missing = values.filter(v => !valueAppearsInReply(v, reply));

  if (matched.length === values.length) {
    findings.push({
      type: "VERIFIED",
      toolId: res.toolId,
      justification: `Resposta contém todos os fatos extraídos de ${res.toolId}.`,
      facts: {
        extractedValues: values,
        matchedInReply: matched,
        missingInReply: []
      }
    });
    return findings;
  }

  if (matched.length > 0) {
    findings.push({
      type: "PARTIALLY_VERIFIED",
      toolId: res.toolId,
      justification: `Resposta utilizou ${matched.length}/${values.length} fatos de ${res.toolId}.`,
      facts: {
        extractedValues: values,
        matchedInReply: matched,
        missingInReply: missing
      }
    });
    return findings;
  }

  // Dados encontrados, resposta não usa — e pode contradizer
  if (replyIndicatesNotFound(reply)) {
    findings.push({
      type: "HALLUCINATION_AFTER_TOOL",
      toolId: res.toolId,
      justification: `Tool ${res.toolId} retornou dados, mas a resposta negou a existência.`,
      facts: {
        extractedValues: values,
        matchedInReply: [],
        missingInReply: values
      }
    });
    return findings;
  }

  // Resposta sem os fatos e sem negar — TOOL_UNUSED
  findings.push({
    type: "TOOL_UNUSED",
    toolId: res.toolId,
    justification: `Tool ${res.toolId} retornou dados que a resposta ignorou.`,
    facts: {
      extractedValues: values,
      matchedInReply: [],
      missingInReply: values
    }
  });

  // Se a resposta contém um valor "parecido" contraditório (ex.: outro telefone)
  const replyPhones: string[] = reply.match(/\+?\d[\d\s().-]{7,}\d/g) || [];
  const toolPhones = values.filter(v => v.replace(/\D/g, "").length >= 8);
  if (replyPhones.length && toolPhones.length) {
    const toolDigitSet = new Set(
      toolPhones.map(v => v.replace(/\D/g, ""))
    );
    const contradictory = replyPhones.some((p: string) => {
      const d = p.replace(/\D/g, "");
      return (
        d.length >= 8 &&
        ![...toolDigitSet].some(td => td.includes(d) || d.includes(td))
      );
    });
    if (contradictory) {
      findings.push({
        type: "HALLUCINATION_AFTER_TOOL",
        toolId: res.toolId,
        justification: `Resposta contém telefone diferente do retornado por ${res.toolId}.`,
        facts: {
          extractedValues: toolPhones,
          matchedInReply: [],
          missingInReply: toolPhones
        }
      });
    }
  }

  return findings;
}

function evaluateMultiToolConsistency(
  sets: Array<{ toolId: string; values: string[] }>
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];
  const allValues = sets.flatMap(s => s.values.map(v => v.toLowerCase()));
  const unique = new Set(allValues);
  // Consistência fraca: overlap entre pares
  let overlaps = 0;
  let conflicts = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = new Set(sets[i].values.map(v => v.toLowerCase()));
      const b = new Set(sets[j].values.map(v => v.toLowerCase()));
      let inter = 0;
      for (const x of a) if (b.has(x)) inter += 1;
      if (inter > 0) overlaps += 1;
      // Conflito: ambos têm telefone e digitos distintos
      const aPhones = [...a].filter(v => v.replace(/\D/g, "").length >= 8);
      const bPhones = [...b].filter(v => v.replace(/\D/g, "").length >= 8);
      if (aPhones.length && bPhones.length) {
        const same = aPhones.some(ap =>
          bPhones.some(
            bp =>
              ap.replace(/\D/g, "") === bp.replace(/\D/g, "") ||
              ap.replace(/\D/g, "").includes(bp.replace(/\D/g, "")) ||
              bp.replace(/\D/g, "").includes(ap.replace(/\D/g, ""))
          )
        );
        if (!same) conflicts += 1;
      }
    }
  }

  if (conflicts > 0) {
    findings.push({
      type: "CONFLICTING_TOOL_RESULTS",
      justification: `${conflicts} par(es) de Tools com fatos incompatíveis.`,
      facts: { extractedValues: [...unique].slice(0, 20) }
    });
  } else if (overlaps > 0) {
    findings.push({
      type: "MULTIPLE_TOOL_CONSISTENCY",
      justification: `${overlaps} par(es) de Tools com fatos compatíveis.`,
      facts: { extractedValues: [...unique].slice(0, 20) }
    });
  }

  return findings;
}

export default { evaluateToolEvidence };
