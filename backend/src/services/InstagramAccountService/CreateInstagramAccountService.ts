import * as Yup from "yup";
import AppError from "../../errors/AppError";
import InstagramAccount from "../../models/InstagramAccount";
import AssociateInstagramAccountQueue from "./AssociateInstagramAccountQueue";

interface Request {
  name: string;
  companyId: number;
  queueIds?: number[];
  isDefault?: boolean;
}

interface Response {
  instagramAccount: InstagramAccount;
  oldDefaultInstagramAccount: InstagramAccount | null;
}

const CreateInstagramAccountService = async ({
  name,
  companyId,
  queueIds = [],
  isDefault = false
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "Esse nome já está sendo utilizado por outra conta Instagram",
        async value => {
          if (!value) return false;
          const nameExists = await InstagramAccount.findOne({
            where: { name: value, companyId }
          });
          return !nameExists;
        }
      )
  });

  try {
    await schema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let oldDefaultInstagramAccount: InstagramAccount | null = null;

  if (isDefault) {
    oldDefaultInstagramAccount = await InstagramAccount.findOne({
      where: { companyId, isDefault: true }
    });
    if (oldDefaultInstagramAccount) {
      await oldDefaultInstagramAccount.update({ isDefault: false });
    }
  }

  const instagramAccount = await InstagramAccount.create({
    name,
    companyId,
    status: "PENDING",
    isDefault
  });

  await AssociateInstagramAccountQueue(instagramAccount, queueIds);

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

export default CreateInstagramAccountService;
