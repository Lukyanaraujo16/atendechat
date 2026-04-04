import AppError from "../../errors/AppError";
import ChatMessage from "../../models/ChatMessage";
import User from "../../models/User";

import { sortBy } from "lodash";
import { assertChatAccessForUser } from "./ChatAccessHelper";

interface Request {
  chatId: string;
  userId: number;
  companyId: number;
  pageNumber?: string;
}

interface Response {
  records: ChatMessage[];
  count: number;
  hasMore: boolean;
}

const FindMessages = async ({
  chatId,
  userId,
  companyId,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const chatIdNum = Number(chatId);
  if (!Number.isFinite(chatIdNum) || chatIdNum <= 0) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  await assertChatAccessForUser({ chatId: chatIdNum, userId, companyId });

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await ChatMessage.findAndCountAll({
    where: {
      chatId: chatIdNum
    },
    include: [{ model: User, as: "sender", attributes: ["id", "name"] }],
    limit,
    offset,

    order: [["createdAt", "DESC"]]
  });

  const hasMore = count > offset + records.length;

  const sorted = sortBy(records, ["id", "ASC"]);

  return {
    records: sorted,
    count,
    hasMore
  };
};

export default FindMessages;
