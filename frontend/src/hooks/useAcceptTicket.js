import { useCallback, useContext } from "react";
import { useHistory } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  TicketsContext,
  TicketsSetContext,
} from "../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../context/TicketsInboxContext";
import toastError from "../errors/toastError";
import { isGroupTicket } from "../utils/isGroupTicket";

/**
 * Fluxo pós-aceitar: API → estado inbox → aba "Em atendimento" → abrir conversa.
 * Ordem evita abrir ticket ainda pending no estado local.
 */
export function useAcceptTicket() {
  const { user } = useContext(AuthContext);
  const history = useHistory();
  const setCurrentTicket = useContext(TicketsSetContext);
  const ticketsNav = useContext(TicketsContext);
  const inbox = useContext(TicketsInboxContext);

  const completeAcceptTicket = useCallback(
    async (ticket, { sendGreeting } = {}) => {
      if (!ticket?.id) return null;

      if (isGroupTicket(ticket)) {
        const updated = { ...ticket, status: "open", userId: null };
        if (typeof inbox?.upsertTicket === "function") {
          inbox.upsertTicket(updated);
        }
        setCurrentTicket({
          id: updated.id,
          uuid: updated.uuid,
          code: uuidv4(),
        });
        return updated;
      }

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

      // acceptTicketInInbox já agenda reloads; evita corrida com refreshTabCounts zerando contador.

      if (typeof ticketsNav?.setInboxSubTab === "function") {
        ticketsNav.setInboxSubTab("open");
      }

      const targetUuid = updated.uuid || ticket.uuid;
      const acceptCode = uuidv4();

      setCurrentTicket({
        id: updated.id,
        uuid: targetUuid,
        code: acceptCode,
      });

      if (targetUuid) {
        history.push(`/tickets/${targetUuid}`);
      }

      const shouldGreet =
        sendGreeting !== false &&
        !isGroupTicket(ticket) &&
        (await shouldSendGreetingAccepted(updated.whatsappId ?? ticket.whatsappId));

      if (shouldGreet) {
        await sendGreetingMessage(updated.id, user?.name);
      }

      return updated;
    },
    [user?.id, user?.name, inbox, ticketsNav, setCurrentTicket, history]
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
