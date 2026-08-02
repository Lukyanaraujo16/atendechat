import { logger } from "../../utils/logger";
import SendOneSignalPushNotificationService, {
  OneSignalDispatchResult
} from "./SendOneSignalPushNotificationService";

/**
 * Disparo controlado pelo mesmo serviço de produção (diagnóstico interno).
 * Não expõe rota HTTP — usar em testes/scripts locais apenas.
 */
const DispatchDirectedOneSignalTestPushService = async (params: {
  companyId: number;
  userId: number;
  title?: string;
  body?: string;
}): Promise<OneSignalDispatchResult> => {
  const { companyId, userId } = params;
  const externalId = String(userId);

  logger.info(
    {
      eventType: "onesignal_directed_test",
      companyId,
      recipientCount: 1,
      phase: "test_dispatch_started"
    },
    "[OneSignalPush]"
  );

  return SendOneSignalPushNotificationService({
    eventType: "onesignal_directed_test",
    preferenceCategory: null,
    companyId,
    ticketId: null,
    applyActiveTicketViewFilter: false,
    recipientUserIds: [userId],
    title: params.title || "Teste StreamHUB Push",
    body: params.body || "Notificação de diagnóstico dirigida",
    data: {
      type: "onesignal_directed_test",
      companyId,
      targetUrl: "/",
      meta: { externalId }
    }
  });
};

export default DispatchDirectedOneSignalTestPushService;
