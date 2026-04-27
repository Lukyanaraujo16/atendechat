import { logger } from "../../utils/logger";
import CreateUserNotificationService from "../UserNotificationService/CreateUserNotificationService";

function appointmentPayload(appointmentId: number): Record<string, unknown> {
  return { type: "appointment", appointmentId };
}

export async function notifyAppointmentCollectiveInvites(params: {
  companyId: number;
  appointmentId: number;
  title: string;
  inviteeUserIds: number[];
  createdByUserId: number;
}): Promise<void> {
  const { companyId, appointmentId, title, inviteeUserIds, createdByUserId } =
    params;
  try {
    const uniq = [...new Set(inviteeUserIds)].filter(
      id => id != null && id !== createdByUserId && !Number.isNaN(Number(id))
    );
    for (const userId of uniq) {
      await CreateUserNotificationService({
        userId,
        companyId,
        type: "appointment_invite",
        title: "Convite na agenda",
        body: `Novo evento coletivo: ${title}`,
        data: appointmentPayload(appointmentId),
        preferenceCategory: "appointment"
      });
    }
  } catch (err) {
    logger.warn(
      { err, companyId, appointmentId },
      "[UserNotification] appointment_invite_notify_failed"
    );
  }
}

export async function notifyAppointmentCreatorOfResponse(params: {
  companyId: number;
  appointmentId: number;
  appointmentTitle: string;
  creatorUserId: number;
  responderUserId: number;
  responderName: string;
  status: "accepted" | "declined";
}): Promise<void> {
  const {
    companyId,
    appointmentId,
    appointmentTitle,
    creatorUserId,
    responderUserId,
    responderName,
    status
  } = params;
  if (creatorUserId === responderUserId) {
    return;
  }
  try {
    const verb =
      status === "accepted" ? "aceitou o convite" : "recusou o convite";
    await CreateUserNotificationService({
      userId: creatorUserId,
      companyId,
      type: "appointment_response",
      title: "Resposta na agenda",
      body: `${responderName} ${verb}: ${appointmentTitle}`,
      data: { ...appointmentPayload(appointmentId), responseStatus: status },
      preferenceCategory: "appointment"
    });
  } catch (err) {
    logger.warn(
      { err, companyId, appointmentId },
      "[UserNotification] appointment_response_notify_failed"
    );
  }
}

export async function notifyAppointmentParticipantsUpdated(params: {
  companyId: number;
  appointmentId: number;
  title: string;
  participantUserIds: number[];
  editorUserId: number;
}): Promise<void> {
  const { companyId, appointmentId, title, participantUserIds, editorUserId } =
    params;
  try {
    const uniq = [...new Set(participantUserIds)].filter(
      id => id != null && id !== editorUserId && !Number.isNaN(Number(id))
    );
    for (const userId of uniq) {
      await CreateUserNotificationService({
        userId,
        companyId,
        type: "appointment_updated",
        title: "Agenda: evento atualizado",
        body: `O evento «${title}» foi alterado.`,
        data: appointmentPayload(appointmentId),
        preferenceCategory: "appointment"
      });
    }
  } catch (err) {
    logger.warn(
      { err, companyId, appointmentId },
      "[UserNotification] appointment_updated_notify_failed"
    );
  }
}

export async function notifyAppointmentParticipantsCancelled(params: {
  companyId: number;
  appointmentId: number;
  title: string;
  participantUserIds: number[];
  deletedByUserId: number;
}): Promise<void> {
  const {
    companyId,
    appointmentId,
    title,
    participantUserIds,
    deletedByUserId
  } = params;
  try {
    const uniq = [...new Set(participantUserIds)].filter(
      id => id != null && id !== deletedByUserId && !Number.isNaN(Number(id))
    );
    for (const userId of uniq) {
      await CreateUserNotificationService({
        userId,
        companyId,
        type: "appointment_cancelled",
        title: "Agenda: evento cancelado",
        body: `O evento «${title}» foi cancelado ou excluído.`,
        data: appointmentPayload(appointmentId),
        preferenceCategory: "appointment"
      });
    }
  } catch (err) {
    logger.warn(
      { err, companyId, appointmentId },
      "[UserNotification] appointment_cancelled_notify_failed"
    );
  }
}
