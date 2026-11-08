import { requireJwtSecrets } from "./jwtSecrets";

// Sem fallback: segredo ausente ou inseguro lança JwtConfigError (e o server.ts não inicia).
export default {
  get secret(): string {
    return requireJwtSecrets().secret;
  },
  expiresIn: "15m",
  get refreshSecret(): string {
    return requireJwtSecrets().refreshSecret;
  },
  refreshExpiresIn: "7d"
};
