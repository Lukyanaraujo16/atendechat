import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import { assertChatAccessByUuid } from "./ChatAccessHelper";

const ShowFromUuidService = async (
  uuid: string,
  userId: number,
  companyId: number
): Promise<Chat> => {
  const chat = await assertChatAccessByUuid({ uuid, userId, companyId });

  await chat.reload({
    include: [
      { model: User, as: "owner" },
      {
        model: ChatUser,
        as: "users",
        include: [{ model: User, as: "user" }]
      }
    ]
  });

  return chat;
};

export default ShowFromUuidService;
