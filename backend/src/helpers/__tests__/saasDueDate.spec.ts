import {
  toDomainDate,
  instantToDomainDate,
  resolveSaasTimezone,
  DB_STORAGE_UTC_OFFSET
} from "../saasDueDate";

describe("toDomainDate", () => {
  const tz = "America/Sao_Paulo";

  it("Date vindo de timestamptz (meia-noite em São Paulo) vira o dia correto", () => {
    expect(toDomainDate(new Date("2026-10-01T03:00:00.000Z"), tz)).toBe("2026-10-01");
  });

  it("Date em UTC meia-noite vira o dia anterior no fuso de São Paulo", () => {
    expect(toDomainDate(new Date("2026-10-01T00:00:00.000Z"), tz)).toBe("2026-09-30");
  });

  it("string YYYY-MM-DD é preservada", () => {
    expect(toDomainDate("2026-02-28", tz)).toBe("2026-02-28");
  });

  it("ISO com offset (fatura legada) respeita o offset", () => {
    expect(toDomainDate("2026-10-01T00:00:00-03:00", tz)).toBe("2026-10-01");
  });

  it("null, vazio e inválidos viram null", () => {
    expect(toDomainDate(null, tz)).toBeNull();
    expect(toDomainDate(undefined, tz)).toBeNull();
    expect(toDomainDate("  ", tz)).toBeNull();
    expect(toDomainDate("2026-02-30", tz)).toBeNull();
    expect(toDomainDate("abc", tz)).toBeNull();
    expect(toDomainDate(new Date("x"), tz)).toBeNull();
  });

  it("resultado sempre cabe em VARCHAR(16)", () => {
    const v = toDomainDate(new Date(), tz) as string;
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v.length).toBeLessThanOrEqual(16);
  });

  it("timezone inválido cai no padrão", () => {
    expect(resolveSaasTimezone("Nao/Existe")).toBe("America/Sao_Paulo");
    expect(resolveSaasTimezone(null)).toBe("America/Sao_Paulo");
  });

  it.each(["America/Manaus", "America/Rio_Branco", "America/Cuiaba", "America/Noronha", "America/Sao_Paulo"])(
    "vencimento gravado (meia-noite da sessão -03:00) é lido no mesmo dia para empresa em %s",
    tz => {
      expect(toDomainDate(new Date("2026-11-05T03:00:00.000Z"), tz)).toBe("2026-11-05");
      expect(toDomainDate("2026-11-05T00:00:00-03:00", tz)).toBe("2026-11-05");
      expect(toDomainDate("2026-11-05", tz)).toBe("2026-11-05");
    }
  );

  it("ISO sem offset usa a data escrita", () => {
    expect(toDomainDate("2026-10-01T00:00:00", "America/Manaus")).toBe("2026-10-01");
  });

  it("offset de armazenamento acompanha config/database.ts", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dbConfig = require("../../config/database");
    expect(dbConfig.timezone).toBe(DB_STORAGE_UTC_OFFSET);
  });

  it("instantToDomainDate: instante real usa o fuso da empresa (createdAt, paidAt do gateway)", () => {
    const instant = new Date("2026-10-17T02:00:00.000Z"); // 16/10 23h em SP; 16/10 22h em Manaus; 17/10 em UTC
    expect(instantToDomainDate(instant, "America/Sao_Paulo")).toBe("2026-10-16");
    expect(instantToDomainDate(instant, "America/Manaus")).toBe("2026-10-16");
    expect(instantToDomainDate(instant, "UTC")).toBe("2026-10-17");
    expect(instantToDomainDate(null, "UTC")).toBeNull();
    expect(instantToDomainDate("lixo", "UTC")).toBeNull();
  });
});
