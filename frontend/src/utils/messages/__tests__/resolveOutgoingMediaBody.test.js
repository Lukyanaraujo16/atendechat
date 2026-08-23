/**
 * @jest-environment jsdom
 *
 * Contrato do body no envio de mídia pelo painel (FormData → POST /messages/:id).
 */
import fs from "fs";
import path from "path";
import {
  appendOutgoingMediaFormData,
  resolveOutgoingMediaBody,
} from "../resolveOutgoingMediaBody";

function media(name, type) {
  return { name, type };
}

function collectBodies(formData) {
  if (typeof formData.getAll === "function") {
    return formData.getAll("body");
  }
  return [formData.get("body")];
}

describe("resolveOutgoingMediaBody — envio pelo painel", () => {
  it("PNG sem caption → body não recebe filename", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("foto.png", "image/png"),
      })
    ).toBe("");
  });

  it("JPG sem caption → body não recebe filename", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("foto.jpg", "image/jpg"),
      })
    ).toBe("");
  });

  it("JPEG sem caption → body não recebe filename", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("foto.jpeg", "image/jpeg"),
      })
    ).toBe("");
  });

  it("filename com espaços sem caption → não vira body", () => {
    const name = "Captura de Tela 2026-08-22 às 20.55.15.png";
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "   ",
        media: media(name, "image/png"),
      })
    ).toBe("");
  });

  it("filename longo WhatsApp → não vira body", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("IMG-20260822-WA0012.jpg", "image/jpeg"),
      })
    ).toBe("");
  });

  it("imagem com caption → body recebe caption", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "Comprovante do pagamento",
        media: media(
          "Captura de Tela 2026-08-22 às 20.55.15.png",
          "image/png"
        ),
      })
    ).toBe("Comprovante do pagamento");
  });

  it("caption contendo .jpg permanece", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "Meu arquivo é foto.jpg",
        media: media("foto.png", "image/png"),
      })
    ).toBe("Meu arquivo é foto.jpg");

    expect(
      resolveOutgoingMediaBody({
        typedCaption: "imagem.png enviada ontem",
        media: media("arquivo.png", "image/png"),
      })
    ).toBe("imagem.png enviada ontem");
  });

  it("documento mantém contrato atual de filename", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("contrato.pdf", "application/pdf"),
      })
    ).toBe("contrato.pdf");

    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("planilha.xlsx", "application/vnd.ms-excel"),
      })
    ).toBe("planilha.xlsx");
  });

  it("vídeo sem caption mantém filename (fora desta rodada)", () => {
    expect(
      resolveOutgoingMediaBody({
        typedCaption: "",
        media: media("clip.mp4", "video/mp4"),
      })
    ).toBe("clip.mp4");
  });
});

describe("appendOutgoingMediaFormData — payload de envio", () => {
  it("envia a mídia e body vazio para imagem sem caption (incluindo espaços)", () => {
    const file = media(
      "Captura de Tela 2026-08-22 às 20.55.15.png",
      "image/png"
    );
    const formData = appendOutgoingMediaFormData(new FormData(), {
      medias: [file],
      typedCaption: "",
      isInstagramChannel: false,
    });

    expect(formData.get("fromMe")).toBe("true");
    expect(formData.get("medias")).toBeTruthy();
    expect(collectBodies(formData)).toEqual([""]);
    expect(file.name).toBe("Captura de Tela 2026-08-22 às 20.55.15.png");
  });

  it("foto.png / JPEG WhatsApp / minha foto.jpeg sem caption não vão no body", () => {
    const files = [
      media("foto.png", "image/png"),
      media("IMG-20260822-WA0012.jpg", "image/jpeg"),
      media("minha foto.jpeg", "image/jpeg"),
    ];
    const formData = appendOutgoingMediaFormData(new FormData(), {
      medias: files,
      typedCaption: "",
      isInstagramChannel: false,
    });
    expect(collectBodies(formData)).toEqual(["", "", ""]);
    expect(formData.getAll("medias").length).toBe(3);
  });

  it("imagem com caption real preenche body e ainda anexa o arquivo", () => {
    const file = media(
      "Captura de Tela 2026-08-22 às 20.55.15.png",
      "image/png"
    );
    const formData = appendOutgoingMediaFormData(new FormData(), {
      medias: [file],
      typedCaption: "Comprovante do pagamento",
      isInstagramChannel: false,
    });
    expect(collectBodies(formData)).toEqual(["Comprovante do pagamento"]);
    expect(formData.get("medias")).toBeTruthy();
  });

  it("documento continua com filename no body e arquivo no FormData", () => {
    const file = media("contrato.pdf", "application/pdf");
    const formData = appendOutgoingMediaFormData(new FormData(), {
      medias: [file],
      typedCaption: "",
      isInstagramChannel: false,
    });
    expect(collectBodies(formData)).toEqual(["contrato.pdf"]);
    expect(formData.get("medias")).toBeTruthy();
  });
});

describe("MessageInputCustom usa o resolver de envio", () => {
  it("handleUploadMedia monta FormData via appendOutgoingMediaFormData", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../../../components/MessageInputCustom/index.js"
      ),
      "utf8"
    );
    expect(src).toContain("appendOutgoingMediaFormData");
    expect(src).toContain("api.post(");
    expect(src).toContain("/messages/");
    expect(src).toContain("formData");
    expect(src).not.toMatch(/inputMessage\.trim\(\)\s*\|\|\s*fallbackBody/);
  });
});
