import path from "path";
import { saasBillingFlags } from "./saasBillingFlags";

const certName = process.env.GERENCIANET_PIX_CERT || "";
const cert = path.join(__dirname, `../../certs/${certName}.p12`);

/**
 * Config SDK Gerencianet/Efí (API Pix).
 * sandbox segue GERENCIANET_SANDBOX (default seguro: true se ausente).
 */
const options = {
  sandbox: saasBillingFlags.gerencianetSandbox(),
  client_id: process.env.GERENCIANET_CLIENT_ID as string,
  client_secret: process.env.GERENCIANET_CLIENT_SECRET as string,
  pix_cert: cert
};

export = options;
