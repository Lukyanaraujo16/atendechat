/**
 * Fase 2.1F — Evidence Engine
 */
import { buildEvidenceReport } from "../AutomationEvidenceEngine";
import {
  extractFactualValues,
  valueAppearsInReply,
  isEmptyModelResult
} from "../evidenceTypes";
import { evaluateToolEvidence } from "../evidenceVerification";
import { evaluateKnowledgeEvidence } from "../evidenceKnowledge";
import { computeReadinessScore } from "../EvidenceReadinessEngine";
import { DEFAULT_EVIDENCE_THRESHOLDS } from "../../../../config/automationEvidenceConstants";
import { buildEvidenceRecommendations } from "../evidenceRecommendations";
import { decideRolloutAptitude } from "../RolloutDecisionService";
import {
  __resetEvidenceMetricsForTests,
  getEvidenceMetricsSnapshot,
  recordEvidenceReport
} from "../EvidenceMetrics";

function thresholds() {
  return JSON.parse(JSON.stringify(DEFAULT_EVIDENCE_THRESHOLDS));
}

describe("Evidence Engine 2.1F", () => {
  beforeEach(() => {
    __resetEvidenceMetricsForTests();
  });

  it("extrai fatos e faz match na resposta", () => {
    const values = extractFactualValues({
      status: "success",
      tool: "contact.read",
      item: { name: "João", phone: "11999887766" }
    });
    expect(values.some(v => v.includes("11999887766") || v === "João")).toBe(
      true
    );
    expect(
      valueAppearsInReply("11999887766", "O telefone é (11) 99988-7766")
    ).toBe(true);
  });

  it("VERIFIED quando resposta usa dado da Tool", () => {
    const report = buildEvidenceReport({
      id: 1,
      companyId: 1,
      shadowReply: "O telefone do João é 11999887766.",
      toolCallCount: 1,
      usedTools: true,
      trace: {
        iterations: [
          {
            index: 0,
            resolutions: [
              {
                toolId: "contact.read",
                status: "success",
                modelResult: {
                  status: "success",
                  tool: "contact.read",
                  item: { phone: "11999887766", name: "João" }
                }
              }
            ]
          }
        ]
      }
    });
    expect(report.scores.verified).toBe(true);
    expect(report.primaryType).toBe("VERIFIED");
  });

  it("HALLUCINATION_AFTER_TOOL quando nega dado existente", () => {
    const findings = evaluateToolEvidence({
      id: 2,
      companyId: 1,
      shadowReply: "Não encontrei o telefone desse contato.",
      toolCallCount: 1,
      usedTools: true,
      trace: {
        iterations: [
          {
            resolutions: [
              {
                toolId: "contact.read",
                status: "success",
                modelResult: {
                  status: "success",
                  tool: "contact.read",
                  item: { phone: "11999887766" }
                }
              }
            ]
          }
        ]
      }
    });
    expect(findings.some(f => f.type === "HALLUCINATION_AFTER_TOOL")).toBe(
      true
    );
  });

  it("EMPTY_RESULT quando tool vazia", () => {
    expect(
      isEmptyModelResult({
        status: "empty",
        tool: "contact.search",
        items: []
      })
    ).toBe(true);
    const findings = evaluateToolEvidence({
      id: 3,
      companyId: 1,
      shadowReply: "Não encontrei resultados.",
      toolCallCount: 1,
      trace: {
        iterations: [
          {
            resolutions: [
              {
                toolId: "contact.search",
                status: "success",
                modelResult: {
                  status: "empty",
                  tool: "contact.search",
                  items: []
                }
              }
            ]
          }
        ]
      }
    });
    expect(findings.some(f => f.type === "EMPTY_RESULT")).toBe(true);
  });

  it("Knowledge VERIFIED / UNUSED", () => {
    const verified = evaluateKnowledgeEvidence({
      id: 4,
      companyId: 1,
      shadowReply: "Conforme o manual, o prazo de entrega é 5 dias úteis.",
      knowledgeMeta: {
        knowledge: {
          chunks: [
            {
              id: "c1",
              text: "O prazo de entrega é 5 dias úteis para a região Sudeste."
            }
          ]
        }
      }
    });
    expect(verified.some(f => f.type === "KNOWLEDGE_VERIFIED")).toBe(true);

    const unused = evaluateKnowledgeEvidence({
      id: 5,
      companyId: 1,
      shadowReply: "Olá, como posso ajudar?",
      knowledgeMeta: {
        knowledge: {
          chunks: [{ id: "c2", text: "Política de reembolso em até 7 dias." }]
        }
      }
    });
    expect(unused.some(f => f.type === "KNOWLEDGE_UNUSED")).toBe(true);
  });

  it("TOOL_UNUSED quando ignora dados", () => {
    const findings = evaluateToolEvidence({
      id: 6,
      companyId: 1,
      shadowReply: "Posso ajudar com outra coisa?",
      toolCallCount: 1,
      trace: {
        iterations: [
          {
            resolutions: [
              {
                toolId: "queue.list",
                status: "success",
                modelResult: {
                  status: "success",
                  tool: "queue.list",
                  items: [{ name: "Suporte" }, { name: "Vendas" }]
                }
              }
            ]
          }
        ]
      }
    });
    expect(findings.some(f => f.type === "TOOL_UNUSED")).toBe(true);
  });

  it("Readiness e recommendations determinísticos", () => {
    const rates = {
      verificationRate: 0.8,
      toolUtilizationRate: 0.7,
      hallucinationRate: 0.02,
      knowledgeUtilizationRate: 0.5,
      selectionAccuracy: 0.9,
      averageToolCalls: 1.2,
      averageLatency: 900,
      averageCost: 0.001,
      averageTokens: 200,
      toolFailureRate: 0.05,
      toolDeniedRate: 0.02,
      loopStopRate: 0.03,
      sampleCount: 20
    };
    const readiness = computeReadinessScore(rates, thresholds());
    expect(readiness.score).toBeGreaterThan(0.5);
    expect(["LIMITED", "READY", "PRODUCTION", "EXPERIMENTAL"]).toContain(
      readiness.level
    );

    const recs = buildEvidenceRecommendations({
      rates: { ...rates, hallucinationRate: 0.2 },
      typeCounts: { EMPTY_RESULT: 5 },
      toolStats: [
        {
          toolId: "contact.search",
          usage: 0,
          verified: 0,
          empty: 0,
          failures: 0,
          neverUsed: true
        }
      ],
      providerStats: [
        {
          provider: "gemini",
          samples: 5,
          verificationRate: 0.7,
          averageCost: 0.0001,
          averageLatency: 500,
          hallucinationRate: 0.05
        },
        {
          provider: "openai",
          samples: 5,
          verificationRate: 0.6,
          averageCost: 0.002,
          averageLatency: 800,
          hallucinationRate: 0.08
        }
      ]
    });
    expect(recs.some(r => r.code === "HIGH_HALLUCINATION")).toBe(true);
    expect(recs.some(r => r.code === "TOOL_NEVER_USED")).toBe(true);
    expect(recs.some(r => r.code === "PROVIDER_LOWER_COST")).toBe(true);
  });

  it("RolloutDecision nunca habilita Live", () => {
    const decision = decideRolloutAptitude({
      companyId: 1,
      rates: {
        verificationRate: 0.9,
        toolUtilizationRate: 0.8,
        hallucinationRate: 0.01,
        knowledgeUtilizationRate: 0.6,
        selectionAccuracy: 1,
        averageToolCalls: 1,
        averageLatency: 500,
        averageCost: 0.001,
        averageTokens: 100,
        toolFailureRate: 0.01,
        toolDeniedRate: 0,
        loopStopRate: 0,
        sampleCount: 50
      },
      readiness: { score: 0.9, level: "PRODUCTION", reasons: [] },
      thresholds: thresholds()
    });
    expect(decision.liveFunctionCallingEnabled).toBe(false);
    expect(decision.reasons.some(r => /desabilitado/i.test(r))).toBe(true);
  });

  it("métricas e scores por provider/agent/connection", () => {
    recordEvidenceReport({
      companyId: 9,
      aiAgentId: 2,
      whatsappId: 3,
      provider: "openai",
      primaryType: "VERIFIED",
      verified: true,
      hallucination: false,
      knowledgeVerified: true,
      knowledgeUnused: false,
      emptyResult: false,
      toolUnused: false,
      toolCallCount: 2,
      latencyMs: 400,
      tokens: 80,
      costUsd: 0.0002,
      findings: [
        {
          type: "VERIFIED",
          toolId: "contact.read",
          justification: "ok",
          facts: {}
        }
      ]
    });
    const snap = getEvidenceMetricsSnapshot(9);
    expect(snap.sampleCount).toBe(1);
    expect(snap.verificationRate).toBe(1);
    expect(snap.providers[0].provider).toBe("openai");
    expect(snap.agents[0].aiAgentId).toBe(2);
    expect(snap.connections[0].whatsappId).toBe(3);
    expect(snap.tools[0].toolId).toBe("contact.read");
  });
});
