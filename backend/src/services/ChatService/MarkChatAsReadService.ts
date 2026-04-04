import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import { assertChatAccessForUser } from "./ChatAccessHelper";

interface Request {
  chatId: number;
  userId: number;
  companyId: number;
}

/**
 * Marca mensagens como lidas para o utilizador autenticado (ignora qualquer userId no body).
 */
const MarkChatAsReadService = async ({
  chatId,
  userId,
  companyId
}: Request): Promise<Chat> => {
  await assertChatAccessForUser({ chatId, userId, companyId });

  const [affected] = await ChatUser.update(
    { unreads: 0 },
    { where: { chatId, userId } }
  );
  if (!affected) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const chat = await Chat.findByPk(chatId, {
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users" }
    ]
  });

  if (!chat) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  return chat;
};

export default MarkChatAsReadService;
