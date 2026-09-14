/**
 * @jest-environment jsdom
 */
import {
  buildGoogleMapsUrl,
  isAbsoluteHttpUrl,
  parseGeoCoordinates,
  parseWhatsAppLocationBody,
} from "../parseWhatsAppLocationBody";

const EVOLUTION_MAPS =
  "https://maps.google.com/maps?q=-20.370664596557617%2C-40.34754943847656&z=17&hl=pt-BR";
const BAILEYS_MAPS =
  "https://maps.google.com/maps?q=-20.370664596557617%2C-40.34754943847656&z=17&hl=pt-BR";
const COORDS = "-20.370664596557617, -40.34754943847656";
const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseWhatsAppLocationBody", () => {
  it("Evolution mapsUrl|coords abre URL absoluta, não rota de ticket", () => {
    const parsed = parseWhatsAppLocationBody(`${EVOLUTION_MAPS}|${COORDS}`);
    expect(parsed.mapsUrl).toBe(EVOLUTION_MAPS);
    expect(parsed.coords).toEqual({
      lat: -20.370664596557617,
      lng: -40.34754943847656,
    });
    expect(parsed.thumbnail).toBeNull();
    expect(isAbsoluteHttpUrl(parsed.mapsUrl)).toBe(true);
    expect(parsed.mapsUrl).not.toMatch(/^\/tickets\//);
    expect(String(parsed.mapsUrl).startsWith("https://")).toBe(true);
  });

  it("Baileys dataURI|mapsUrl|coords preserva thumbnail e URL absoluta", () => {
    const parsed = parseWhatsAppLocationBody(
      `${THUMB} | ${BAILEYS_MAPS}|${COORDS}`
    );
    expect(parsed.thumbnail).toBe(THUMB);
    expect(parsed.mapsUrl).toBe(BAILEYS_MAPS);
    expect(parsed.coords.lat).toBeCloseTo(-20.370664596557617);
    expect(isAbsoluteHttpUrl(parsed.mapsUrl)).toBe(true);
  });

  it("ausência de thumbnail não quebra o parse", () => {
    const parsed = parseWhatsAppLocationBody(`${EVOLUTION_MAPS}|${COORDS}`);
    expect(parsed.thumbnail).toBeNull();
    expect(parsed.mapsUrl).toBeTruthy();
  });

  it("somente coordenadas gera URL absoluta de mapa", () => {
    const parsed = parseWhatsAppLocationBody(COORDS);
    expect(parsed.coords).toEqual({
      lat: -20.370664596557617,
      lng: -40.34754943847656,
    });
    expect(parsed.mapsUrl).toBe(
      buildGoogleMapsUrl(-20.370664596557617, -40.34754943847656)
    );
    expect(parsed.mapsUrl.startsWith("https://")).toBe(true);
  });

  it("entrada inválida não gera URL de navegação", () => {
    expect(parseWhatsAppLocationBody("").mapsUrl).toBeNull();
    expect(parseWhatsAppLocationBody("olá").mapsUrl).toBeNull();
    expect(parseWhatsAppLocationBody("file:///etc/passwd").mapsUrl).toBeNull();
    expect(parseWhatsAppLocationBody("/tickets/1").mapsUrl).toBeNull();
    expect(parseWhatsAppLocationBody("not-a-coord").mapsUrl).toBeNull();
  });

  it("URL relativa e coordenadas fora de faixa são rejeitadas", () => {
    expect(parseGeoCoordinates("200, 10")).toBeNull();
    expect(parseGeoCoordinates("10, 200")).toBeNull();
    expect(isAbsoluteHttpUrl("-20.37, -40.34")).toBe(false);
    expect(isAbsoluteHttpUrl("/tickets/-20.37, -40.34")).toBe(false);
  });
});
