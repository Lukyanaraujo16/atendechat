import Chat from "../../models/Chat";
import { assertChatAccessForUser } from "./ChatAccessHelper";

const DeleteService = async (
  id: string,
  userId: number,
  companyId: number
): Promise<void> => {
  const chatId = +id;
  const chat = await assertChatAccessForUser({
    chatId,
    userId,
    companyId,
    requireOwner: true
  });

  await chat.destroy();
};

export default DeleteService;
