/**
 * Navegação a partir de `UserNotification.data` (tickets, agenda, cobrança plataforma).
 */
export function navigateFromNotificationData(data, history) {
  const d = data || {};
  const dealIdRaw =
    (d.type === "crm_followup_overdue" ||
      d.type === "crm_deal_needs_attention" ||
      d.type === "crm_automation_rule") &&
    d.dealId != null
      ? String(d.dealId).trim()
      : "";
  if (dealIdRaw) {
    history.push(`/crm?dealId=${encodeURIComponent(dealIdRaw)}`);
    return;
  }
  if (d.type === "appointment" && d.appointmentId != null) {
    const id = String(d.appointmentId).trim();
    if (id) {
      history.push(`/agenda?event=${encodeURIComponent(id)}`);
      return;
    }
    history.push("/agenda");
    return;
  }
  if (d.type === "company_billing" && d.companyId != null) {
    const id = String(d.companyId).trim();
    if (id) {
      history.push(`/saas/companies?focus=${encodeURIComponent(id)}`);
      return;
    }
    history.push("/saas/companies");
    return;
  }
  const uuid = d.ticketUuid != null ? String(d.ticketUuid).trim() : "";
  const tid = d.ticketId != null ? String(d.ticketId).trim() : "";
  const pathId = uuid || tid;
  if (pathId) {
    history.push(`/tickets/${encodeURIComponent(pathId)}`);
  } else {
    history.push("/tickets");
  }
}

export function notificationVisualType(notification) {
  const t = String(notification?.type || "");
  const d = notification?.data || {};
  if (
    t === "crm_followup_overdue" ||
    d.type === "crm_followup_overdue" ||
    t === "crm_deal_needs_attention" ||
    d.type === "crm_deal_needs_attention" ||
    t === "crm_automation_rule" ||
    d.type === "crm_automation_rule"
  ) {
    return "crm";
  }
  if (d.type === "company_billing" || t.startsWith("company_billing")) {
    return "billing";
  }
  if (t.startsWith("appointment_") || d.type === "appointment") {
    return "appointment";
  }
  if (
    t.includes("message") ||
    t.includes("ticket_message") ||
    t === "ticket_message_inbound"
  ) {
    return "message";
  }
  return "ticket";
}
