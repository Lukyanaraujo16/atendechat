import { format } from "date-fns";

const firstToken = (name) => {
  if (!name || typeof name !== "string") return "";
  const t = name.trim();
  if (!t) return "";
  const parts = t.split(/\s+/);
  return parts[0] || "";
};

/**
 * Substitui placeholders em respostas rápidas. Valores ausentes viram string vazia
 * (evita enviar {variável} ao contato). Suporta chaves {nome} e o legado {{name}}.
 *
 * @param {string} text
 * @param {{ contact?: object, user?: object, ticket?: object }} ctx
 * @returns {string}
 */
export const resolveQuickMessageTemplate = (text, ctx) => {
  if (text == null || typeof text !== "string") return "";
  const { contact = {}, user = {}, ticket = {}, greeting: greetingOverride } = ctx || {};
  const contactName = (contact.name && String(contact.name).trim()) || "";
  const firstName = firstToken(contactName);
  const companyName =
    (user.company && user.company.name && String(user.company.name).trim()) || "";
  const agentName = (user.name && String(user.name).trim()) || "";
  const protocol =
    ticket.protocol != null && String(ticket.protocol).trim() !== ""
      ? String(ticket.protocol).trim()
      : ticket.id != null
        ? String(ticket.id)
        : "";
  const hour = format(new Date(), "HH:mm");
  const greeting =
    greetingOverride != null && String(greetingOverride).trim() !== ""
      ? String(greetingOverride).trim()
      : "Olá";

  const replacements = [
    [/\{primeiro_nome\}/g, firstName],
    [/\{\{firstName\}\}/g, firstName],
    [/\{nome\}/g, contactName],
    [/\{\{name\}\}/g, contactName],
    [/\{empresa\}/g, companyName],
    [/\{atendente\}/g, agentName],
    [/\{\{ms\}\}/g, greeting],
    [/\{\{protocol\}\}/g, protocol],
    [/\{\{hora\}\}/g, hour],
  ];

  let out = text;
  for (const [re, val] of replacements) {
    out = out.replace(re, val);
  }
  return out;
};

export default resolveQuickMessageTemplate;
