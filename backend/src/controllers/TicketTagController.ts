import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketTag from "../models/TicketTag";
import Tag from "../models/Tag";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../helpers/ticketAccess";
import { isTruthySupportMode } from "../helpers/groupVisibility";

async function assertTicketTagAccess(
  req: Request,
  ticketId: string | number
): Promise<void> {
  const { companyId, id: userId, profile } = req.user;
  const supportMode = isTruthySupportMode((req.user as any).supportMode);
  const ticket = await ShowTicketService(ticketId, companyId);
  await assertUserCanAccessTicketResource(
    { id: userId, profile, supportMode },
    toTicketAccessPayload(ticket),
    companyId,
    "TicketTagController"
  );
}

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, tagId } = req.params;

  try {
    await assertTicketTagAccess(req, ticketId);
    const ticketTag = await TicketTag.create({ ticketId, tagId });
    return res.status(201).json(ticketTag);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    return res.status(500).json({ error: "Failed to store ticket tag." });
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  try {
    await assertTicketTagAccess(req, ticketId);
    const ticketTags = await TicketTag.findAll({ where: { ticketId } });
    const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);

    const tagsWithKanbanOne = await Tag.findAll({
      where: {
        id: tagIds,
        kanban: 1
      }
    });

    const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
    if (tagIdsWithKanbanOne.length) {
      await TicketTag.destroy({
        where: { ticketId, tagId: tagIdsWithKanbanOne }
      });
    }

    return res.status(200).json({ message: "Ticket tags removed successfully." });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    return res.status(500).json({ error: "Failed to remove ticket tags." });
  }
};
