import { toast } from "react-toastify";

export const MESSAGE_TOAST_MAX_VISIBLE = 3;
export const MESSAGE_TOAST_AUTO_CLOSE_MS = 7000;
export const MESSAGE_TOAST_AUTO_CLOSE_DISCRETE_MS = 5000;

const toastStack = [];

function pruneStack() {
  while (toastStack.length > MESSAGE_TOAST_MAX_VISIBLE) {
    const oldest = toastStack.shift();
    if (oldest) {
      toast.dismiss(oldest);
    }
  }
}

function removeFromStack(toastId) {
  const idx = toastStack.indexOf(toastId);
  if (idx >= 0) {
    toastStack.splice(idx, 1);
  }
}

export function getTicketMessageToastId(ticket) {
  const key = ticket?.uuid || ticket?.id;
  if (key == null || key === "") return null;
  return `msg-ticket-${key}`;
}

/**
 * Exibe ou atualiza toast de mensagem (máx. 3 visíveis; 1 por ticket).
 */
export function showOrUpdateMessageToast({
  toastId,
  render,
  autoClose = MESSAGE_TOAST_AUTO_CLOSE_MS,
  className,
  onOpen,
}) {
  if (!toastId || typeof render !== "function") {
    return null;
  }

  const options = {
    position: "top-right",
    autoClose,
    hideProgressBar: false,
    closeOnClick: false,
    icon: false,
    className: className || "global-message-toast",
    bodyClassName: "global-message-toast__body",
    progressClassName: "global-message-toast__progress",
    toastId,
    onClose: () => removeFromStack(toastId),
  };

  if (toast.isActive(toastId)) {
    toast.update(toastId, {
      ...options,
      render: ({ closeToast }) => render({ closeToast, onOpen }),
    });
    return toastId;
  }

  pruneStack();
  toast(render, {
    ...options,
    render: ({ closeToast }) => render({ closeToast, onOpen }),
  });
  toastStack.push(toastId);
  return toastId;
}

export function dismissTicketMessageToast(ticket) {
  const toastId = getTicketMessageToastId(ticket);
  if (!toastId) return;
  toast.dismiss(toastId);
  removeFromStack(toastId);
}
