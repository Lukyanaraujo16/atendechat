import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../helpers/whatsappUnavailablePresence";
import { WhatsAppOutbound } from "../../modules/whatsapp/outbound/WhatsAppOutbound";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import { AI_AGENT_PACING } from "./calculateAiAgentResponsePacing";

export type AiAgentTypingPresenceHandle = {
  executionId: string;
  started: boolean;
  stop: (reason?: string) => Promise<void>;
};

export type StartAiAgentTypingPresenceInput = {
  ticket: Ticket;
  whatsapp: Whatsapp;
  contact?: Contact | null;
  companyId: number;
  agentId?: number | null;
  executionId: string;
  /** Intervalo de renovação; default da política. */
  renewIntervalMs?: number;
  /** Duração máxima de composing; default da política. */
  maxDurationMs?: number;
  /** Injetável nos testes (evita timers reais). */
  timers?: {
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
};

type PresenceSession = {
  stopped: boolean;
  renewTimer: NodeJS.Timeout | null;
  maxTimer: NodeJS.Timeout | null;
  jid: string | null;
  outbound: WhatsAppOutbound | null;
};

/**
 * Métricas sanitizadas de typing/pacing — sem texto, prompt ou secrets.
 */
export function emitAiAgentTypingMetric(
  event:
    | "ai_agent.typing_started"
    | "ai_agent.typing_renewed"
    | "ai_agent.typing_stopped"
    | "ai_agent.typing_failed"
    | "ai_agent.pacing_calculated"
    | "ai_agent.pacing_wait_completed"
    | "ai_agent.pacing_cancelled",
  fields: Record<string, unknown>
): void {
  try {
    logger.info(
      {
        event,
        companyId: fields.companyId ?? null,
        ticketId: fields.ticketId ?? null,
        agentId: fields.agentId ?? null,
        whatsappId: fields.whatsappId ?? null,
        executionId: fields.executionId
          ? String(fields.executionId).slice(0, 64)
          : null,
        processingDurationMs: fields.processingDurationMs ?? null,
        targetDurationMs: fields.targetDurationMs ?? null,
        remainingDelayMs: fields.remainingDelayMs ?? null,
        responseLengthBucket: fields.responseLengthBucket ?? null,
        reason: fields.reason ?? null,
        result: fields.result ?? null
      },
      `[AiAgent][typing] ${event}`
    );
  } catch {
    // nunca derrubar runtime
  }
}

async function resolveChatJid(
  ticket: Ticket,
  contact?: Contact | null
): Promise<string | null> {
  let chatJid = await getTicketRemoteJid(ticket);
  if (!chatJid) {
    const c =
      contact ||
      (await Contact.findOne({
        where: { id: ticket.contactId, companyId: ticket.companyId }
      }));
    if (c) {
      const dest = String(c.number || "").replace(/\D/g, "");
      if (dest) {
        chatJid = ticket.isGroup ? `${dest}@g.us` : `${dest}@s.whatsapp.net`;
      }
    }
  }
  if (!chatJid) return null;
  return chatJid.includes("@") ? jidNormalizedUser(chatJid) : chatJid;
}

async function sendPresenceSafe(
  outbound: WhatsAppOutbound,
  jid: string,
  presence: "composing" | "paused",
  meta: {
    companyId: number;
    ticketId: number;
    agentId?: number | null;
    whatsappId?: number | null;
    executionId: string;
  }
): Promise<boolean> {
  try {
    const sent = await outbound.sendPresence({
      jid,
      presence,
      subscribe: presence === "composing"
    });
    return sent;
  } catch (err) {
    emitAiAgentTypingMetric("ai_agent.typing_failed", {
      companyId: meta.companyId,
      ticketId: meta.ticketId,
      agentId: meta.agentId,
      whatsappId: meta.whatsappId,
      executionId: meta.executionId,
      reason: presence === "composing" ? "compose_failed" : "pause_failed",
      result: String((err as Error)?.message || err || "presence_error").slice(
        0,
        80
      )
    });
    return false;
  }
}

/**
 * Inicia composing no WhatsApp do ticket e renova até stop().
 * Falha ao iniciar NÃO bloqueia a resposta (melhoria de UX).
 * Sempre use try/finally com typing.stop().
 */
export async function startAiAgentTypingPresence(
  input: StartAiAgentTypingPresenceInput
): Promise<AiAgentTypingPresenceHandle> {
  const session: PresenceSession = {
    stopped: false,
    renewTimer: null,
    maxTimer: null,
    jid: null,
    outbound: null
  };

  const stop = async (reason = "completed"): Promise<void> => {
    if (session.stopped) return;
    session.stopped = true;
    const clearIntervalFn = input.timers?.clearInterval || clearInterval;
    const clearTimeoutFn = input.timers?.clearTimeout || clearTimeout;
    if (session.renewTimer) {
      clearIntervalFn(session.renewTimer);
      session.renewTimer = null;
    }
    if (session.maxTimer) {
      clearTimeoutFn(session.maxTimer);
      session.maxTimer = null;
    }

    if (
      session.outbound &&
      session.jid &&
      !isWhatsAppDisableAllReadAndPresenceSideEffects()
    ) {
      await sendPresenceSafe(session.outbound, session.jid, "paused", {
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.agentId,
        whatsappId: input.whatsapp?.id,
        executionId: input.executionId
      });
    }

    emitAiAgentTypingMetric("ai_agent.typing_stopped", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp?.id,
      executionId: input.executionId,
      reason,
      result: "ok"
    });
  };

  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    emitAiAgentTypingMetric("ai_agent.typing_failed", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp?.id,
      executionId: input.executionId,
      reason: "presence_suppressed",
      result: "skipped"
    });
    return { executionId: input.executionId, started: false, stop };
  }

  // Isolamento: ticket.whatsappId deve bater com a conexão do agente
  if (
    input.whatsapp?.id != null &&
    input.ticket.whatsappId != null &&
    Number(input.ticket.whatsappId) !== Number(input.whatsapp.id)
  ) {
    emitAiAgentTypingMetric("ai_agent.typing_failed", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp.id,
      executionId: input.executionId,
      reason: "whatsapp_mismatch",
      result: "skipped"
    });
    return { executionId: input.executionId, started: false, stop };
  }

  try {
    // Lazy: evita carregar libs/wbot no import graph de Shadow/Simulator.
    const { default: GetTicketWbot } = await import(
      "../../helpers/GetTicketWbot"
    );
    const { wrapBaileysSession } = await import(
      "../../modules/whatsapp/outbound/resolveWhatsAppOutbound"
    );
    const wbot = await GetTicketWbot(input.ticket);
    const outbound = wrapBaileysSession(wbot);
    const jid = await resolveChatJid(input.ticket, input.contact);
    if (!jid) {
      emitAiAgentTypingMetric("ai_agent.typing_failed", {
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.agentId,
        whatsappId: input.whatsapp?.id,
        executionId: input.executionId,
        reason: "jid_missing",
        result: "skipped"
      });
      return { executionId: input.executionId, started: false, stop };
    }

    session.outbound = outbound;
    session.jid = jid;

    const ok = await sendPresenceSafe(outbound, jid, "composing", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp?.id,
      executionId: input.executionId
    });

    if (!ok) {
      return { executionId: input.executionId, started: false, stop };
    }

    emitAiAgentTypingMetric("ai_agent.typing_started", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp?.id,
      executionId: input.executionId,
      result: "ok"
    });

    const renewMs =
      input.renewIntervalMs ?? AI_AGENT_PACING.typingRenewIntervalMs;
    const maxMs = input.maxDurationMs ?? AI_AGENT_PACING.typingMaxDurationMs;
    const setIntervalFn = input.timers?.setInterval || setInterval;
    const setTimeoutFn = input.timers?.setTimeout || setTimeout;

    session.renewTimer = setIntervalFn(() => {
      if (session.stopped || !session.outbound || !session.jid) return;
      sendPresenceSafe(session.outbound, session.jid, "composing", {
        companyId: input.companyId,
        ticketId: input.ticket.id,
        agentId: input.agentId,
        whatsappId: input.whatsapp?.id,
        executionId: input.executionId
      })
        .then(renewed => {
          if (renewed) {
            emitAiAgentTypingMetric("ai_agent.typing_renewed", {
              companyId: input.companyId,
              ticketId: input.ticket.id,
              agentId: input.agentId,
              whatsappId: input.whatsapp?.id,
              executionId: input.executionId,
              result: "ok"
            });
          }
        })
        .catch(() => undefined);
    }, renewMs);
    // Não manter o process vivo só por typing
    if (typeof session.renewTimer.unref === "function") {
      session.renewTimer.unref();
    }

    session.maxTimer = setTimeoutFn(() => {
      stop("max_duration").catch(() => undefined);
    }, maxMs);
    if (typeof session.maxTimer.unref === "function") {
      session.maxTimer.unref();
    }

    return { executionId: input.executionId, started: true, stop };
  } catch (err) {
    emitAiAgentTypingMetric("ai_agent.typing_failed", {
      companyId: input.companyId,
      ticketId: input.ticket.id,
      agentId: input.agentId,
      whatsappId: input.whatsapp?.id,
      executionId: input.executionId,
      reason: "start_failed",
      result: String((err as Error)?.message || err || "start_error").slice(
        0,
        80
      )
    });
    return { executionId: input.executionId, started: false, stop };
  }
}

export default startAiAgentTypingPresence;
