/** Substitui {{tag}} por valores; tags desconhecidas ficam vazias. */
const TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function escapeHtmlForEmail(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailTemplate(
  template: string,
  variables: Record<string, string>,
  options: { escapeValues: boolean }
): string {
  const esc = options.escapeValues ? escapeHtmlForEmail : (s: string) => String(s ?? "");
  return String(template ?? "").replace(TAG_RE, (_match, key: string) => {
    const raw = variables[key] != null ? String(variables[key]) : "";
    return esc(raw);
  });
}

/** Heurística simples: corpo já tem marcação HTML. */
export function emailBodyLooksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(String(body ?? ""));
}

export function plainTextToSimpleHtml(text: string): string {
  const lines = String(text ?? "").split("\n");
  const parts = lines.map((line) => {
    const escaped = escapeHtmlForEmail(line);
    return escaped === "" ? "<br/>" : `<p style="margin:0 0 0.75em 0;">${escaped}</p>`;
  });
  return `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;">${parts.join(
    ""
  )}</div>`;
}

export function htmlToPlainTextForAlt(html: string): string {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function composeTemplatedEmailBodies(
  bodyTpl: string,
  vars: Record<string, string>
): { html: string; text: string } {
  const htmlBody = emailBodyLooksLikeHtml(bodyTpl)
    ? renderEmailTemplate(bodyTpl, vars, { escapeValues: true })
    : plainTextToSimpleHtml(
        renderEmailTemplate(bodyTpl, vars, { escapeValues: true })
      );
  const textBody = emailBodyLooksLikeHtml(bodyTpl)
    ? htmlToPlainTextForAlt(htmlBody)
    : renderEmailTemplate(bodyTpl, vars, { escapeValues: false });
  return { html: htmlBody, text: textBody };
}
