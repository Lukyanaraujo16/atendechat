import { useContext, useEffect, useRef, useState } from "react";
import { SocketContext } from "../../context/Socket/SocketContext";

export const INBOUND_TICKET_PRESENCE_TTL_MS = 6000;

export default function useInboundTicketPresence({ ticketId }) {
  const socketManager = useContext(SocketContext);
  const [presence, setPresence] = useState(null);
  const timerRef = useRef(null);
  const ticketIdRef = useRef(ticketId);
  const mountedRef = useRef(true);

  const clearTimer = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPresence = () => {
    clearTimer();
    if (mountedRef.current) {
      setPresence(null);
    }
  };

  const applyPresence = (next) => {
    if (next !== "composing" && next !== "recording" && next !== "paused") {
      return;
    }
    if (next === "paused") {
      clearPresence();
      return;
    }
    if (!mountedRef.current) {
      return;
    }
    setPresence(next);
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setPresence(null);
      }
      timerRef.current = null;
    }, INBOUND_TICKET_PRESENCE_TTL_MS);
  };

  useEffect(() => {
    mountedRef.current = true;
    ticketIdRef.current = ticketId;
    clearPresence();
    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!socketManager || !companyId || !ticketId) {
      return undefined;
    }
    const socket = socketManager.getSocket(companyId);
    const eventName = `company-${companyId}-ticketPresence`;

    const onPresence = (payload) => {
      if (!payload || Number(payload.ticketId) !== Number(ticketIdRef.current)) {
        return;
      }
      applyPresence(payload.presence);
    };

    const onDrop = () => {
      clearPresence();
    };

    socket.on(eventName, onPresence);
    // disconnect limpa indicador preso; reconnect futuro chega por novo webhook.
    socket.on("disconnect", onDrop);

    return () => {
      socket.off(eventName, onPresence);
      socket.off("disconnect", onDrop);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketManager, ticketId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, []);

  return presence;
}
