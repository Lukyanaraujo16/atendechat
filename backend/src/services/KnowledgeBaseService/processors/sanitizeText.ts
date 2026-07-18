/**
 * Sanitização de texto extraído para uso futuro em chunking/RAG.
 * Remove lixo estrutural sem alterar o significado do conteúdo.
 */
export function sanitizeKnowledgeText(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // Remover BOM e normalizar newlines
  text = text.replace(/^\uFEFF/, "");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remover scripts/styles/HTML residual óbvio
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<\/?[^>]+>/g, " ");

  // Caracteres invisíveis / zero-width
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  // Control chars excepto tab/newline
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Normalizar espaços em cada linha
  text = text
    .split("\n")
    .map(line => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n");

  // Colapsar linhas vazias excessivas (máx. 2 consecutivas)
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Converte markdown simples em texto preservando títulos como linhas.
 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return "";
  let text = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Code fences → conteúdo interno
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Imagens / links
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Títulos: manter texto do heading
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Ênfase
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/~~(.*?)~~/g, "$1");

  // Listas
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // Blockquotes / hr
  text = text.replace(/^\s*>\s?/gm, "");
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "");

  return sanitizeKnowledgeText(text);
}
