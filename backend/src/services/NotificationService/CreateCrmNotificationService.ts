import UserNotification from "../../models/UserNotification";
import CreateUserNotificationService from "../UserNotificationService/CreateUserNotificationService";

export type CreateCrmNotificationInput = {
  userId: number;
  companyId: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Notificações in-app do CRM (sem filtro de preferências — `preferenceCategory` nulo).
 */
export default async function CreateCrmNotificationService(
  input: CreateCrmNotificationInput
): Promise<UserNotification | null> {
  return CreateUserNotificationService({
    userId: input.userId,
    companyId: input.companyId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    preferenceCategory: null
  });
}
