import {
  normalizeGroupParticipantFromMetadata,
  normalizeGroupParticipantsFromMetadata,
  uniqueResolvedPhones
} from "../groupParticipantFromMetadata";
import { buildGroupParticipantsPreview } from "../../services/GroupServices/buildGroupParticipantsPreview";
import {
  buildGroupParticipantsCsv,
  EXPORT_STATUS_AVAILABLE,
  EXPORT_STATUS_UNAVAILABLE
} from "../../services/GroupServices/buildGroupParticipantsCsv";
import { importResolvedGroupParticipants } from "../../services/GroupServices/importResolvedGroupParticipants";
import AppError from "../../errors/AppError";

describe("group participants V1 (metadata only)", () => {
  it("resolve telefone por phoneNumber e nunca por LID", () => {
    const withPhone = normalizeGroupParticipantFromMetadata({
      id: "123456789012345@lid",
      phoneNumber: "5511999887766@s.whatsapp.net",
      notify: "Ana"
    });
    expect(withPhone.phone).toBe("5511999887766");
    expect(withPhone.status).toBe("available");
    expect(withPhone.displayName).toBe("Ana");

    const lidOnly = normalizeGroupParticipantFromMetadata({
      id: "123456789012345@lid"
    });
    expect(lidOnly.phone).toBeNull();
    expect(lidOnly.status).toBe("unavailable");

    const phoneLikeLid = normalizeGroupParticipantFromMetadata({
      id: "5511999887766@lid"
    });
    expect(phoneLikeLid.phone).toBeNull();
    expect(phoneLikeLid.status).toBe("unavailable");
  });

  it("resolve telefone por id PN explícito", () => {
    const participant = normalizeGroupParticipantFromMetadata({
      id: "5511888777666@s.whatsapp.net"
    });
    expect(participant.phone).toBe("5511888777666");
    expect(participant.status).toBe("available");
  });

  it("monta preview com existentes e novos", () => {
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "A" },
      { id: "5511888777666@s.whatsapp.net", notify: "B" },
      { id: "111222333444555@lid" }
    ]);
    const preview = buildGroupParticipantsPreview(
      "Grupo Teste",
      participants,
      new Set(["5511999887766"])
    );

    expect(preview.totalParticipants).toBe(3);
    expect(preview.withPhone).toBe(2);
    expect(preview.withoutPhone).toBe(1);
    expect(preview.existingContacts).toBe(1);
    expect(preview.newContacts).toBe(1);
    expect(preview.importableCount).toBe(1);
  });

  it("exporta CSV sem usar LID como telefone", () => {
    const participants = normalizeGroupParticipantsFromMetadata([
      {
        id: "123456789012345@lid",
        phoneNumber: "5511999887766@s.whatsapp.net",
        notify: "Ana"
      },
      { id: "111222333444555@lid" }
    ]);
    const csv = buildGroupParticipantsCsv(participants);

    expect(csv).toContain("Nome;Telefone;Status");
    expect(csv).toContain("Ana");
    expect(csv).toContain("5511999887766");
    expect(csv).toContain(EXPORT_STATUS_AVAILABLE);
    expect(csv).toContain(EXPORT_STATUS_UNAVAILABLE);
    expect(csv).not.toContain("111222333444555");
    expect(csv).not.toContain("@lid");
  });

  it("importa somente telefones novos e não duplica", async () => {
    const created: Array<{ number: string; companyId: number }> = [];
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "Ana" },
      { id: "5511888777666@s.whatsapp.net", notify: "Bruno" },
      { id: "111222333444555@lid" }
    ]);

    const first = await importResolvedGroupParticipants({
      companyId: 19,
      userId: 7,
      participants,
      existingPhones: new Set(["5511999887766"]),
      createContact: async params => {
        created.push({ number: params.number, companyId: params.companyId });
        return { id: created.length } as never;
      }
    });

    expect(first.imported).toBe(1);
    expect(first.skippedExisting).toBe(1);
    expect(first.skippedNoPhone).toBe(1);
    expect(first.importableCount).toBe(1);
    expect(created).toEqual([{ number: "5511888777666", companyId: 19 }]);

    const second = await importResolvedGroupParticipants({
      companyId: 19,
      userId: 7,
      participants,
      existingPhones: new Set(["5511999887766", "5511888777666"]),
      createContact: async params => {
        created.push({ number: params.number, companyId: params.companyId });
        return { id: created.length } as never;
      }
    });

    expect(second.imported).toBe(0);
    expect(second.skippedExisting).toBe(2);
    expect(created).toHaveLength(1);
  });

  it("não mistura telefones de outra empresa no conjunto existente", () => {
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net" }
    ]);
    const otherCompanyExisting = new Set<string>();
    const preview = buildGroupParticipantsPreview(
      "Grupo",
      participants,
      otherCompanyExisting
    );
    expect(preview.existingContacts).toBe(0);
    expect(preview.newContacts).toBe(1);
    expect(uniqueResolvedPhones(participants)).toEqual(["5511999887766"]);
  });

  it("CSV com nome perigoso não vira fórmula", () => {
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "=CMD|'/c calc'!A0" },
      { id: "5511888777666@s.whatsapp.net", notify: "+1234" },
      { id: "5511777666555@s.whatsapp.net", notify: "-2+3" },
      { id: "5511666555444@s.whatsapp.net", notify: "@SUM(A1)" }
    ]);
    const csv = buildGroupParticipantsCsv(participants);
    const dataLines = csv.replace(/^\uFEFF/, "").split("\r\n").slice(1);
    for (const line of dataLines) {
      expect(line.startsWith("=") || line.startsWith("+") || line.startsWith("-") || line.startsWith("@")).toBe(false);
      expect(line.startsWith("'")).toBe(true);
    }
    expect(csv).toContain("'=CMD|'/c calc'!A0");
    expect(csv).toContain("'+1234");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1)");
  });

  it("duplicidade durante importação não aborta o lote", async () => {
    const created: string[] = [];
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "Ana" },
      { id: "5511888777666@s.whatsapp.net", notify: "Bruno" },
      { id: "5511777666555@s.whatsapp.net", notify: "Carla" }
    ]);

    const result = await importResolvedGroupParticipants({
      companyId: 19,
      userId: 7,
      participants,
      existingPhones: new Set(),
      concurrency: 3,
      createContact: async params => {
        if (params.number === "5511888777666") {
          throw new AppError("ERR_DUPLICATED_CONTACT");
        }
        created.push(params.number);
        return { id: created.length } as never;
      }
    });

    expect(created.sort()).toEqual(["5511777666555", "5511999887766"]);
    expect(result.imported).toBe(2);
    expect(result.skippedExisting).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("falha em um contato não impede os próximos", async () => {
    const created: string[] = [];
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "Ana" },
      { id: "5511888777666@s.whatsapp.net", notify: "Bruno" },
      { id: "5511777666555@s.whatsapp.net", notify: "Carla" }
    ]);

    const result = await importResolvedGroupParticipants({
      companyId: 19,
      userId: 7,
      participants,
      existingPhones: new Set(),
      concurrency: 2,
      createContact: async params => {
        if (params.number === "5511888777666") {
          throw new Error("db down");
        }
        created.push(params.number);
        return { id: created.length } as never;
      }
    });

    expect(created.sort()).toEqual(["5511777666555", "5511999887766"]);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.skippedExisting).toBe(0);
    expect(result.skippedNoPhone).toBe(0);
  });

  it("participantes repetidos não criam duplicatas", async () => {
    const created: string[] = [];
    const participants = normalizeGroupParticipantsFromMetadata([
      { id: "5511999887766@s.whatsapp.net", notify: "Ana" },
      { id: "5511999887766@s.whatsapp.net", notify: "Ana 2" },
      { id: "111222333444555@lid" }
    ]);

    const result = await importResolvedGroupParticipants({
      companyId: 19,
      userId: 7,
      participants,
      existingPhones: new Set(),
      createContact: async params => {
        created.push(params.number);
        return { id: created.length } as never;
      }
    });

    expect(created).toEqual(["5511999887766"]);
    expect(result.imported).toBe(1);
    expect(result.skippedNoPhone).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.importableCount).toBe(1);
  });
});
