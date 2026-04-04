import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import AppError from "../../errors/AppError";

/**
 * Garante que o chat existe, pertence à empresa e o utilizador é participante.
 * Opcionalmente exige ser dono (ex.: update/delete).
 * Preferimos 404 em falhas para não revelar existência de recursos alheios.
 */
export async function assertChatAccessForUser(params: {
  chatId: number;
  userId: number;
  companyId: number;
  requireOwner?: boolean;
}): Promise<Chat> {
  const { chatId, userId, companyId, requireOwner } = params;

  if (!Number.isFinite(chatId) || chatId <= 0) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const chat = await Chat.findByPk(chatId);
  if (!chat || chat.companyId !== companyId) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const member = await ChatUser.findOne({ where: { chatId, userId } });
  if (!member) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  if (requireOwner && chat.ownerId !== userId) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  return chat;
}

/**
 * Acesso por UUID (rota GET /chats/:id com uuid na URL).
 */
export async function assertChatAccessByUuid(params: {
  uuid: string;
  userId: number;
  companyId: number;
}): Promise<Chat> {
  const { uuid, userId, companyId } = params;

  if (!uuid || typeof uuid !== "string" || !uuid.trim()) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const chat = await Chat.findOne({ where: { uuid: uuid.trim() } });
  if (!chat || chat.companyId !== companyId) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const member = await ChatUser.findOne({ where: { chatId: chat.id, userId } });
  if (!member) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  return chat;
}
