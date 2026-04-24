import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";
import Company from "./models/Company";
import { startQueueProcess } from "./queues";
import { TransferTicketQueue } from "./wbotTransferTicketQueue";
import cron from "node-cron";
import { startBackupAutoScheduler } from "./jobs/backupAutoScheduler";
import { startBillingAutomationScheduler } from "./jobs/billingAutomationScheduler";
import { startSignupCriticalSocketScheduler } from "./jobs/signupCriticalSocketScheduler";
import { logWhatsAppPolicyAtProcessBoot } from "./helpers/whatsappUnavailablePresence";

const server = app.listen(process.env.PORT, async () => {
  const companies = await Company.findAll();
  const allPromises: any[] = [];
  companies.map(async c => {
    const promise = StartAllWhatsAppsSessions(c.id);
    allPromises.push(promise);
  });

  Promise.all(allPromises).then(() => {
    startQueueProcess();
  });
  logger.info(`Server started on port: ${process.env.PORT}`);
  logWhatsAppPolicyAtProcessBoot();
  logger.info(
    "Super Admin API: GET/POST /platform/super-admins · PUT /platform/super-admins/:userId " +
      "(e o mesmo sob prefixo /api, ex. POST /api/platform/super-admins). " +
      "Se aparecer «Cannot POST /platform/super-admins», faça «npm run build» e reinicie o Node com este código."
  );
  startBackupAutoScheduler();
  startBillingAutomationScheduler();
  startSignupCriticalSocketScheduler();
});

cron.schedule("* * * * *", async () => {

  try {
    // console.log("Running a job at 01:00 at America/Sao_Paulo timezone")
    logger.info(`Serviço de transferencia de tickets iniciado`);

    await TransferTicketQueue();
  }
  catch (error) {
    logger.error(error);
  }

});

initIO(server);
gracefulShutdown(server);
