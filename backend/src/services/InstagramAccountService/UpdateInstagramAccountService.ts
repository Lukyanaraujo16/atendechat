import * as Yup from "yup";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InstagramAccount from "../../models/InstagramAccount";
import ShowInstagramAccountService from "./ShowInstagramAccountService";
import AssociateInstagramAccountQueue from "./AssociateInstagramAccountQueue";

interface InstagramAccountData {
  name?: string;
  isDefault?: boolean;
  queueIds?: number[];
}

interface Request {
  instagramAccountData: InstagramAccountData;
  instagramAccountId: string;
  companyId: number;
}

interface Response {
  instagramAccount: InstagramAccount;
  oldDefaultInstagramAccount: InstagramAccount | null;
}

const UpdateInstagramAccountService = async ({
  instagramAccountData,
  instagramAccountId,
  companyId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    isDefault: Yup.boolean()
  });

  const { name, isDefault, queueIds } = instagramAccountData;

  try {
    await schema.validate({ name, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const instagramAccount = await ShowInstagramAccountService(
    instagramAccountId,
    companyId
  );

  if (name && name !== instagramAccount.name) {
    const nameExists = await InstagramAccount.findOne({
      where: {
        name,
        companyId,
        id: { [Op.ne]: instagramAccount.id }
      }
    });

    if (nameExists) {
      throw new AppError(
        "Esse nome já está sendo utilizado por outra conta Instagram"
      );
    }
  }

  let oldDefaultInstagramAccount: InstagramAccount | null = null;

  if (isDefault) {
    oldDefaultInstagramAccount = await InstagramAccount.findOne({
      where: {
        companyId,
        isDefault: true,
        id: { [Op.ne]: instagramAccount.id }
      }
    });
    if (oldDefaultInstagramAccount) {
      await oldDefaultInstagramAccount.update({ isDefault: false });
    }
  }

  await instagramAccount.update({
    name: name ?? instagramAccount.name,
    isDefault: isDefault ?? instagramAccount.isDefault
  });

  if (queueIds !== undefined) {
    await AssociateInstagramAccountQueue(instagramAccount, queueIds);
  }

  await instagramAccount.reload({
    include: [
      {
        association: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  return { instagramAccount, oldDefaultInstagramAccount };
};

export default UpdateInstagramAccountService;
