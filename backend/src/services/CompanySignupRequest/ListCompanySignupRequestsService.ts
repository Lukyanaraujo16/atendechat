import { Op, WhereOptions } from "sequelize";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import Plan from "../../models/Plan";
import {
  signupQueryInviteExpiredBefore,
  signupQueryNewPendingFrom,
  signupQueryPendingStaleBefore
} from "../../constants/onboarding";
import { buildSignupRequestListExtras } from "./buildSignupRequestListExtras";
import SignupRequestSummaryCountsService, {
  type SignupRequestSummaryCounts
} from "./SignupRequestSummaryCountsService";

export type SignupRequestListFilter =
  | "new"
  | "pending"
  | "critical"
  | "invited"
  | "not_activated"
  | "activated"
  | "rejected"
  | "approved"
  | "all";

const ALLOWED_FILTERS = new Set<SignupRequestListFilter>([
  "new",
  "pending",
  "critical",
  "invited",
  "not_activated",
  "activated",
  "rejected",
  "approved",
  "all"
]);

export type SignupRequestsListPayload = {
  summary: SignupRequestSummaryCounts;
  requests: Array<Record<string, unknown>>;
};

function normalizeFilter(raw: string | undefined): SignupRequestListFilter {
  const s = String(raw || "pending").toLowerCase() as SignupRequestListFilter;
  return ALLOWED_FILTERS.has(s) ? s : "pending";
}

/** Escapa % e _ para uso em LIKE. */
function likePattern(term: string): string {
  const escaped = term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

const ListCompanySignupRequestsService = async (query: {
  status?: string;
  search?: string;
}): Promise<SignupRequestsListPayload> => {
  const filter = normalizeFilter(query.status);
  const andParts: WhereOptions[] = [];

  if (filter === "new") {
    andParts.push({
      status: "pending",
      createdAt: { [Op.gte]: signupQueryNewPendingFrom() }
    });
  } else if (filter === "pending") {
    andParts.push({ status: "pending" });
  } else if (filter === "critical") {
    const staleBefore = signupQueryPendingStaleBefore();
    const inviteExpiredBefore = signupQueryInviteExpiredBefore();
    andParts.push({
      [Op.or]: [
        { status: "pending", createdAt: { [Op.lte]: staleBefore } },
        {
          [Op.and]: [
            { status: { [Op.in]: ["invited", "approved"] } },
            { invitationSentAt: { [Op.not]: null } },
            { invitationSentAt: { [Op.lte]: inviteExpiredBefore } }
          ]
        }
      ]
    });
  } else if (filter === "invited") {
    andParts.push({
      [Op.or]: [
        { status: "invited" },
        {
          status: "approved",
          invitationSentAt: { [Op.not]: null }
        }
      ]
    });
  } else if (filter === "not_activated") {
    andParts.push({ status: { [Op.in]: ["approved", "invited"] } });
  } else if (filter === "activated") {
    andParts.push({ status: "activated" });
  } else if (filter === "rejected") {
    andParts.push({ status: "rejected" });
  } else if (filter === "approved") {
    andParts.push({ status: "approved" });
  }

  const q = (query.search || "").trim();
  if (q.length >= 2) {
    const like = likePattern(q);
    andParts.push({
      [Op.or]: [
        { companyName: { [Op.like]: like } },
        { adminName: { [Op.like]: like } },
        { email: { [Op.like]: like } }
      ]
    });
  }

  const where: WhereOptions =
    andParts.length === 0
      ? {}
      : andParts.length === 1
        ? andParts[0]
        : { [Op.and]: andParts };

  const [rows, summary] = await Promise.all([
    CompanySignupRequest.findAll({
      where,
      include: [{ model: Plan, required: false }],
      order: [["createdAt", "DESC"]]
    }),
    SignupRequestSummaryCountsService()
  ]);

  return {
    summary,
    requests: rows.map(row => ({
      ...row.toJSON(),
      ...buildSignupRequestListExtras(row)
    }))
  };
};

export default ListCompanySignupRequestsService;
