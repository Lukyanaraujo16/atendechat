import { Op } from "sequelize";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

const nonSuperTenantClause = {
  [Op.or]: [{ super: false }, { super: null }]
};

/**
 * Participantes elegíveis para push de chat interno:
 * membros do chat da mesma empresa, ativos, não-super, excluindo o remetente.
 */
export async function resolveInternalChatPushRecipients(params: {
  companyId: number;
  chatId: number;
  senderUserId: number;
}): Promise<{
  recipientUserIds: number[];
  chatUuid: string | null;
  chatExists: boolean;
}> {
  const { companyId, chatId, senderUserId } = params;

  const chat = await Chat.findOne({
    where: { id: chatId, companyId },
    attributes: ["id", "uuid", "companyId"]
  });

  if (!chat) {
    return { recipientUserIds: [], chatUuid: null, chatExists: false };
  }

  const members = await ChatUser.findAll({
    where: { chatId },
    attributes: ["userId"]
  });

  const memberIds = [
    ...new Set(
      members
        .map(m => Number(m.userId))
        .filter(
          id =>
            id != null &&
            !Number.isNaN(id) &&
            id !== Number(senderUserId)
        )
    )
  ];

  if (!memberIds.length) {
    return {
      recipientUserIds: [],
      chatUuid: chat.uuid ? String(chat.uuid) : null,
      chatExists: true
    };
  }

  const users = await User.findAll({
    where: {
      id: { [Op.in]: memberIds },
      companyId,
      active: true,
      ...nonSuperTenantClause
    },
    attributes: ["id"]
  });

  return {
    recipientUserIds: users.map(u => u.id),
    chatUuid: chat.uuid ? String(chat.uuid) : null,
    chatExists: true
  };
}
