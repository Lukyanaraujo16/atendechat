/**
 * AI Agent V2.9 — Multi-Agent Runtime tests
 */
import {
  DEFAULT_MULTI_AGENT_CONFIG
} from "../../../../config/automationMultiAgentConstants";
import {
  getMultiAgentConfig,
  setMultiAgentConfig,
  __resetMultiAgentConfigForTests
} from "../MultiAgentConfig";
import { __resetMultiAgentStoreForTests, multiAgentStore } from "../stores/MultiAgentStore";
import { __resetMultiAgentEventsForTests, listMultiAgentEvents } from "../MultiAgentEvents";
import {
  __resetMultiAgentMetricsForTests,
  getMultiAgentMetricsBase
} from "../metrics/MultiAgentMetrics";
import { defaultAgentRegistry } from "../registry/AgentRegistry";
import {
  resolveAgentToolBoundary,
  assertToolAllowed,
  assertMcpAllowed,
  assertCapabilityAllowed
} from "../policies/AgentToolBoundaryResolver";
import { canAccessMemory } from "../context/AgentMemoryAccessResolver";
import {
  composeAgentInstructions,
  buildSpecializedAgentContext,
  sanitizeAgentPayload,
  buildContextBoundary
} from "../context/AgentContextBuilder";
import {
  buildRoutingContext,
  routeAndSelect,
  scoreAgent,
  evaluateAvailability
} from "../selection/AgentSelectionEngine";
import {
  detectDelegationLoop,
  evaluateDelegationPolicy,
  simulateDelegation
} from "../delegation/AgentDelegationService";
import {
  evaluateHandoffPolicy,
  simulateHandoff
} from "../handoff/AgentHandoffService";
import {
  createCoordinationPlan,
  simulateCoordination,
  validateAgentMessage,
  checkAgentHealth,
  evaluateFallbackSafety,
  createHumanIntervention,
  isolateAgentFailure
} from "../coordination/AgentCoordinatorService";
import {
  defaultMultiAgentEngine,
  GetMultiAgentDashboardService,
  ReplayMultiAgentService
} from "../MultiAgentEngine";

function resetAll() {
  __resetMultiAgentStoreForTests();
  __resetMultiAgentConfigForTests();
  __resetMultiAgentEventsForTests();
  __resetMultiAgentMetricsForTests();
}

function registerAgent(companyId: number, body: Record<string, unknown>) {
  return defaultAgentRegistry.register({
    companyId,
    userId: 1,
    body: body as any
  });
}

function seedPair(companyId: number) {
  const a = registerAgent(companyId, {
    name: "Suporte",
    slug: "suporte",
    specialization: "SUPPORT",
    status: "ACTIVE",
    isDefault: true,
    capabilities: ["SEARCH_CONTACT"],
    allowedToolIds: ["tool_search"],
    blockedToolIds: ["tool_write"],
    allowedMcpServerIds: ["mcp_demo"],
    allowedMcpTools: ["search_customer"],
    blockedMcpTools: ["delete_all"]
  });
  const b = registerAgent(companyId, {
    name: "Vendas",
    slug: "vendas",
    specialization: "SALES",
    status: "ACTIVE",
    capabilities: ["SEARCH_CONTACT"],
    allowedToolIds: ["tool_search"],
    allowedMcpServerIds: ["mcp_demo"]
  });
  return { a: a.agent, b: b.agent, va: a.version, vb: b.version };
}

