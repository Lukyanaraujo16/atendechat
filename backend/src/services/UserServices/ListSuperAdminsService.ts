import User from "../../models/User";
import Company from "../../models/Company";

const ListSuperAdminsService = async () => {
  const users = await User.findAll({
    where: { super: true },
    attributes: [
      "id",
      "name",
      "email",
      "profile",
      "super",
      "online",
      "companyId",
      "createdAt",
      "updatedAt"
    ],
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"],
        required: false
      }
    ],
    order: [["name", "ASC"]]
  });

  return users;
};

export default ListSuperAdminsService;
