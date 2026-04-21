import type Whatsapp from "../models/Whatsapp";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        profile: string;
        companyId: number | null;
        supportMode?: boolean;
        supportHomeCompanyId?: number | null;
      };
      apiWhatsapp?: Whatsapp;
    }
  }
}

export {};
