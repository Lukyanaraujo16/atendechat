import { calculateCompanyMediaTotalBytes } from "../CompanyMediaService/ListCompanyMediaService";
import { logger } from "../../utils/logger";

const CalculateCompanyStorageUsageService = async (
  companyId: number
): Promise<number> => {
  try {
    const { totalBytes } = await calculateCompanyMediaTotalBytes(companyId);
    return totalBytes;
  } catch (err) {
    logger.error(
      {
        companyId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[CompanyStorage] calculate failed"
    );
    // Não devolver 0: zeraria o consumo persistido e esconderia a cota excedida.
    throw err;
  }
};

export default CalculateCompanyStorageUsageService;
