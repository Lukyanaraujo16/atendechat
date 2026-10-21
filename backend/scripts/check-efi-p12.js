/**
 * Conferência local de um certificado P12 da Efí ANTES do upload no painel (B3.4, H-03, P-B31-02).
 *
 * Uso:  node scripts/check-efi-p12.js <caminho/do/arquivo.p12>
 *
 * Faz o mesmo teste do backend (`tls.createSecureContext({ pfx, passphrase: "" })`, Node em uso)
 * e mostra só dados públicos: fingerprint SHA-256 do arquivo (o mesmo que o painel exibe),
 * titular, emissor e validade do certificado. Nunca imprime a chave privada nem grava nada.
 * Nenhuma chamada de rede. Rode na máquina/servidor com a MESMA versão do Node do backend.
 * Saída 0 = abre; 1 = não abre (ex.: P12 com algoritmo legado no Node 17+ → reconverter sem -legacy).
 */
/* eslint-disable no-console */
const crypto = require("crypto");
const fs = require("fs");
const tls = require("tls");
const { execFileSync } = require("child_process");

const MAX_P12_BYTES = 2 * 1024 * 1024;

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Uso: node scripts/check-efi-p12.js <arquivo.p12>");
    return 2;
  }
  if (!fs.existsSync(file)) {
    console.error(`arquivo não encontrado: ${file}`);
    return 2;
  }
  const buf = fs.readFileSync(file);
  console.log(`node: ${process.version}`);
  console.log(`tamanho: ${buf.length} bytes${buf.length > MAX_P12_BYTES ? " (ACIMA do limite de 2 MB do upload)" : ""}`);
  console.log(`fingerprint sha256 (painel): ${crypto.createHash("sha256").update(buf).digest("hex")}`);

  let opens = false;
  try {
    tls.createSecureContext({ pfx: buf, passphrase: "" });
    opens = true;
    console.log("abre no Node com senha vazia: SIM");
  } catch (err) {
    console.log(`abre no Node com senha vazia: NÃO (${String(err && err.message).slice(0, 120)})`);
    console.log("  → se for 'Unsupported PKCS12 PFX data', reconverta o P12 sem -legacy (P-B31-02).");
  }

  // Dados públicos do certificado via openssl (opcional): só o certificado, nunca a chave.
  try {
    const pem = execFileSync(
      "openssl",
      ["pkcs12", "-in", file, "-clcerts", "-nokeys", "-passin", "pass:"],
      { stdio: ["ignore", "pipe", "ignore"] }
    ).toString();
    const block = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(pem);
    if (block) {
      const cert = new crypto.X509Certificate(block[0]);
      const expired = Date.parse(cert.validTo) < Date.now();
      console.log(`titular: ${cert.subject.replace(/\n/g, ", ")}`);
      console.log(`emissor: ${cert.issuer.replace(/\n/g, ", ")}`);
      console.log(`válido de ${cert.validFrom} até ${cert.validTo}${expired ? " (VENCIDO)" : ""}`);
      if (expired) opens = false;
    }
  } catch {
    console.log("openssl indisponível ou P12 ilegível pelo openssl: titular/validade não conferidos.");
  }
  return opens ? 0 : 1;
}

process.exitCode = main();
