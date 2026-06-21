import cron from "node-cron";
import { Op } from "sequelize";
import InstagramAccount from "../models/InstagramAccount";
import { hasEncryptedMetaToken } from "../helpers/metaTokenCrypto";
import RefreshInstagramOAuthAccountService from "../services/InstagramAccountService/RefreshInstagramOAuthAccountService";
import {
  computeInstagramOAuthRefreshMeta,
  INSTAGRAM_OAUTH_REFRESH_THRESHOLD_DAYS,
  REFRESHABLE_INSTAGRAM_STATUSES
} from "../services/InstagramAccountService/instagramOAuthRefreshMeta";
import { logger } from "../utils/logger";

const LOG_PREFIX = "[InstagramOAuthRefresh]";

export const runRefreshInstagramOAuthTokensJob = async (): Promise<{
  scanned: number;
  due: number;
  refreshed: number;
  failed: number;
  skipped: number;
}> => {
  logger.info(`${LOG_PREFIX} job_started`);

  const threshold = new Date(
    Date.now() + INSTAGRAM_OAUTH_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
  );

  const candidates = await InstagramAccount.findAll({
    where: {
      connectedVia: "instagram_login",
      status: { [Op.in]: [...REFRESHABLE_INSTAGRAM_STATUSES] },
      tokenExpiresAt: {
        [Op.lte]: threshold,
        [Op.ne]: null
      },
      pageAccessToken: { [Op.ne]: null }
    },
    order: [["tokenExpiresAt", "ASC"]]
  });

  let due = 0;
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (!hasEncryptedMetaToken(candidate.pageAccessToken)) {
      skipped += 1;
      continue;
    }

    const meta = computeInstagramOAuthRefreshMeta(candidate);
    if (!meta.refreshDue || !meta.canRefresh) {
      skipped += 1;
      continue;
    }

    due += 1;

    logger.info(
      {
        instagramAccountId: candidate.id,
        companyId: candidate.companyId,
        daysUntilExpiration: meta.daysUntilExpiration
      },
      `${LOG_PREFIX} account_due`
    );

    try {
      const result = await RefreshInstagramOAuthAccountService({
        instagramAccountId: candidate.id,
        force: false
      });

      if (result.refreshed) {
        refreshed += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  logger.info(
    {
      scanned: candidates.length,
      due,
      refreshed,
      failed,
      skipped
    },
    `${LOG_PREFIX} job_finished`
  );

  return {
    scanned: candidates.length,
    due,
    refreshed,
    failed,
    skipped
  };
};

let running = false;

/** Diário — renova tokens OAuth que expiram em até 7 dias. */
export const startRefreshInstagramOAuthTokensScheduler = (): void => {
  cron.schedule("0 6 * * *", async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await runRefreshInstagramOAuthTokensJob();
    } catch (err) {
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        `${LOG_PREFIX} job_failed`
      );
    } finally {
      running = false;
    }
  });
};
