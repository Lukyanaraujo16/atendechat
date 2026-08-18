import {
  aggregateParticipantShape,
  analyzeSpikeGroups,
  buildMaskedStructuralSample,
  containsFullPhoneInJson,
  describeMaskedField,
  isLidJid,
  isPnJid,
  loadLidToPnUserMapFromSessionJson,
  maskJid,
  maskPhone,
  resolveSpikeParticipant,
  wrapReadOnlySignalKeyStore,
  type SpikeGroupInput,
  type SpikeParticipantInput
} from "../groupParticipantResolutionSpike";

describe("groupParticipantResolutionSpike", () => {
  const sessionMap = new Map<string, string>([
    ["123456789012345", "5511999887766"]
  ]);

  it("resolve participante por phoneNumber", () => {
    const participant: SpikeParticipantInput = {
      id: "123456789012345@lid",
      phoneNumber: "5511888777666@s.whatsapp.net"
    };

    const result = resolveSpikeParticipant(participant, sessionMap);
    expect(result.category).toBe("withPhoneNumberField");
    expect(result.resolvedPhone).toBe("5511888777666");
  });

  it("resolve participante por PN explícito no id", () => {
    const participant: SpikeParticipantInput = {
      id: "5511888777666@s.whatsapp.net"
    };

    const result = resolveSpikeParticipant(participant, sessionMap);
    expect(result.category).toBe("withPnId");
    expect(result.resolvedPhone).toBe("5511888777666");
  });

  it("resolve participante por lid-mapping da sessão", () => {
    const participant: SpikeParticipantInput = {
      id: "123456789012345@lid"
    };

    const result = resolveSpikeParticipant(participant, sessionMap);
    expect(result.category).toBe("lidResolvedByMapping");
    expect(result.resolvedPhone).toBe("5511999887766");
  });

  it("resolve participante por runtime key store quando sessão não tem entrada", () => {
    const participant: SpikeParticipantInput = {
      id: "999888777666555@lid"
    };
    const runtimeMap = new Map<string, string>([
      ["999888777666555", "5511777666555"]
    ]);

    const result = resolveSpikeParticipant(participant, new Map(), {
      runtimeLidToPn: runtimeMap
    });
    expect(result.category).toBe("lidResolvedByRuntimeKeyStore");
    expect(result.resolvedPhone).toBe("5511777666555");
  });

  it("classifica participante LID sem resolução", () => {
    const participant: SpikeParticipantInput = {
      id: "111222333444555@lid"
    };

    const result = resolveSpikeParticipant(participant, new Map());
    expect(result.category).toBe("unresolvedLid");
    expect(result.resolvedPhone).toBeNull();
  });

  it("agrega shapes distintos entre resolvidos e não resolvidos", () => {
    const groups: SpikeGroupInput[] = [
      {
        groupJid: "120363001001001001@g.us",
        addressingMode: "lid",
        participants: [
          {
            id: "123456789012345@lid",
            phoneNumber: "5511888777666@s.whatsapp.net",
            admin: "admin",
            presentKeys: ["id", "phoneNumber", "admin"]
          },
          {
            id: "111222333444555@lid",
            admin: null,
            presentKeys: ["id", "admin"]
          }
        ]
      }
    ];

    const report = analyzeSpikeGroups(groups, sessionMap, {
      sessionJson: JSON.stringify({
        keys: {
          "lid-mapping": {
            "5511999887766": "123456789012345",
            "123456789012345_reverse": "5511999887766"
          }
        }
      }),
      includePhase2: true
    });

    expect(report.phase2?.resolvedShape.hasPhoneNumber).toBe(1);
    expect(report.phase2?.resolvedShape.phoneNumberIsPnJid).toBe(1);
    expect(report.phase2?.unresolvedShape.hasPhoneNumber).toBe(0);
    expect(report.phase2?.unresolvedShape.idIsLid).toBe(1);
    expect(report.phase2?.unresolvedShape.hasAdmin).toBe(0);
  });

  it("mascara JID, telefone e nomes sem expor PII completa", () => {
    expect(maskJid("123456789012345@lid")).toBe("1234****@lid");
    expect(maskPhone("5511999887766")).toBe("5511999****");
    expect(describeMaskedField("notify", "Fulano de Tal")).toEqual(
      expect.objectContaining({
        field: "notify",
        type: "string",
        masked: expect.stringContaining("***")
      })
    );
  });

  it("não inclui telefone completo na saída estruturada agregada", () => {
    const groups: SpikeGroupInput[] = [
      {
        groupJid: "120363001001001001@g.us",
        addressingMode: "lid",
        participants: [
          {
            id: "5511888777666@s.whatsapp.net",
            presentKeys: ["id"]
          }
        ]
      }
    ];

    const report = analyzeSpikeGroups(groups, new Map(), {
      includePhase2: true
    });

    expect(containsFullPhoneInJson(report)).toBe(false);
    expect(isPnJid("5511888777666@s.whatsapp.net")).toBe(true);
    expect(isLidJid("1234@lid")).toBe(true);
  });

  it("gera amostras estruturais mascaradas", () => {
    const sample = buildMaskedStructuralSample({
      id: "123456789012345@lid",
      phoneNumber: "5511888777666@s.whatsapp.net",
      notify: "Nome Completo Secreto"
    });

    expect(sample.find(item => item.field === "id")?.masked).toBe(
      "1234****@lid"
    );
    expect(sample.find(item => item.field === "phoneNumber")?.suffix).toBe(
      "@s.whatsapp.net"
    );
    expect(
      JSON.stringify(sample).includes("Nome Completo Secreto")
    ).toBe(false);
  });

  it("carrega lid-mapping somente via entradas _reverse", () => {
    const sessionJson = JSON.stringify({
      keys: {
        "lid-mapping": {
          "5511999887766": "123456789012345",
          "123456789012345_reverse": "5511999887766",
          "999888777666555_reverse": "5511777666555"
        }
      }
    });

    const map = loadLidToPnUserMapFromSessionJson(sessionJson);
    expect(map.get("123456789012345")).toBe("5511999887766");
    expect(map.get("999888777666555")).toBe("5511777666555");
    expect(map.size).toBe(2);
  });

  it("agrega origem da resolução com percentuais", () => {
    const groups: SpikeGroupInput[] = [
      {
        groupJid: "120363001001001001@g.us",
        addressingMode: "lid",
        participants: [
          { id: "123456789012345@lid", phoneNumber: "5511888777666@s.whatsapp.net" },
          { id: "5511999777666@s.whatsapp.net" },
          { id: "111222333444555@lid" }
        ]
      }
    ];

    const report = analyzeSpikeGroups(groups, sessionMap);
    expect(report.totalParticipants).toBe(3);
    expect(report.withPhoneNumberField).toBe(1);
    expect(report.withPnId).toBe(1);
    expect(report.unresolvedLid).toBe(1);
    expect(report.pctWithPhoneNumberField).toBe(33.33);
    expect(report.pctUnresolvedLid).toBe(33.33);
  });

  it("shape agregado marca campos ausentes em unresolved LID", () => {
    const shape = aggregateParticipantShape({
      id: "111222333444555@lid",
      presentKeys: ["id", "admin"]
    });

    expect(shape.hasId).toBe(1);
    expect(shape.idIsLid).toBe(1);
    expect(shape.hasPhoneNumber).toBe(0);
    expect(shape.hasLidField).toBe(0);
  });

  it("wrapReadOnlySignalKeyStore não encaminha keys.set", () => {
    const calls: unknown[] = [];
    const wrapped = wrapReadOnlySignalKeyStore(
      {
        get: (type: string, ids: string[]) => ({ type, ids }),
        set: (data: Record<string, unknown>) => {
          calls.push(data);
        }
      },
      types => {
        expect(types).toEqual(["lid-mapping"]);
      }
    );

    wrapped.set({ "lid-mapping": { "123_reverse": "hidden" } });
    expect(calls).toEqual([]);
    expect(wrapped.get("lid-mapping", ["123_reverse"])).toEqual({
      type: "lid-mapping",
      ids: ["123_reverse"]
    });
  });
});
