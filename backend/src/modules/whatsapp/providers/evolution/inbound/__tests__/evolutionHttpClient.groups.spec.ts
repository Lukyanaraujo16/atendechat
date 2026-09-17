/* eslint-disable import/first */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const findOneCred = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: (...a: unknown[]) => mockGet(...a),
      post: (...a: unknown[]) => mockPost(...a),
      delete: (...a: unknown[]) => mockDelete(...a)
    }))
  }
}));

jest.mock("../../../../../../helpers/evolutionCredentialCrypto", () => ({
  decryptEvolutionApiKey: () => "fixture-connection-apikey"
}));

jest.mock("../../../../../../models/WhatsappEvolutionCredential", () => ({
  __esModule: true,
  default: {
    unscoped: () => ({
      findOne: (...a: unknown[]) => findOneCred(...a)
    })
  }
}));

import axios from "axios";
import {
  evolutionAcceptGroupInvite,
  evolutionCreateGroup,
  evolutionFetchAllGroups,
  evolutionFindGroupInfos,
  evolutionLeaveGroup
} from "../evolutionHttpClient";

describe("evolutionHttpClient groups 2.3.7", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOneCred.mockResolvedValue({
      baseUrl: "https://evo.example.com",
      instanceName: "streamhub-c1-w3",
      apiKeyEncrypted: "evo1:encrypted-fixture"
    });
  });

  it("fetchAllGroups usa GET e getParticipants=true", async () => {
    mockGet.mockResolvedValue({ status: 200, data: [] });
    await evolutionFetchAllGroups({ whatsappId: 3, getParticipants: true });
    expect(mockGet).toHaveBeenCalledWith(
      "/group/fetchAllGroups/streamhub-c1-w3",
      { params: { getParticipants: "true" } }
    );
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "fixture-connection-apikey"
        })
      })
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(findOneCred).toHaveBeenCalledWith(
      expect.objectContaining({ where: { whatsappId: 3 } })
    );
  });

  it("findGroupInfos envia groupJid na query", async () => {
    mockGet.mockResolvedValue({ status: 200, data: { id: "120363@g.us" } });
    await evolutionFindGroupInfos({
      whatsappId: 3,
      groupJid: "120363111222333@g.us"
    });
    expect(mockGet).toHaveBeenCalledWith(
      "/group/findGroupInfos/streamhub-c1-w3",
      { params: { groupJid: "120363111222333@g.us" } }
    );
  });

  it("createGroup POST com participantes só dígitos", async () => {
    mockPost.mockResolvedValue({
      status: 201,
      data: { id: "120363999@g.us", subject: "Novo" }
    });
    await evolutionCreateGroup({
      whatsappId: 3,
      subject: "Novo",
      participants: ["5511999887766"]
    });
    expect(mockPost).toHaveBeenCalledWith("/group/create/streamhub-c1-w3", {
      subject: "Novo",
      participants: ["5511999887766"]
    });
  });

  it("acceptInvite é GET com inviteCode, não PUT", async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: { accepted: true, groupJid: "120363888@g.us" }
    });
    await evolutionAcceptGroupInvite({
      whatsappId: 3,
      inviteCode: "F1EX5QZxO181L3TMVP31gY"
    });
    expect(mockGet).toHaveBeenCalledWith(
      "/group/acceptInviteCode/streamhub-c1-w3",
      { params: { inviteCode: "F1EX5QZxO181L3TMVP31gY" } }
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("leaveGroup DELETE com groupJid no body", async () => {
    mockDelete.mockResolvedValue({ status: 200, data: { leave: true } });
    await evolutionLeaveGroup({
      whatsappId: 3,
      groupJid: "120363888@g.us"
    });
    expect(mockDelete).toHaveBeenCalledWith(
      "/group/leaveGroup/streamhub-c1-w3",
      { data: { groupJid: "120363888@g.us" } }
    );
  });

  it("fetchAllGroups getParticipants=false envia string false", async () => {
    mockGet.mockResolvedValue({ status: 200, data: [] });
    await evolutionFetchAllGroups({ whatsappId: 3, getParticipants: false });
    expect(mockGet).toHaveBeenCalledWith(
      "/group/fetchAllGroups/streamhub-c1-w3",
      { params: { getParticipants: "false" } }
    );
  });
});
