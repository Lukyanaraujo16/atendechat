import { formatBytesPtBr } from "./companyStorage";

/** Resposta mínima para GET /company-media quando não há dados ou ocorreu falha tratada. */
export function buildEmptyCompanyMediaListResponse(options?: { error?: boolean }): {
  items: unknown[];
  count: number;
  hasMore: boolean;
  summary: {
    totalBytes: number;
    imageBytes: number;
    videoBytes: number;
    audioBytes: number;
    documentBytes: number;
    otherBytes: number;
    totalFormatted: string;
    imageFormatted: string;
    videoFormatted: string;
    audioFormatted: string;
    documentFormatted: string;
    otherFormatted: string;
  };
  error?: boolean;
} {
  const z = formatBytesPtBr(0);
  const summary = {
    totalBytes: 0,
    imageBytes: 0,
    videoBytes: 0,
    audioBytes: 0,
    documentBytes: 0,
    otherBytes: 0,
    totalFormatted: z,
    imageFormatted: z,
    videoFormatted: z,
    audioFormatted: z,
    documentFormatted: z,
    otherFormatted: z
  };
  return {
    items: [],
    count: 0,
    hasMore: false,
    summary,
    ...(options?.error ? { error: true } : {})
  };
}
