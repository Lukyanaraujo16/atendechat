/**
 * External ID namespaced do OneSignal.
 * Derivado só de User.id (PK global). companyId, e-mail e profile não entram.
 */
export function buildOneSignalExternalId(userId: number): string {
  return `streamhub_user_${userId}`;
}

/**
 * Par legado + novo, na ordem dos destinatários já filtrados.
 * Não cria alias para id ausente: a lista de entrada é a que o serviço já validou.
 */
export function expandOneSignalExternalIdAliases(userIds: number[]): string[] {
  const seen = new Set<string>();
  return userIds.reduce<string[]>((aliases, userId) => {
    [String(userId), buildOneSignalExternalId(userId)].forEach(alias => {
      if (!seen.has(alias)) {
        seen.add(alias);
        aliases.push(alias);
      }
    });
    return aliases;
  }, []);
}
