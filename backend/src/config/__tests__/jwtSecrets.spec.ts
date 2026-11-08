import {
  JWT_SECRET_MIN_LENGTH,
  JwtConfigError,
  requireJwtSecrets,
  validateJwtSecrets
} from "../jwtSecrets";
import authConfig from "../auth";

const A = "a".repeat(40);
const B = "b".repeat(40);

describe("jwtSecrets", () => {
  it("aceita segredos próprios, distintos e com 32+ caracteres", () => {
    expect(
      validateJwtSecrets({ JWT_SECRET: A, JWT_REFRESH_SECRET: B })
    ).toEqual([]);
    expect(requireJwtSecrets({ JWT_SECRET: A, JWT_REFRESH_SECRET: B })).toEqual(
      {
        secret: A,
        refreshSecret: B
      }
    );
  });

  it("aceita o formato do instalador antigo (openssl rand -base64 32)", () => {
    const legacy = "Q2hhdmVBbnRpZ2FEb0luc3RhbGFkb3JCYXNlNjQ0NA==";
    expect(
      validateJwtSecrets({ JWT_SECRET: legacy, JWT_REFRESH_SECRET: B })
    ).toEqual([]);
  });

  it("recusa ausência ou valor vazio", () => {
    expect(validateJwtSecrets({})).toEqual([
      "JWT_SECRET ausente ou vazio",
      "JWT_REFRESH_SECRET ausente ou vazio"
    ]);
    expect(
      validateJwtSecrets({ JWT_SECRET: "   ", JWT_REFRESH_SECRET: B })
    ).toEqual(["JWT_SECRET ausente ou vazio"]);
  });

  it("recusa os antigos fallbacks e os valores publicados no .env.example", () => {
    [
      "mysecret",
      "myanothersecret",
      "kZaOTd+YZpjRUyyuQUpigJaEMk4vcW4YOymKPZX0Ts8=",
      "dBSXqFg9TaNUEDXVp6fhMTRLBysP+j2DSqf7+raxD3A="
    ].forEach(v => {
      expect(
        validateJwtSecrets({ JWT_SECRET: v, JWT_REFRESH_SECRET: B })
      ).toEqual(["JWT_SECRET usa um valor público conhecido"]);
    });
  });

  it("recusa segredo curto", () => {
    const short = "x".repeat(JWT_SECRET_MIN_LENGTH - 1);
    expect(
      validateJwtSecrets({ JWT_SECRET: A, JWT_REFRESH_SECRET: short })
    ).toEqual([
      `JWT_REFRESH_SECRET tem menos de ${JWT_SECRET_MIN_LENGTH} caracteres`
    ]);
  });

  it("recusa segredos iguais (refresh token valeria como acesso)", () => {
    expect(
      validateJwtSecrets({ JWT_SECRET: A, JWT_REFRESH_SECRET: A })
    ).toEqual(["JWT_SECRET e JWT_REFRESH_SECRET são iguais"]);
  });

  it("a mensagem de erro nunca contém o valor do segredo", () => {
    const leaked = "mysecret";
    try {
      requireJwtSecrets({ JWT_SECRET: leaked, JWT_REFRESH_SECRET: A });
      throw new Error("deveria falhar");
    } catch (err) {
      expect(err).toBeInstanceOf(JwtConfigError);
      expect((err as Error).message).not.toContain(leaked);
      expect((err as Error).message).not.toContain(A);
    }
  });

  describe("config/auth sem fallback", () => {
    const original = { ...process.env };
    afterEach(() => {
      process.env = { ...original };
    });

    it("lança erro em vez de usar segredo fixo", () => {
      delete process.env.JWT_SECRET;
      expect(() => authConfig.secret).toThrow(JwtConfigError);
    });

    it("lê os valores configurados", () => {
      process.env.JWT_SECRET = A;
      process.env.JWT_REFRESH_SECRET = B;
      expect(authConfig.secret).toBe(A);
      expect(authConfig.refreshSecret).toBe(B);
    });
  });
});
