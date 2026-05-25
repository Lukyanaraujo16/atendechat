import { useCallback, useContext } from "react";
import { v4 as uuidv4 } from "uuid";

import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  TicketsContext,
  TicketsSetContext,
} from "../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../context/TicketsInboxContext";
import toastError from "../errors/toastError";

/**
 * Fluxo pós-aceitar: API → estado inbox → aba "Em atendimento" → abrir conversa.
 * Ordem evita abrir ticket ainda pending no estado local.
 */
export function useAcceptTicket() {
  const { user } = useContext(AuthContext);
  const setCurrentTicket = useContext(TicketsSetContext);
  const ticketsNav = useContext(TicketsContext);
  const inbox = useContext(TicketsInboxContext);

  const completeAcceptTicket = useCallback(
    async (ticket, { sendGreeting } = {}) => {
      if (!ticket?.id) return null;

      const { data } = await api.put(`/tickets/${ticket.id}`, {
        status: "open",
        userId: user?.id,
      });

      const updated = {
        ...ticket,
        ...(data && typeof data === "object" ? data : {}),
        status: "open",
        userId: user?.id,
      };

      if (typeof inbox?.acceptTicketInInbox === "function") {
        inbox.acceptTicketInInbox(updated);
      } else if (typeof inbox?.upsertTicket === "function") {
        inbox.upsertTicket(updated);
      }

      if (typeof inbox?.scheduleReloadPendingList === "function") {
        inbox.scheduleReloadPendingList();
      }

      if (typeof inbox?.scheduleReloadOpenList === "function") {
        inbox.scheduleReloadOpenList();
      }

      if (typeof inbox?.refreshTabCounts === "function") {
        inbox.refreshTabCounts();
      }

      if (typeof ticketsNav?.setInboxSubTab === "function") {
        ticketsNav.setInboxSubTab("open");
      }

      setCurrentTicket({
        id: updated.id,
        uuid: updated.uuid,
        code: uuidv4(),
      });

      const shouldGreet =
        sendGreeting !== false &&
        !ticket.isGroup &&
        (await shouldSendGreetingAccepted(updated.whatsappId ?? ticket.whatsappId));

      if (shouldGreet) {
        await sendGreetingMessage(updated.id, user?.name);
      }

      return updated;
    },
    [user?.id, user?.name, inbox, ticketsNav, setCurrentTicket]
  );

  return { completeAcceptTicket };
}

async function shouldSendGreetingAccepted(whatsappId) {
  const resolvedWhatsappId = Number(whatsappId);
  if (Number.isFinite(resolvedWhatsappId) && resolvedWhatsappId > 0) {
    try {
      const { data } = await api.get(
        `/whatsapps/${resolvedWhatsappId}/settings-behavior`
      );
      return data?.sendGreetingAccepted === "enabled";
    } catch {
      // fallback global abaixo
    }
  }
  try {
    const { data } = await api.get("/settings");
    const settingIndex = Array.isArray(data)
      ? data.filter((s) => s.key === "sendGreetingAccepted")
      : [];
    return settingIndex[0]?.value === "enabled";
  } catch {
    return false;
  }
}

async function sendGreetingMessage(ticketId, userName) {
  const msg = `{{ms}} *{{name}}*, meu nome é *${userName}* e agora vou prosseguir com seu atendimento!`;
  const message = {
    read: 1,
    fromMe: true,
    mediaUrl: "",
    body: `*Mensagem Automática:*\n${msg.trim()}`,
  };
  try {
    await api.post(`/messages/${ticketId}`, message);
  } catch (err) {
    toastError(err);
  }
}
