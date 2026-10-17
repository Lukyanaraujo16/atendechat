import {
  formatBrl,
  formatDate,
  maskBrDate,
  parseBrDate,
  maskBrl,
  parseBrl,
  numberToBrlInput,
  parseCompetence,
  recurrenceLabel,
  syncInfo,
  toCents,
  toDateOnly,
  financeErrorMessage,
  isNotFoundRoute,
  eventLabel,
  reconKindLabel,
  formatPaidDate,
  formatPaidAt,
  sourceLabel,
} from "../financeFormat";

const nbsp = (s) => s.replace(/ /g, " ");

describe("financeFormat", () => {
  it("formata moeda pt-BR", () => {
    expect(nbsp(formatBrl(1234.5))).toBe("R$ 1.234,50");
    expect(formatBrl(null)).toBe("—");
    expect(formatBrl("abc")).toBe("—");
  });

  it("formata datas de domínio sem deslocar fuso", () => {
    expect(formatDate("2026-10-20")).toBe("20/10/2026");
    expect(formatDate("2026-10-20T00:00:00.000Z")).toBe("20/10/2026");
    expect(formatDate(null)).toBe("—");
    expect(toDateOnly("2026-01-05T03:00:00Z")).toBe("2026-01-05");
  });

  it("aplica máscara e parse de data dd/mm/aaaa", () => {
    expect(maskBrDate("20102026")).toBe("20/10/2026");
    expect(maskBrDate("2010")).toBe("20/10");
    expect(parseBrDate("20/10/2026")).toBe("2026-10-20");
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("2026-10-20")).toBeNull();
  });

  it("aplica máscara e parse de moeda", () => {
    expect(maskBrl("123456")).toBe("1.234,56");
    expect(maskBrl("5")).toBe("0,05");
    expect(maskBrl("")).toBe("");
    expect(parseBrl("1.234,56")).toBe(1234.56);
    expect(parseBrl("")).toBeNull();
    expect(numberToBrlInput(99.9)).toBe("99,90");
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("valida competência", () => {
    expect(parseCompetence("10/2026")).toBe("2026-10");
    expect(parseCompetence("13/2026")).toBeNull();
    expect(parseCompetence("")).toBe("");
  });

  it("traduz recorrência e situação na Efí", () => {
    expect(recurrenceLabel("TRIMESTRAL")).toBe("Trimestral (3 meses)");
    expect(recurrenceLabel(null, 2)).toBe("2 meses");
    expect(syncInfo("synced").label).toBe("Sincronizada com a Efí");
    expect(syncInfo("pending").label).toBe("Aguardando conciliação");
    expect(syncInfo("failed").label).toBe("Falha ao sincronizar — requer conciliação");
    expect(syncInfo("unsupported").label).toBe(
      "Baixa somente local (Pix não permite baixa manual na Efí)"
    );
    expect(syncInfo(null).label).toBe("Sem cobrança na Efí");
    expect(syncInfo("none").label).toBe("Sem cobrança na Efí");
  });

  it("mapeia erros financeiros e 404 de rota", () => {
    const err = (status, error) => ({ response: { status, data: error ? { error } : {} } });
    expect(financeErrorMessage(err(400, "ERR_PAYMENT_AMOUNT_INSUFFICIENT"))).toMatch(
      /pagamento parcial não é suportado/i
    );
    expect(financeErrorMessage(err(409, "ERR_RENEWAL_STALE"))).toMatch(/recarregue/);
    expect(financeErrorMessage(err(500, "ERR_X"))).toBeNull();
    expect(isNotFoundRoute(err(404))).toBe(true);
    expect(isNotFoundRoute(err(404, "ERR_INVOICE_NOT_FOUND"))).toBe(false);
  });

  it("traduz os eventType reais do backend e nunca mostra código cru", () => {
    const real = [
      "historical_payment_recorded",
      "historical_courtesy_recorded",
      "historical_invoice_cancelled",
      "historical_review_kept_pending",
      "invoice_created_manual",
      "invoice_created",
      "invoice_updated",
      "invoice_cancelled",
      "manual_payment_recorded",
      "courtesy_granted",
      "payment_confirmed_gateway",
      "renewal_payment_confirmed",
      "renewal_courtesy",
      "renewal_manual_renew",
      "renewal_due_date_adjustment",
      "renewal_skipped_period_already_covered",
      "gateway_payment_on_settled_invoice",
    ];
    real.forEach((t) => {
      const label = eventLabel(t);
      expect(label).not.toMatch(/_/);
      expect(label.toLowerCase()).not.toBe(t.replace(/_/g, " "));
    });
    expect(eventLabel("historical_review_kept_pending")).toBe("Fatura antiga revisada — mantida pendente");
    expect(eventLabel("renewal_manual_renew")).toBe("Renovação administrativa (sem receita)");
    // Desconhecidos: texto legível, sem código técnico.
    expect(eventLabel("renewal_skipped_xyz")).toBe("Renovação não aplicada");
    expect(eventLabel("algo_novo_qualquer")).toBe("Outro evento financeiro");
    expect(eventLabel(null)).toBe("—");
  });

  it("traduz os tipos de pendência de conciliação", () => {
    expect(reconKindLabel("manual_pix_no_settle")).toBe("Pix recebido fora da Efí — baixa somente local");
    expect(reconKindLabel("manual_settle_divergence")).toBe("Baixa manual não refletida na Efí");
    expect(reconKindLabel("gateway_payment_on_settled_invoice")).toBe("Possível pagamento em duplicidade");
    expect(reconKindLabel("gateway_payment_renewal_failed")).toBe(
      "Pix registrado, mas a assinatura não foi renovada"
    );
    expect(reconKindLabel("kind_desconhecido")).toBe("Pendência de conciliação");
  });

  it("datas de pagamento: sem data → 'data não informada'; date-only sem hora", () => {
    expect(formatPaidAt(null)).toBe("data não informada");
    expect(formatPaidDate("2026-09-30")).toBe("30/09/2026");
    expect(formatPaidDate(null, true)).toBe("data não informada");
    expect(sourceLabel("historical_payment")).toBe("Pagamento histórico (regularização)");
  });

  it("mensagens de erro de cancelamento e empresa", () => {
    const err = (error) => ({ response: { status: 400, data: { error } } });
    expect(financeErrorMessage(err("ERR_CANNOT_CANCEL_PAID_INVOICE"))).toBe(
      "Esta fatura já foi paga e não pode ser cancelada. Atualize a página."
    );
    expect(financeErrorMessage(err("ERR_CANNOT_CANCEL_INVOICE_WITH_PAYMENT"))).toMatch(/pagamento registrado/);
    expect(financeErrorMessage(err("ERR_CANCEL_REASON_REQUIRED"))).toMatch(/motivo/);
    expect(financeErrorMessage(err("ERR_INVALID_COMPANY"))).toMatch(/Empresa inválida/);
  });
});
