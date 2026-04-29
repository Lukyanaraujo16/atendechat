import * as Yup from "yup";
import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import provisionPrimaryAdminForCompany from "./provisionPrimaryAdminForCompany";

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  password?: string;
  /** Nome do admin principal; por omissão usa o nome da empresa. */
  primaryAdminName?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  modulePermissions?: Record<string, boolean> | null;
  internalNotes?: string | null;
  /** Valor mensal negociado (opcional); null omitido usa plano */
  contractedPlanValue?: number | null;
}

export interface CreateCompanyOptions {
  transaction?: Transaction;
}

export interface CreateCompanyResult {
  company: Company;
  /** Resultado do convite por e-mail ao admin (quando a senha não é definida na criação). */
  primaryAdminInviteEmailSent?: boolean;
}

const CreateCompanyService = async (
  companyData: CompanyData,
  createOpts?: CreateCompanyOptions
): Promise<CreateCompanyResult> => {
  const transaction = createOpts?.transaction;
  const {
    name,
    phone,
    email,
    status,
    planId,
    campaignsEnabled,
    dueDate,
    recurrence,
    password,
    modulePermissions,
    internalNotes,
    contractedPlanValue
  } = companyData;

  const companySchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_COMPANY_INVALID_NAME")
      .required("ERR_COMPANY_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_COMPANY_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const companyWithSameName = await Company.findOne({
              where: { name: value }
            });

            return !companyWithSameName;
          }
          return false;
        }
      )
  });

  try {
    await companySchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const notes =
    internalNotes === undefined || internalNotes === null
      ? null
      : String(internalNotes).trim() === ""
        ? null
        : String(internalNotes).trim();

  const company = await Company.create(
    {
      name,
      phone,
      email,
      status,
      planId,
      dueDate,
      recurrence,
      internalNotes: notes,
      ...(contractedPlanValue === undefined
        ? {}
        : { contractedPlanValue }),
      ...(modulePermissions && typeof modulePermissions === "object"
        ? { modulePermissions }
        : {})
    },
    { transaction }
  );

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "asaas"
    },
    defaults: {
      companyId: company.id,
      key: "asaas",
      value: ""
    },
  });

  //tokenixc
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "tokenixc"
    },
    defaults: {
      companyId: company.id,
      key: "tokenixc",
      value: ""
    },
  });

  //ipixc
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "ipixc"
    },
    defaults: {
      companyId: company.id,
      key: "ipixc",
      value: ""
    },
  });

  //ipmkauth
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "ipmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "ipmkauth",
      value: ""
    },
  });

  //clientsecretmkauth
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "clientsecretmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "clientsecretmkauth",
      value: ""
    },
  });

  //clientidmkauth
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "clientidmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "clientidmkauth",
      value: ""
    },
  });

  //CheckMsgIsGroup
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "CheckMsgIsGroup"
    },
    defaults: {
      companyId: company.id,
      key: "enabled",
      value: ""
    },
  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "call"
    },
    defaults: {
      companyId: company.id,
      key: "call",
      value: "disabled"
    },
  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "callRejectSendMessage"
    },
    defaults: {
      companyId: company.id,
      key: "callRejectSendMessage",
      value: "enabled"
    },
  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "callRejectMessage"
    },
    defaults: {
      companyId: company.id,
      key: "callRejectMessage",
      value: ""
    },
  });

  //scheduleType
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "scheduleType"
    },
    defaults: {
      companyId: company.id,
      key: "scheduleType",
      value: "disabled"
    },
  });


 // Enviar mensagem ao aceitar ticket
    await Setting.findOrCreate({
	transaction,
	where:{
      companyId: company.id,
      key: "sendGreetingAccepted",
    },
    defaults: {
      companyId: company.id,
      key: "sendGreetingAccepted",
      value: "disabled"
    },
  });

 // Enviar mensagem de transferencia
    await Setting.findOrCreate({
	transaction,
	where:{
      companyId: company.id,
      key: "sendMsgTransfTicket",
    },
    defaults: {
      companyId: company.id,
      key: "sendMsgTransfTicket",
      value: "disabled"
    },
 });

  //userRating
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "userRating"
    },
    defaults: {
      companyId: company.id,
      key: "userRating",
      value: "disabled"
    },
  });

  //userRating
  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "chatBotType"
    },
    defaults: {
      companyId: company.id,
      key: "chatBotType",
      value: "text"
    },

  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "tokensgp"
    },
    defaults: {
      companyId: company.id,
      key: "tokensgp",
      value: ""
    },
  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "ipsgp"
    },
    defaults: {
      companyId: company.id,
      key: "ipsgp",
      value: ""
    },
  });

  await Setting.findOrCreate({
    transaction,
    where: {
      companyId: company.id,
      key: "appsgp"
    },
    defaults: {
      companyId: company.id,
      key: "appsgp",
      value: ""
    },
  });

  if (companyData.campaignsEnabled !== undefined) {
    const [setting, created] = await Setting.findOrCreate({
      transaction,
      where: {
        companyId: company.id,
        key: "campaignsEnabled"
      },
      defaults: {
        companyId: company.id,
        key: "campaignsEnabled",
        value: `${campaignsEnabled}`
      },

    });
    if (!created) {
      await setting.update({ value: `${campaignsEnabled}` }, { transaction });
    }
  }

  const provisionResult = await provisionPrimaryAdminForCompany({
    company,
    adminEmail: String(company.email || ""),
    adminName: String(companyData.primaryAdminName || company.name || ""),
    passwordPlain: password,
    transaction
  });

  return {
    company,
    primaryAdminInviteEmailSent: provisionResult.inviteEmailSent
  };
};

export default CreateCompanyService;
