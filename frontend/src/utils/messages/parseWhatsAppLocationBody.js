/**
 * Parseia o body de localização WhatsApp (Baileys e Evolution).
 * Detecta conteúdo (URL absoluta, coordenadas, thumbnail), sem depender
 * só da posição dos campos separados por "|".
 */

const DATA_URI_PATTERN = /^data:image\//i;
const HTTP_URL_IN_TEXT = /https?:\/\/[^\s|<>"']+/i;
const COORD_PATTERN = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
const MAPS_HOST_PATTERN = /(?:google\.[^/]+\/maps|maps\.google|openstreetmap\.org)/i;

export function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_err) {
    return false;
  }
}

export function isDataImageUri(value) {
  return DATA_URI_PATTERN.test(String(value || "").trim());
}

export function parseGeoCoordinates(value) {
  const match = String(value || "").trim().match(COORD_PATTERN);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function buildGoogleMapsUrl(lat, lng) {
  return `https://maps.google.com/maps?q=${lat}%2C${lng}&z=17&hl=pt-BR`;
}

function extractHttpUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (isAbsoluteHttpUrl(text)) return text;
  const embedded = text.match(HTTP_URL_IN_TEXT);
  if (embedded && isAbsoluteHttpUrl(embedded[0])) {
    return embedded[0];
  }
  return null;
}

function isLikelyMapsUrl(url) {
  return MAPS_HOST_PATTERN.test(String(url || ""));
}

function isSafeLocationThumbnail(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (isDataImageUri(text)) return true;
  if (!isAbsoluteHttpUrl(text)) return false;
  if (isLikelyMapsUrl(text)) return false;
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(text);
}

function leftoverDescription(part, extractedUrl) {
  let leftover = String(part || "");
  if (extractedUrl) {
    leftover = leftover.replace(extractedUrl, "");
  }
  leftover = leftover.replace(/\|/g, " ").trim();
  if (!leftover) return null;
  if (parseGeoCoordinates(leftover)) return null;
  if (isDataImageUri(leftover)) return null;
  if (isAbsoluteHttpUrl(leftover)) return null;
  return leftover;
}

/**
 * @param {string|null|undefined} body
 * @returns {{ thumbnail: string|null, mapsUrl: string|null, coords: {lat:number,lng:number}|null, description: string|null }}
 */
export function parseWhatsAppLocationBody(body) {
  const parts = String(body || "")
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part !== "");

  let thumbnail = null;
  let mapsUrl = null;
  let coords = null;
  let description = null;

  parts.forEach((part) => {
    if (!thumbnail && isDataImageUri(part)) {
      thumbnail = part;
      return;
    }

    const url = extractHttpUrl(part);
    if (url && isAbsoluteHttpUrl(url)) {
      if (!thumbnail && isSafeLocationThumbnail(url)) {
        thumbnail = url;
      } else if (!mapsUrl || isLikelyMapsUrl(url)) {
        mapsUrl = url;
      }
      if (!description) {
        description = leftoverDescription(part, url);
      }
      return;
    }

    const parsedCoords = parseGeoCoordinates(part);
    if (parsedCoords && !coords) {
      coords = parsedCoords;
      return;
    }

    if (!description && leftoverDescription(part, null)) {
      description = leftoverDescription(part, null);
    }
  });

  if (!mapsUrl && coords) {
    mapsUrl = buildGoogleMapsUrl(coords.lat, coords.lng);
  }

  if (mapsUrl && !isAbsoluteHttpUrl(mapsUrl)) {
    mapsUrl = null;
  }

  if (thumbnail && !isSafeLocationThumbnail(thumbnail)) {
    thumbnail = null;
  }

  return { thumbnail, mapsUrl, coords, description };
}

export default parseWhatsAppLocationBody;
