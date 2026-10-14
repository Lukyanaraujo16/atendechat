import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  assertEfiAuthTestRateLimit,
  getEfiIntegrationStatus,
  testEfiCobrancasAuthentication
} from "../services/SaasBilling/efiIntegrationStatus";

/**
 * GET /saas/finance/efi/status — diagnóstico da integração (Super Admin).
 * Nunca retorna secrets, tokens ou caminhos de certificado.
 */
export const status = async (req: Request, res: Response): Promise<Response> => {
  const dto = getEfiIntegrationStatus();
  return res.status(200).json(dto);
};

/**
 * POST /saas/finance/efi/test-auth — OAuth Cobranças apenas (Super Admin).
 * Não cria cobranças; Pix isolado marcado como indisponível.
 */
export const testAuth = async (req: Request, res: Response): Promise<Response> => {
  const userId = Number(req.user?.id);
  if (!Number.isFinite(userId)) {
    throw new AppError("Acesso não permitido", 401);
  }

  const limit = assertEfiAuthTestRateLimit(userId);
  if (!limit.allowed) {
    throw new AppError(
      `Muitas tentativas de teste. Aguarde ${limit.retryAfterSec || 60}s.`,
      429
    );
  }

  const cobrancas = await testEfiCobrancasAuthentication();

  return res.status(200).json({
    cobrancas,
    pix: {
      available: false,
      tested: false,
      message:
        "Teste de autenticação Pix isolado indisponível: o SDK não oferece OAuth sem chamada de API. " +
        "Não foi gerada cobrança Pix. Use o resultado Cobranças para Client ID/Secret e o status para o P12."
    }
  });
};
