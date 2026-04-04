import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import { assertChatAccessForUser } from "./ChatAccessHelper";

interface ChatData {
  id: number;
  title?: string;
  users?: any[];
  userId: number;
  companyId: number;
}

export default async function UpdateService(data: ChatData) {
  const { users, userId, companyId } = data;

  const record = await assertChatAccessForUser({
    chatId: data.id,
    userId,
    companyId,
    requireOwner: true
  });

  await record.update({ title: data.title });

  if (Array.isArray(users)) {
    await ChatUser.destroy({ where: { chatId: record.id } });
    await ChatUser.create({ chatId: record.id, userId: record.ownerId });
    for (let user of users) {
      if (user.id !== record.ownerId) {
        await ChatUser.create({ chatId: record.id, userId: user.id });
      }
    }
  }

  await record.reload({
    include: [
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
      { model: User, as: "owner" }
    ]
  });

  return record;
}
