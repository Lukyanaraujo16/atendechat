import AiProviderCredential from "../../models/AiProviderCredential";
import {
  findAiProviderCredentialOrThrow,
  serializeAiProviderCredential
} from "./aiProviderCredentialSerialize";

export default async function ListAiProviderCredentialsService(input: {
  companyId: number;
}) {
  const rows = await AiProviderCredential.findAll({
    where: { companyId: input.companyId },
    order: [
      ["isDefault", "DESC"],
      ["name", "ASC"]
    ]
  });
  return rows.map(serializeAiProviderCredential);
}

export async function ShowAiProviderCredentialService(input: {
  companyId: number;
  id: number;
}) {
  const row = await findAiProviderCredentialOrThrow(input.companyId, input.id);
  return serializeAiProviderCredential(row);
}
