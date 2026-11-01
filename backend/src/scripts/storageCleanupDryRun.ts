/* eslint-disable no-restricted-syntax, no-await-in-loop -- uma empresa por vez */
/**
 * Dry-run da limpeza por cota: lista quanto seria liberado, sem remover arquivos nem alterar registros.
 * Uso: node dist/scripts/storageCleanupDryRun.js <companyId> [<companyId> ...]
 * Saída só com agregados (sem nomes de arquivos ou dados de clientes).
 */
import "../bootstrap";
import CleanupCompanyStorageService from "../services/CompanyService/CleanupCompanyStorageService";
import sequelize from "../database";

async function main(): Promise<void> {
  const ids = process.argv
    .slice(2)
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) throw new Error("Informe ao menos um companyId.");
  try {
    for (const id of ids) {
      // dryRun explícito: ignora STORAGE_AUTO_CLEANUP_ENABLED.
      const r = await CleanupCompanyStorageService(id, { dryRun: true });
      console.log(JSON.stringify(r));
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
