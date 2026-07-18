import KnowledgeChunkBuilder from "../KnowledgeChunkBuilder";

describe("KnowledgeChunkBuilder", () => {
  it("splits by markdown sections and paragraphs", () => {
    const text = `# Produtos

Parágrafo um sobre produtos.

Parágrafo dois com mais detalhes.

# Preços

Tabela de preços do plano básico.`;
    const chunks = KnowledgeChunkBuilder({
      contentText: text,
      title: "Doc",
      knowledgeBaseId: 1,
      knowledgeDocumentId: 2,
      chunkSize: 200,
      chunkOverlap: 20,
      minChunkSize: 10
    });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some(c => c.sectionTitle === "Produtos")).toBe(true);
    expect(chunks.every(c => c.chunkHash)).toBe(true);
    expect(chunks[0].metadata.chunkingVersion).toBeTruthy();
  });

  it("applies overlap without empty chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Frase número ${i}.`).join(
      " "
    );
    const chunks = KnowledgeChunkBuilder({
      contentText: text,
      title: "Long",
      knowledgeBaseId: 1,
      knowledgeDocumentId: 2,
      chunkSize: 80,
      chunkOverlap: 20,
      minChunkSize: 20
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.content.trim().length > 0)).toBe(true);
  });

  it("keeps short text as single chunk", () => {
    const chunks = KnowledgeChunkBuilder({
      contentText: "Curto",
      title: "T",
      knowledgeBaseId: 1,
      knowledgeDocumentId: 2,
      minChunkSize: 40
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Curto");
  });

  it("returns empty for blank text", () => {
    expect(
      KnowledgeChunkBuilder({
        contentText: "   ",
        knowledgeBaseId: 1,
        knowledgeDocumentId: 2
      })
    ).toEqual([]);
  });

  it("preserves metadata", () => {
    const chunks = KnowledgeChunkBuilder({
      contentText: "Conteúdo útil com tamanho suficiente para chunk.",
      title: "Manual",
      documentType: "manual",
      language: "pt-BR",
      sourceType: "manual",
      sourceUrl: null,
      knowledgeBaseId: 9,
      knowledgeDocumentId: 8
    });
    expect(chunks[0].title).toBe("Manual");
    expect(chunks[0].documentType).toBe("manual");
    expect(chunks[0].language).toBe("pt-BR");
    expect(chunks[0].metadata.knowledgeDocumentId).toBe(8);
  });
});