describe("AI Agent V2.9 Multi-Agent Runtime", () => {
  beforeEach(() => resetAll());

  test("1-8 registry: create, slug, version, activate, suspend, archive", () => {
    const { a, va } = seedPair(10);
    expect(a.companyId).toBe(10);
    expect(va.version).toBe(1);
    expect(() =>
      registerAgent(10, { name: "Dup", slug: "suporte", status: "ACTIVE" })
    ).toThrow("ERR_AGENT_SLUG_DUPLICATE");
    const other = registerAgent(11, {
      name: "Dup",
      slug: "suporte",
      status: "ACTIVE"
    });
    expect(other.agent.companyId).toBe(11);
    expect(
      defaultAgentRegistry.setStatus({
        companyId: 10,
        id: a.id,
        status: "ACTIVE"
      }).agent.status
    ).toBe("ACTIVE");
    expect(
      defaultAgentRegistry.setStatus({
        companyId: 10,
        id: a.id,
        status: "SUSPENDED"
      }).agent.status
    ).toBe("SUSPENDED");
    expect(
      defaultAgentRegistry.setStatus({
        companyId: 10,
        id: a.id,
        status: "ARCHIVED"
      }).agent.status
    ).toBe("ARCHIVED");
  });

  test("9-13 boundaries: capability, tool, mcp, memory, learning", () => {
    const { a } = seedPair(20);
    const boundary = resolveAgentToolBoundary({ companyId: 20, agent: a });
    expect(boundary.allowedTools).toContain("tool_search");
    expect(boundary.blockedTools).toContain("tool_write");
    expect(() => assertToolAllowed(boundary, "tool_write")).toThrow(
      "ERR_AGENT_TOOL_NOT_ALLOWED"
    );
    expect(() => assertMcpAllowed(boundary, "mcp_other", "x")).toThrow(
      "ERR_AGENT_MCP_NOT_ALLOWED"
    );
    expect(() => assertCapabilityAllowed(boundary, "UNKNOWN_CAP")).toThrow(
      "ERR_AGENT_CAPABILITY_NOT_ALLOWED"
    );
    expect(
      canAccessMemory({
        policy: a.memoryPolicy,
        scope: "AGENT_PRIVATE",
        memoryType: "EPISODIC",
        isOwnAgent: false,
        requestingAgentId: "other",
        ownerAgentId: a.id
      }).allowed
    ).toBe(false);
    expect(a.learningPolicy.requireHumanApproval).toBe(true);
    expect(a.learningPolicy.metadata.autoPromotion).toBe(false);
  });

  test("14-28 routing/selection strategies and rejects", () => {
    const a = registerAgent(30, {
      name: "Suporte",
      slug: "suporte",
      specialization: "SUPPORT",
      status: "ACTIVE",
      isDefault: true,
      capabilities: ["SEARCH_CONTACT"],
      queueIds: [1],
      whatsappIds: [9],
      language: "pt-BR"
    }).agent;
    const b = registerAgent(30, {
      name: "Vendas",
      slug: "vendas",
      specialization: "SALES",
      status: "ACTIVE",
      capabilities: ["SEARCH_CONTACT"]
    }).agent;
    multiAgentStore(30).putSticky({
      id: "st1",
      companyId: 30,
      scopeType: "contactId",
      scopeId: "55",
      agentId: b.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      lastUsedAt: new Date().toISOString(),
      reason: "test",
      metadata: {}
    });

    expect(
      routeAndSelect({
        companyId: 30,
        body: {
          requestedAgentId: a.id,
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      }).decision.selectedAgentId
    ).toBe(a.id);

    expect(
      routeAndSelect({
        companyId: 30,
        body: {
          contactId: 55,
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      }).decision.selectedAgentId
    ).toBe(b.id);

    expect(
      routeAndSelect({
        companyId: 30,
        body: { queueId: 1, requiredCapabilities: ["SEARCH_CONTACT"] }
      }).decision.selectedAgentId
    ).toBe(a.id);

    expect(
      routeAndSelect({
        companyId: 30,
        body: { whatsappId: 9, requiredCapabilities: ["SEARCH_CONTACT"] }
      }).decision.selectedAgentId
    ).toBe(a.id);

    expect(
      routeAndSelect({
        companyId: 30,
        body: {
          preferredSpecialization: "SALES",
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      }).decision.selectedAgentId
    ).toBe(b.id);

    expect(
      routeAndSelect({
        companyId: 30,
        body: { requiredCapabilities: [] }
      }).decision.selectedAgentId
    ).toBeTruthy();

    defaultAgentRegistry.setStatus({
      companyId: 30,
      id: a.id,
      status: "INACTIVE"
    });
    expect(
      routeAndSelect({
        companyId: 30,
        body: {
          requestedAgentId: a.id,
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      }).decision.selectedAgentId
    ).not.toBe(a.id);

    defaultAgentRegistry.setStatus({
      companyId: 30,
      id: b.id,
      status: "SUSPENDED"
    });
    expect(
      routeAndSelect({
        companyId: 30,
        body: {
          requestedAgentId: b.id,
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      }).decision.selectedAgentId
    ).not.toBe(b.id);

    const noCap = registerAgent(30, {
      name: "Sem Cap",
      slug: "sem-cap",
      status: "ACTIVE",
      capabilities: ["OTHER"]
    }).agent;
    const ctx = buildRoutingContext({
      companyId: 30,
      requiredCapabilities: ["SEARCH_CONTACT"]
    });
    const scored = scoreAgent({
      companyId: 30,
      agent: noCap,
      context: ctx,
      stickyMatch: false,
      availability: evaluateAvailability({ agent: noCap }).state
    });
    expect(typeof scored.score).toBe("number");
  });

  test("29-34 fallback, context, instructions", () => {
    const { a, b } = seedPair(40);
    expect(
      evaluateFallbackSafety({
        companyId: 40,
        preferredAgentId: a.id,
        capability: "SEARCH_CONTACT"
      }).safety
    ).toBe("SAFE");

    expect(
      evaluateFallbackSafety({
        companyId: 40,
        preferredAgentId: a.id,
        capability: "SEARCH_CONTACT",
        writeAmbiguous: true
      }).safety
    ).toBe("UNSAFE");

    defaultAgentRegistry.setStatus({
      companyId: 40,
      id: a.id,
      status: "SUSPENDED"
    });
    defaultAgentRegistry.setStatus({
      companyId: 40,
      id: b.id,
      status: "SUSPENDED"
    });
    expect(
      evaluateFallbackSafety({
        companyId: 40,
        preferredAgentId: a.id,
        capability: "SEARCH_CONTACT"
      }).safety
    ).toBe("NOT_AVAILABLE");

    defaultAgentRegistry.setStatus({
      companyId: 40,
      id: a.id,
      status: "ACTIVE"
    });
    const ctx = buildSpecializedAgentContext({
      companyId: 40,
      agent: a,
      goalContext: "help",
      userInput: "token=abc password=1"
    });
    expect(ctx.instructions).toContain("SYSTEM_SECURITY");
    expect(ctx.instructions).not.toMatch(/password=1/);
    const composed = composeAgentInstructions({
      agent: a,
      userInput: "api_key=secret"
    });
    expect(composed.sanitized).toContain("[redacted-line]");
    expect(composed.layers[0]).toContain("SYSTEM_SECURITY");
  });

  test("35-50 delegation, loops, boundary, child session, result", async () => {
    const { a, b } = seedPair(50);
    const parent = (
      await defaultMultiAgentEngine.startSimulatedSession({
        companyId: 50,
        routingBody: {
          requestedAgentId: a.id,
          requiredCapabilities: ["SEARCH_CONTACT"]
        }
      })
    ).session;

    const preview = evaluateDelegationPolicy({
      companyId: 50,
      request: {
        id: "p1",
        companyId: 50,
        sourceAgentId: a.id,
        sourceSessionId: parent.sessionId,
        rootSessionId: parent.rootSessionId,
        requestedTargetAgentId: b.id,
        requiredSpecialization: "SALES",
        requiredCapabilities: ["SEARCH_CONTACT"],
        goal: "g",
        task: "t",
        expectedOutput: "o",
        contextReferences: [],
        allowedContextScopes: ["EXECUTION_SCOPED"],
        forbiddenContextScopes: ["AGENT_PRIVATE"],
        priority: 1,
        deadline: null,
        maxDepth: 2,
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
        metadata: {}
      },
      parentSession: parent,
      approved: false
    });
    expect(preview.executionMode).toMatch(/SIMULATION|CONFIRMATION|SHADOW/);

    expect(
      evaluateDelegationPolicy({
        companyId: 50,
        request: {
          id: "p2",
          companyId: 50,
          sourceAgentId: a.id,
          sourceSessionId: parent.sessionId,
          rootSessionId: parent.rootSessionId,
          requestedTargetAgentId: a.id,
          requiredSpecialization: null,
          requiredCapabilities: [],
          goal: "g",
          task: "t",
          expectedOutput: "o",
          contextReferences: [],
          allowedContextScopes: [],
          forbiddenContextScopes: [],
          priority: 1,
          deadline: null,
          maxDepth: 2,
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        parentSession: parent
      }).approved
    ).toBe(false);

    expect(
      detectDelegationLoop({
        sourceAgentId: "A",
        targetAgentId: "A",
        chain: [],
        task: "t",
        previousTasks: []
      })
    ).toBe("LOOP_DETECTED");
    expect(
      detectDelegationLoop({
        sourceAgentId: "A",
        targetAgentId: "B",
        chain: ["A", "B"],
        task: "t",
        previousTasks: []
      })
    ).toBe("LOOP_DETECTED");
    expect(
      detectDelegationLoop({
        sourceAgentId: "A",
        targetAgentId: "C",
        chain: ["A", "B"],
        task: "same",
        previousTasks: ["same", "same"]
      })
    ).toBe("POSSIBLE_LOOP");

    setMultiAgentConfig(50, { maxDelegationDepth: 0 });
    expect(
      evaluateDelegationPolicy({
        companyId: 50,
        request: {
          id: "p3",
          companyId: 50,
          sourceAgentId: a.id,
          sourceSessionId: parent.sessionId,
          rootSessionId: parent.rootSessionId,
          requestedTargetAgentId: b.id,
          requiredSpecialization: null,
          requiredCapabilities: ["SEARCH_CONTACT"],
          goal: "g",
          task: "t",
          expectedOutput: "o",
          contextReferences: [],
          allowedContextScopes: [],
          forbiddenContextScopes: [],
          priority: 1,
          deadline: null,
          maxDepth: 5,
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        parentSession: { ...parent, delegationDepth: 0 }
      }).reasonCodes
    ).toContain("ERR_AGENT_DELEGATION_DEPTH_EXCEEDED");

    setMultiAgentConfig(50, { ...DEFAULT_MULTI_AGENT_CONFIG });
    const boundary = buildContextBoundary({
      companyId: 50,
      sourceAgentId: a.id,
      targetAgentId: b.id,
      sourceSessionId: parent.sessionId,
      sharingLevel: "MINIMAL",
      task: "hello",
      extra: { token: "secret", password: "x", note: "ok" }
    });
    expect(boundary.sensitiveFieldsRemoved.length).toBeGreaterThan(0);
    expect(sanitizeAgentPayload({ api_key: "k", ok: 1 }).removed).toContain(
      "api_key"
    );

    expect(
      canAccessMemory({
        policy: a.memoryPolicy,
        scope: "AGENT_PRIVATE",
        memoryType: "EPISODIC",
        isOwnAgent: false,
        requestingAgentId: b.id,
        ownerAgentId: a.id
      }).allowed
    ).toBe(false);

    const sim = await simulateDelegation({
      companyId: 50,
      approved: true,
      parentSession: parent,
      persistKnowledge: true,
      request: {
        sourceAgentId: a.id,
        sourceSessionId: parent.sessionId,
        rootSessionId: parent.rootSessionId,
        requestedTargetAgentId: b.id,
        requiredSpecialization: "SALES",
        requiredCapabilities: ["SEARCH_CONTACT"],
        goal: "Help",
        task: "Search",
        expectedOutput: "summary",
        contextReferences: [],
        allowedContextScopes: ["EXECUTION_SCOPED"],
        forbiddenContextScopes: ["AGENT_PRIVATE"],
        priority: 1,
        deadline: null,
        maxDepth: 2,
        requiresConfirmation: true,
        metadata: {}
      }
    });
    expect(sim.childSession).toBeTruthy();
    expect(sim.result).toBeTruthy();
    expect(sim.decision.approved).toBe(true);
    expect(getMultiAgentConfig(50).liveIntegrationEnabled).toBe(false);
  });

  test("51-65 handoff, coordinator, messages, health, intervention", () => {
    const { a, b } = seedPair(60);
    const coordAgent = registerAgent(60, {
      name: "Coord",
      slug: "coord",
      role: "COORDINATOR",
      status: "ACTIVE",
      isCoordinator: true,
      capabilities: ["SEARCH_CONTACT"]
    }).agent;

    expect(
      evaluateHandoffPolicy({
        companyId: 60,
        request: {
          id: "h1",
          companyId: 60,
          sourceAgentId: a.id,
          sourceSessionId: "s1",
          requestedTargetAgentId: b.id,
          reason: "need sales",
          reasonCode: "SPECIALIST",
          goal: "g",
          handoffType: "CONTEXTUAL_HANDOFF",
          contextSharingLevel: "TASK_ONLY",
          preserveStickyAssignment: true,
          requiresHumanApproval: true,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        approved: false
      }).approved
    ).toBe(false);

    const handoff = simulateHandoff({
      companyId: 60,
      approved: true,
      body: {
        sourceAgentId: a.id,
        sourceSessionId: "s1",
        requestedTargetAgentId: b.id,
        reason: "need sales",
        reasonCode: "SPECIALIST",
        goal: "g",
        handoffType: "CONTEXTUAL_HANDOFF",
        contextSharingLevel: "TASK_ONLY",
        preserveStickyAssignment: true,
        requiresHumanApproval: true,
        metadata: {}
      }
    });
    expect(handoff.result?.targetAgentId).toBe(b.id);

    setMultiAgentConfig(60, { maxHandoffsPerSession: 0 });
    expect(
      evaluateHandoffPolicy({
        companyId: 60,
        request: {
          id: "h2",
          companyId: 60,
          sourceAgentId: a.id,
          sourceSessionId: "s1",
          requestedTargetAgentId: b.id,
          reason: "x",
          reasonCode: "x",
          goal: "",
          handoffType: "FULL_HANDOFF",
          contextSharingLevel: "TASK_ONLY",
          preserveStickyAssignment: false,
          requiresHumanApproval: true,
          createdAt: new Date().toISOString(),
          metadata: {}
        },
        approved: true,
        handoffCount: 1
      }).approved
    ).toBe(false);
    setMultiAgentConfig(60, { ...DEFAULT_MULTI_AGENT_CONFIG });

    const plan = createCoordinationPlan({
      companyId: 60,
      coordinatorAgentId: coordAgent.id,
      rootGoalId: "g1",
      tasks: [
        {
          title: "T1",
          requiredCapabilities: ["SEARCH_CONTACT"],
          preferredSpecialization: "SUPPORT"
        },
        {
          title: "T2",
          requiredCapabilities: ["SEARCH_CONTACT"],
          preferredSpecialization: "SALES",
          dependencies: ["dep"]
        }
      ]
    });
    expect(plan.tasks.length).toBe(2);
    expect(
      simulateCoordination({ companyId: 60, planId: plan.id }).plan
    ).toBeTruthy();

    expect(
      validateAgentMessage({
        companyId: 60,
        message: {
          sourceAgentId: a.id,
          targetAgentId: b.id,
          messageType: "TASK_REQUEST",
          payload: { task: "x" },
          requiresResponse: true
        }
      }).valid
    ).toBe(true);

    expect(
      validateAgentMessage({
        companyId: 60,
        message: {
          sourceAgentId: a.id,
          targetAgentId: b.id,
          messageType: "UNKNOWN" as any,
          payload: {}
        }
      }).valid
    ).toBe(false);

    expect(
      validateAgentMessage({
        companyId: 60,
        message: {
          sourceAgentId: a.id,
          targetAgentId: b.id,
          messageType: "STATUS_UPDATE",
          payload: { status: "ok" },
          expiresAt: new Date(Date.now() - 1000).toISOString()
        }
      }).valid
    ).toBe(false);

    expect(
      ["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"].includes(
        checkAgentHealth({ companyId: 60, agentId: a.id }).status
      )
    ).toBe(true);

    expect(
      createHumanIntervention({
        companyId: 60,
        sessionId: "s1",
        agentId: a.id,
        reason: "conflict",
        severity: "HIGH",
        requestedAction: "REVIEW"
      }).status
    ).toBe("OPEN");

    expect(
      isolateAgentFailure({
        companyId: 60,
        agentId: a.id,
        sessionId: "s1",
        reason: "timeout"
      }).isolated
    ).toBe(true);
  });

  test("66-85 idempotency, metrics, events, replay, flags, tenant, live", async () => {
    const { a, b } = seedPair(70);
    const d1 = routeAndSelect({
      companyId: 70,
      body: {
        id: "fixed-ctx",
        requestedAgentId: a.id,
        requiredCapabilities: ["SEARCH_CONTACT"]
      }
    });
    const d2 = routeAndSelect({
      companyId: 70,
      body: {
        id: "fixed-ctx",
        requestedAgentId: a.id,
        requiredCapabilities: ["SEARCH_CONTACT"]
      }
    });
    expect(d1.decision.id).toBe(d2.decision.id);

    const flow = await defaultMultiAgentEngine.runFullSimulationFlow({
      companyId: 70,
      routingBody: {
        requestedAgentId: a.id,
        requiredCapabilities: ["SEARCH_CONTACT"]
      }
    });
    expect(flow.sharedKernel).toBe(true);
    expect(flow.liveIntegrationEnabled).toBe(false);

    const dash = await GetMultiAgentDashboardService({ companyId: 70 });
    expect(dash.agents).toBeGreaterThanOrEqual(2);
    expect(dash.liveIntegrationEnabled).toBe(false);
    expect(dash.duplicatesPlanner).toBe(false);
    expect(dash.duplicatesRuntime).toBe(false);

    expect(getMultiAgentMetricsBase().routingRequests).toBeGreaterThan(0);
    expect(listMultiAgentEvents(70).length).toBeGreaterThan(0);

    const replay = await ReplayMultiAgentService({
      companyId: 70,
      id: flow.decision.id
    });
    expect(replay.replay.selectionDecision).toBeTruthy();
    expect(replay.replay.liveIntegrationEnabled).toBe(false);

    const cfg = setMultiAgentConfig(70, {
      liveIntegrationEnabled: true as any,
      continuousAutonomyEnabled: true as any
    });
    expect(cfg.liveIntegrationEnabled).toBe(false);
    expect(cfg.continuousAutonomyEnabled).toBe(false);
    expect(cfg.delegationSimulationOnly).toBe(true);

    expect(defaultAgentRegistry.getById(71, a.id)).toBeNull();
    expect(multiAgentStore(71).listAgents().length).toBe(0);

    const boundary = resolveAgentToolBoundary({ companyId: 70, agent: a });
    expect(() => assertToolAllowed(boundary, "tool_write")).toThrow();
    expect(() => assertMcpAllowed(boundary, "mcp_x", "y")).toThrow();

    expect(
      canAccessMemory({
        policy: a.memoryPolicy,
        scope: "AGENT_PRIVATE",
        memoryType: "EPISODIC",
        isOwnAgent: false,
        requestingAgentId: b.id,
        ownerAgentId: a.id
      }).allowed
    ).toBe(false);

    expect(a.learningPolicy.requireHumanApproval).toBe(true);
  });

  test("86-90 shared kernel invariants + package isolation", () => {
    expect(DEFAULT_MULTI_AGENT_CONFIG.liveIntegrationEnabled).toBe(false);
    expect(DEFAULT_MULTI_AGENT_CONFIG.coordinatorSimulationOnly).toBe(true);
    expect(DEFAULT_MULTI_AGENT_CONFIG.delegationSimulationOnly).toBe(true);
    expect(DEFAULT_MULTI_AGENT_CONFIG.handoffSimulationOnly).toBe(true);
    expect(DEFAULT_MULTI_AGENT_CONFIG.usesGenerativeAiForSelection).toBe(false);
    expect(DEFAULT_MULTI_AGENT_CONFIG.continuousAutonomyEnabled).toBe(false);

    const fs = require("fs");
    const path = require("path");
    const cognitiveDir = path.join(__dirname, "../../cognitive");
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, acc);
        else if (/\.(ts|js)$/.test(f)) acc.push(p);
      }
      return acc;
    };
    const offenders = walk(cognitiveDir).filter((f: string) =>
      /multiAgent/.test(fs.readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
