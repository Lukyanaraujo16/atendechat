import Sticker from "../../models/Sticker";

interface Request {
  companyId: number;
}

interface Response {
  stickers: Sticker[];
}

const ListStickersService = async ({
  companyId
}: Request): Promise<Response> => {
  const stickers = await Sticker.findAll({
    where: { companyId, isActive: true },
    order: [
      ["sortOrder", "ASC"],
      ["createdAt", "DESC"]
    ]
  });

  return { stickers };
};

export default ListStickersService;
