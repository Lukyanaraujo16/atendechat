/** Somente SELECT/metadados; não importa o bootstrap de models nem executa migrations. */
import { Sequelize } from "sequelize";
import {
  diagnoseInventoryBarcodes,
  assertInventoryBarcodeSchema
} from "../helpers/inventoryBarcodeSchema";

// eslint-disable-next-line @typescript-eslint/no-var-requires -- Config compartilhada com Sequelize CLI.
const config = require("../config/database");

async function main(): Promise<void> {
  const db = new Sequelize({ ...config, logging: false });
  try {
    const queryInterface = db.getQueryInterface();
    console.log(
      JSON.stringify(await diagnoseInventoryBarcodes(queryInterface), null, 2)
    );
    await assertInventoryBarcodeSchema(queryInterface);
    console.log("Esquema compatível com a migration de barcode.");
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith("Barcode:"))
    console.error(error.message);
  console.error(
    "Diagnóstico incompleto ou esquema incompatível. Verifique conexão/permissões e os pré-requisitos documentados; nenhum dado foi alterado."
  );
  process.exitCode = 1;
});
