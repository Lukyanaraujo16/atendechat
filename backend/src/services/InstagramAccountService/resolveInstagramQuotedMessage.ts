import Message from "../../models/Message";
import { logger } from "../../utils/logger";

interface ResolveRequest {
  companyId: number;
  replyToExternalMessageId: string | null | undefined;
  ticketId?: number;
}

export const resolveInstagramQuotedMessageId = async ({
  companyId,
  replyToExternalMessageId,
  ticketId
}: ResolveRequest): Promise<string | null> => {
  if (!replyToExternalMessageId?.trim()) {
    return null;
  }

  const externalId = replyToExternalMessageId.trim();

  logger.info(
    {
      companyId,
      ticketId,
      replyToExternalMessageId: externalId
    },
    "[InstagramReply] detected"
  );

  const quoted = await Message.findOne({
    where: {
      companyId,
      externalMessageId: externalId
    },
    attributes: ["id", "ticketId"]
  });

  if (!quoted) {
    const quotedById = await Message.findByPk(externalId, {
      attributes: ["id", "ticketId"]
    });
    if (quotedById) {
      logger.info(
        {
          companyId,
          ticketId,
          replyToExternalMessageId: externalId,
          quotedMsgId: quotedById.id
        },
        "[InstagramReply] linked"
      );
      return quotedById.id;
    }
    return null;
  }

  logger.info(
    {
      companyId,
      ticketId,
      replyToExternalMessageId: externalId,
      quotedMsgId: quoted.id
    },
    "[InstagramReply] linked"
  );

  return quoted.id;
};
