import { Request, Response, NextFunction } from "express";
import { getAgentOsSecurityConfig } from "../services/AutomationOrchestrator/security/AgentOsSecurityConfig";

/**
 * Security headers para superfícies AgentOS / app.
 */
export default function agentOsSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const cfg = getAgentOsSecurityConfig().securityHeaders;
  res.setHeader("X-Content-Type-Options", cfg.contentTypeOptions);
  res.setHeader("X-Frame-Options", cfg.frameOptions);
  res.setHeader("Referrer-Policy", cfg.referrerPolicy);
  res.setHeader("Permissions-Policy", cfg.permissionsPolicy);
  res.setHeader("X-XSS-Protection", "0");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      `max-age=${cfg.hstsMaxAgeSeconds}; includeSubDomains`
    );
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
}
