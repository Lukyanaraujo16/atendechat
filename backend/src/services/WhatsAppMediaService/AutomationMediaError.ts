export type AutomationMediaErrorCode =
  | "invalid_url"
  | "ssrf"
  | "timeout"
  | "http_status"
  | "too_large"
  | "download_failed"
  | "prepare_failed";

export class AutomationMediaError extends Error {
  readonly code: AutomationMediaErrorCode;

  readonly httpStatus?: number;

  readonly reason?: string;

  constructor(
    code: AutomationMediaErrorCode,
    message: string,
    extra?: { httpStatus?: number; reason?: string }
  ) {
    super(message);
    this.name = "AutomationMediaError";
    this.code = code;
    this.httpStatus = extra?.httpStatus;
    this.reason = extra?.reason;
  }
}
