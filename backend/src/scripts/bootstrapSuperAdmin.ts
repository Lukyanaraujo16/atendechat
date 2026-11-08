/**
 * Bootstrap do primeiro Super Admin (instalação nova) e recuperação de senha.
 *
 * Uso (após `npm run build`, dentro de backend/):
 *   SUPERADMIN_NAME="Nome" SUPERADMIN_EMAIL="a@b.com" SUPERADMIN_PASSWORD="..." \
 *     node dist/scripts/bootstrapSuperAdmin.js
 *   node dist/scripts/bootstrapSuperAdmin.js --status
 *   SUPERADMIN_EMAIL="a@b.com" SUPERADMIN_PASSWORD="..." \
 *     node dist/scripts/bootstrapSuperAdmin.js --reset-password
 *
 * A senha vem só do ambiente (nunca de argv, que aparece em `ps`) e nunca é impressa.
 * Idempotente: se já existe um Super Admin, não cria outro (código de saída 0).
 * Usa o mesmo serviço de POST /platform/super-admins (validação e política de senha).
 * Códigos de saída: 0 ok/nada a fazer, 1 erro, 2 entrada inválida.
 */
import "../bootstrap";
import { Op } from "sequelize";
import sequelize from "../database";
import User from "../models/User";
import PlatformUserPermission from "../models/PlatformUserPermission";
import CreatePlatformSuperUserService from "../services/UserServices/CreatePlatformSuperUserService";
import { strongPasswordSchema } from "../utils/passwordPolicy";

// Mesmo grant que a migration 20260725120000 deu aos Super Admins existentes.
const CONSOLE_VIEW = "agentOS.console.view";

const superWhere = {
  [Op.or]: [{ super: true }, { profile: "superadmin" }]
};

class InputError extends Error {}

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

async function status(): Promise<void> {
  const count = await User.count({ where: superWhere });
  console.log(JSON.stringify({ superAdmins: count }));
}

async function create(): Promise<void> {
  const existing = await User.count({ where: superWhere });
  if (existing > 0) {
    console.log(
      `[bootstrap-superadmin] Já existe ${existing} Super Admin — nada foi criado.`
    );
    return;
  }
  const name = env("SUPERADMIN_NAME");
  const email = env("SUPERADMIN_EMAIL");
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!name || !email || !password) {
    throw new InputError(
      "Defina SUPERADMIN_NAME, SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD."
    );
  }
  const user = await CreatePlatformSuperUserService({
    name,
    email,
    password,
    profile: "admin",
    super: true,
    companyId: null
  });
  await PlatformUserPermission.findOrCreate({
    where: { userId: user.id, permissionKey: CONSOLE_VIEW },
    defaults: { userId: user.id, permissionKey: CONSOLE_VIEW, enabled: true }
  });
  console.log(
    `[bootstrap-superadmin] Super Admin criado: id=${user.id} email=${user.email}`
  );
}

async function resetPassword(): Promise<void> {
  const email = env("SUPERADMIN_EMAIL").toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  if (!email || !password) {
    throw new InputError("Defina SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD.");
  }
  try {
    await strongPasswordSchema.required().validate(password);
  } catch {
    throw new InputError(
      "Senha fraca: mínimo 8 caracteres, com maiúscula, minúscula e número."
    );
  }
  const user = await User.findOne({ where: { email, ...superWhere } });
  if (!user) {
    throw new InputError(`Nenhum Super Admin com o e-mail ${email}.`);
  }
  // tokenVersion+1 invalida sessões abertas com a senha antiga.
  await user.update({
    password,
    tokenVersion: (user.tokenVersion || 0) + 1
  } as Partial<User>);
  console.log(`[bootstrap-superadmin] Senha redefinida para ${email}.`);
}

async function main(): Promise<void> {
  const arg = process.argv[2] || "";
  try {
    if (arg === "--status") await status();
    else if (arg === "--reset-password") await resetPassword();
    else if (arg === "") await create();
    else throw new InputError(`Opção desconhecida: ${arg}`);
  } finally {
    await sequelize.close();
  }
}

main().catch((err: unknown) => {
  // AppError não estende Error, mas tem `message`.
  const msg = String((err as { message?: unknown })?.message || err);
  console.error(`[bootstrap-superadmin] ERRO: ${msg}`);
  process.exitCode = err instanceof InputError ? 2 : 1;
});
