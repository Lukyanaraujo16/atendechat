import User from "../models/User";
import { isInternalUser } from "./isInternalUser";

/**
 * Gate legado de identidade interna.
 * NÃO é usado no CREATE de conexão WhatsApp (autorização = settings.connections).
 * Mantido para rotas técnicas futuras (ex.: BYO).
 */
export async function canProvisionEvolutionConnection(
  userId: number | null | undefined
): Promise<boolean> {
  if (userId == null || !Number.isFinite(Number(userId))) {
    return false;
  }
  const row = await User.findByPk(userId, {
    attributes: ["super", "profile"]
  });
  return isInternalUser(row);
}
