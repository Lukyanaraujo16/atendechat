import User from "../models/User";
import { isInternalUser } from "./isInternalUser";

/**
 * Gate Fase 10.5 — apenas Super Admin plataforma pode provisionar Evolution.
 * Identidade: isInternalUser (super === true || profile === superadmin).
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
