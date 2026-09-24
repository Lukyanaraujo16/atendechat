/**
 * 12.4-H4 — isolamento de contexto entre ciclos do mesmo ticketId.
 */
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

import { Op } from "sequelize";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import AiAgent from "../../../models/AiAgent";
import { buildAiAgentPromptContext } from "../buildAiAgentPromptContext";
import {
  AI_AGENT_CONTEXT_MAX_CHARS,
  AI_AGENT_CONTEXT_MAX_MESSAGES
} from "../aiAgentShadowConfig";
import { AI_AGENT_HANDOFF_MARKER_IDS } from "../parseAiAgentHandoffSignal";

const mockedFindAll = Message.findAll as jest.Mock;

const CYCLE_1 = new Date("2026-09-23T10:00:00.000Z");
const CYCLE_2 = new Date("2026-09-24T12:00:00.000Z");

function ticket(overrides: Record<string, unknown> = {}): Ticket {
  return {
    id: 11,
    queueId: null,
    status: "pending",
    aiAgentCycleStartedAt: null,
    ...overrides
  } as Ticket;
}

function contact(name = "Lukyan"): Contact {
  return { id: 5, name } as Contact;
}

function agent(): AiAgent {
  return { id: 1, name: "Bot" } as AiAgent;
}

function historyBlock(content: string): string {
  const parts = content.split("--- Histórico recente");
  const after = parts[1] || "";
  return after.split("--- Mensagem atual")[0] || "";
}

function currentBlock(content: string): string {
  return content.split("--- Mensagem atual do cliente ---")[1] || "";
}

function promptContent(
  ctx: Awaited<ReturnType<typeof buildAiAgentPromptContext>>
): string {
  return String(ctx.messages[0].content);
}

