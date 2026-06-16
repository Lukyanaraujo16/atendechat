import crypto from "crypto";

export const verifyMetaWebhookSignature = (
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean => {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const received = signatureHeader.slice("sha256=".length);
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  try {
    const receivedBuf = Buffer.from(received, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    return false;
  }
};

export const hashPayloadForEventId = (payload: unknown): string =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
