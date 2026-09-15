import { useCallback, useEffect, useRef } from "react";
import {
  HUMAN_WHATSAPP_TYPING,
  isEligibleForHumanWhatsAppTypingPresence,
  sendHumanTicketPresence,
} from "./humanWhatsAppTypingPresence";

function defaultClock() {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
}

export default function useHumanWhatsAppTypingPresence({
  ticketId,
  ticket,
  ticketStatus,
  enabled = true,
  clock,
}) {
  const clockRef = useRef(clock || defaultClock());
  clockRef.current = clock || clockRef.current;

  const ticketIdRef = useRef(ticketId);
  const lastSentRef = useRef(null);
  const lastComposingAtRef = useRef(0);
  const idleTimerRef = useRef(null);
  const eligibleRef = useRef(false);

  const isEligible = isEligibleForHumanWhatsAppTypingPresence({
    ticketId,
    ticket,
    ticketStatus,
    enabled,
  });
  eligibleRef.current = isEligible;

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current != null) {
      clockRef.current.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const postPresence = useCallback((id, presence) => {
    if (id == null || id === "") return;
    lastSentRef.current = { ticketId: id, presence };
    try {
      const pending = sendHumanTicketPresence(id, presence);
      if (pending && typeof pending.catch === "function") {
        pending.catch(() => null);
      }
    } catch {
      // presence é best-effort: nunca quebrar o composer
    }
  }, []);

  const pauseTicket = useCallback(
    (id) => {
      clearIdleTimer();
      if (id == null || id === "") return;
      const last = lastSentRef.current;
      if (last?.ticketId === id && last?.presence === "composing") {
        postPresence(id, "paused");
      }
    },
    [clearIdleTimer, postPresence]
  );

  const pauseNow = useCallback(() => {
    pauseTicket(ticketIdRef.current);
  }, [pauseTicket]);

  const notifyTyping = useCallback(
    (text) => {
      if (!eligibleRef.current) return;
      const id = ticketIdRef.current;
      if (id == null || id === "") return;
      const value = String(text || "");
      if (!value) {
        pauseTicket(id);
        return;
      }
      const now = clockRef.current.now();
      const last = lastSentRef.current;
      const shouldSendComposing =
        last?.ticketId !== id ||
        last?.presence !== "composing" ||
        now - lastComposingAtRef.current >=
          HUMAN_WHATSAPP_TYPING.composingThrottleMs;
      if (shouldSendComposing) {
        lastComposingAtRef.current = now;
        postPresence(id, "composing");
      }
      clearIdleTimer();
      idleTimerRef.current = clockRef.current.setTimeout(() => {
        pauseTicket(id);
      }, HUMAN_WHATSAPP_TYPING.idlePauseMs);
    },
    [clearIdleTimer, pauseTicket, postPresence]
  );

  useEffect(() => {
    const previous = ticketIdRef.current;
    if (previous != null && previous !== ticketId) {
      pauseTicket(previous);
      lastComposingAtRef.current = 0;
    }
    ticketIdRef.current = ticketId;
  }, [ticketId, pauseTicket]);

  useEffect(() => {
    if (!isEligible) {
      pauseNow();
    }
  }, [isEligible, pauseNow]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current != null) {
        clockRef.current.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      const id = ticketIdRef.current;
      const last = lastSentRef.current;
      if (last?.ticketId === id && last?.presence === "composing") {
        try {
          const pending = sendHumanTicketPresence(id, "paused");
          if (pending && typeof pending.catch === "function") {
            pending.catch(() => null);
          }
        } catch {
          // unmount best-effort
        }
      }
    };
  }, []);

  return { notifyTyping, pauseNow, isEligible };
}
