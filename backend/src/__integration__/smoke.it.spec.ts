import sequelize from "../database";

describe("integração — smoke", () => {
  afterAll(async () => { await sequelize.close(); });
  it("conecta ao database descartável (nunca atendechat_f84/f84_agent*)", async () => {
    const [rows] = await sequelize.query("select current_database() as db");
    const db = (rows as any[])[0].db as string;
    expect(db.startsWith("f84_it_")).toBe(true);
    const [cols] = await sequelize.query(
      `select data_type from information_schema.columns where table_name='Companies' and column_name='dueDate'`
    );
    // Documenta a raiz do incidente P0: dueDate é timestamptz.
    expect((cols as any[])[0].data_type).toBe("timestamp with time zone");
  });
});
