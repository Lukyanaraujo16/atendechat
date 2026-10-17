/*
 * Fase 8.4 — testes de INTEGRAÇÃO contra Postgres real isolado.
 * Rodar somente via scripts/test-integration-f84.sh (cria DB descartável + migrations).
 * A config de unidade (jest.config.js) usa testMatch de __tests__/*.spec.ts e não
 * encontra estes arquivos (.it.spec.ts em __integration__).
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: __dirname,
  roots: ["<rootDir>/src"],
  testMatch: ["**/__integration__/**/*.it.spec.ts"],
  collectCoverage: false,
  clearMocks: true,
  testTimeout: 60000,
  globals: {
    "ts-jest": {
      // Diagnósticos de tipo desligados: os testes são escritos contra contratos que
      // outros agentes ainda podem estar implementando.
      diagnostics: false,
      isolatedModules: true
    }
  }
};
