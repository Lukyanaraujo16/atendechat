/*
 * Segredos JWT só para os testes: aleatórios a cada execução (não há fallback no código).
 * Testes que precisam de outro valor definem process.env no próprio arquivo.
 */
const { randomBytes } = require("crypto");

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = randomBytes(32).toString("hex");
if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = randomBytes(32).toString("hex");
