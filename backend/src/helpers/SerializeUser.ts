import Queue from "../models/Queue";
import Company from "../models/Company";
import User from "../models/User";
import Setting from "../models/Setting";
import { getCompanyFinanceFlags, CompanyFinanceFlags } from "./companyFinanceStatus";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number | null;
  company: Company | null;
  super: boolean;
  queues: Queue[];
  allTicket: string;
  finance: CompanyFinanceFlags;
  /** Modo suporte: sessão atua no tenant `companyId`; casa em `supportHomeCompanyId`. */
  supportMode?: boolean;
  supportHomeCompanyId?: number | null;
}

export const SerializeUser = async (user: User): Promise<SerializedUser> => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company: user.company,
    super: user.super,
    queues: user.queues,
    allTicket: user.allTicket,
    finance: user.company
      ? getCompanyFinanceFlags(user.company)
      : {
          overdue: false,
          delinquent: false,
          dueDate: null,
          daysPastDue: null
        }
  };
};

/**
 * Serialização quando o JWT usa empresa efetiva diferente da do utilizador (modo suporte).
 */
export const serializeUserForSession = async (
  user: User,
  effectiveCompanyId: number | null
): Promise<SerializedUser> => {
  const base = await SerializeUser(user);
  if (
    effectiveCompanyId == null ||
    effectiveCompanyId === user.companyId
  ) {
    return base;
  }
  const target = await Company.findByPk(effectiveCompanyId, {
    attributes: ["id", "name", "dueDate", "timezone"]
  });
  if (!target) {
    return base;
  }
  return {
    ...base,
    companyId: effectiveCompanyId,
    company: target,
    finance: getCompanyFinanceFlags(target),
    supportMode: true,
    supportHomeCompanyId: user.companyId ?? null
  };
};