describe("buildAiAgentPromptContext — isolamento de ciclo (H4)", () => {
  beforeEach(() => {
    mockedFindAll.mockReset();
  });

  it("1 — current turn não duplica: mesmo messageId some do histórico", async () => {
    mockedFindAll.mockResolvedValue([
      {
        id: "3B51167682B4970392EC",
        body: "oi",
        fromMe: false,
        mediaType: "conversation",
        createdAt: CYCLE_2
      }
    ]);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket(),
      contact: contact(),
      agent: agent(),
      currentInboundText: "oi",
      currentMessageId: "3B51167682B4970392EC"
    });

    const content = promptContent(ctx);
    expect(historyBlock(content)).not.toMatch(/Cliente: oi/);
    expect(historyBlock(content)).toContain("(sem histórico textual recente)");
    expect(currentBlock(content)).toContain("Cliente: oi");
  });

  it("2 — mesmo body, IDs diferentes: só o current some; o antigo permanece", async () => {
    mockedFindAll.mockResolvedValue([
      {
        id: "ID-B",
        body: "oi",
        fromMe: false,
        mediaType: "conversation",
        createdAt: new Date("2026-09-24T12:01:00.000Z")
      },
      {
        id: "ID-A",
        body: "oi",
        fromMe: false,
        mediaType: "conversation",
        createdAt: new Date("2026-09-24T11:00:00.000Z")
      }
    ]);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket(),
      contact: contact(),
      agent: agent(),
      currentInboundText: "oi",
      currentMessageId: "ID-B"
    });

    const content = promptContent(ctx);
    expect(historyBlock(content)).toContain("Cliente: oi");
    expect(currentBlock(content)).toContain("Cliente: oi");
    expect(historyBlock(content).match(/Cliente: oi/g)?.length).toBe(1);
  });

  it.each(AI_AGENT_HANDOFF_MARKER_IDS)(
    "3 — marker [%s] no final é removido; texto útil permanece",
    async markerId => {
      mockedFindAll.mockResolvedValue([
        {
          id: "OUT-1",
          body: `Texto útil.\n\n[${markerId}]`,
          fromMe: true,
          mediaType: "conversation",
          createdAt: CYCLE_2
        }
      ]);

      const ctx = await buildAiAgentPromptContext({
        companyId: 1,
        ticket: ticket(),
        contact: contact(),
        agent: agent(),
        currentInboundText: "oi"
      });

      const content = promptContent(ctx);
      expect(historyBlock(content)).toContain("Atendente: Texto útil.");
      expect(content).not.toContain(`[${markerId}]`);
      expect(content).not.toMatch(/HANDOFF_HUMAN|FIM_HUMANO|FIM_HUMAN/);
    }
  );

  it("4 — ticket finalizado + reopen: intenção de handoff do ciclo 1 não entra no ciclo 2", async () => {
    mockedFindAll.mockResolvedValue([
      {
        id: "3B51167682B4970392EC",
        body: "oi",
        fromMe: false,
        mediaType: "conversation",
        createdAt: CYCLE_2
      },
      {
        id: "OLD-IA",
        body:
          "Entendi, Lukyan. Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas.\n\n[FIM_HUMAN]",
        fromMe: true,
        mediaType: "conversation",
        createdAt: CYCLE_1
      },
      {
        id: "OLD-CLI",
        body: "certo.\nQuero falar com um atendente humano.",
        fromMe: false,
        mediaType: "conversation",
        createdAt: CYCLE_1
      }
    ]);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket({
        status: "pending",
        aiAgentCycleStartedAt: CYCLE_2
      }),
      contact: contact(),
      agent: agent(),
      currentInboundText: "oi",
      currentMessageId: "3B51167682B4970392EC"
    });

    expect(mockedFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ticketId: 11,
          companyId: 1,
          createdAt: { [Op.gte]: CYCLE_2 }
        }
      })
    );

    const content = promptContent(ctx);
    expect(historyBlock(content)).not.toContain("atendente humano");
    expect(historyBlock(content)).not.toContain("Vou encaminhar");
    expect(historyBlock(content)).not.toContain("Cliente: oi");
    expect(content).not.toMatch(/\[HANDOFF_HUMAN\]|\[FIM_HUMANO\]|\[FIM_HUMAN\]/);
    expect(historyBlock(content)).toContain("(sem histórico textual recente)");
    expect(currentBlock(content)).toContain("Cliente: oi");
  });

  it("5 — mesmo ciclo: pergunta A + resposta da IA continuam no histórico", async () => {
    mockedFindAll.mockResolvedValue([
      {
        id: "CUR-B",
        body: "E no sábado?",
        fromMe: false,
        mediaType: "conversation",
        createdAt: new Date("2026-09-24T12:02:00.000Z")
      },
      {
        id: "IA-A",
        body: "Atendemos das 8 às 18.",
        fromMe: true,
        mediaType: "conversation",
        createdAt: new Date("2026-09-24T12:01:00.000Z")
      },
      {
        id: "CLI-A",
        body: "Qual o horário de atendimento?",
        fromMe: false,
        mediaType: "conversation",
        createdAt: new Date("2026-09-24T12:00:30.000Z")
      }
    ]);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket({ aiAgentCycleStartedAt: CYCLE_2 }),
      contact: contact(),
      agent: agent(),
      currentInboundText: "E no sábado?",
      currentMessageId: "CUR-B"
    });

    const content = promptContent(ctx);
    expect(historyBlock(content)).toContain(
      "Cliente: Qual o horário de atendimento?"
    );
    expect(historyBlock(content)).toContain("Atendente: Atendemos das 8 às 18.");
    expect(historyBlock(content)).not.toContain("E no sábado?");
    expect(currentBlock(content)).toContain("Cliente: E no sábado?");
  });

  it("6 — regressão: tetos, mídia/visão e filtros existentes", async () => {
    const longBody = `Pedido detalhado ${"x".repeat(600)}`;
    const rows = [
      {
        id: "VIS-DENY",
        body: "Desculpe, mas não consigo visualizar imagens.",
        fromMe: true,
        mediaType: "conversation",
        createdAt: CYCLE_2
      },
      {
        id: "RX",
        body: "👍",
        fromMe: false,
        mediaType: "reactionMessage",
        createdAt: CYCLE_2
      },
      {
        id: "SYS",
        body: "protocolo interno",
        fromMe: true,
        mediaType: "system",
        createdAt: CYCLE_2
      },
      {
        id: "LONG",
        body: longBody,
        fromMe: false,
        mediaType: "conversation",
        createdAt: CYCLE_2
      },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `FILL-${i}`,
        body: `hist ${i}`,
        fromMe: i % 2 === 0,
        mediaType: "conversation",
        createdAt: CYCLE_2
      }))
    ];
    mockedFindAll.mockResolvedValue(rows);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket({ aiAgentCycleStartedAt: CYCLE_2 }),
      contact: contact("Ana"),
      agent: agent(),
      currentInboundText: "o que é isso?"
    });

    const content = promptContent(ctx);
    expect(ctx.contextMessageCount).toBeLessThanOrEqual(
      AI_AGENT_CONTEXT_MAX_MESSAGES
    );
    expect(content.length).toBeLessThanOrEqual(
      AI_AGENT_CONTEXT_MAX_CHARS + 800
    );
    expect(content).not.toContain("não consigo visualizar imagens");
    expect(content).not.toContain("reaction");
    expect(content).not.toContain("protocolo interno");
    const historyLine = historyBlock(content)
      .split("\n")
      .find(line => line.startsWith("Cliente: Pedido detalhado"));
    expect(historyLine).toBeDefined();
    expect(historyLine!.length).toBeLessThanOrEqual("Cliente: ".length + 500);
    expect(ctx.currentInboundText).toBe("o que é isso?");
  });

  it("ciclo nulo (legado) não aplica cutoff de createdAt", async () => {
    mockedFindAll.mockResolvedValue([]);

    await buildAiAgentPromptContext({
      companyId: 1,
      ticket: ticket({ aiAgentCycleStartedAt: null }),
      contact: contact(),
      agent: agent(),
      currentInboundText: "oi"
    });

    expect(mockedFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: 11, companyId: 1 }
      })
    );
    const where = mockedFindAll.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.createdAt).toBeUndefined();
  });
});
