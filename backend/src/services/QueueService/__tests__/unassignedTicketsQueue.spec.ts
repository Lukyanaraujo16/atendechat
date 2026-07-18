/**
 * Testes de serviço de configuração do setor de contingência
 * (sem DB — valida contratos de erro e helpers).
 */
import AppError from "../../../errors/AppError";

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    to: () => ({ emit: jest.fn() })
  }))
}));

import Company from "../../../models/Company";
import Queue from "../../../models/Queue";
import SetCompanyUnassignedTicketsQueueService from "../SetCompanyUnassignedTicketsQueueService";

describe("SetCompanyUnassignedTicketsQueueService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("limpa a configuração quando queueId é null", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      unassignedTicketsQueueId: 5,
      update
    });

    const result = await SetCompanyUnassignedTicketsQueueService({
      companyId: 1,
      queueId: null
    });

    expect(result).toBeNull();
    expect(update).toHaveBeenCalledWith(
      { unassignedTicketsQueueId: null },
      expect.anything()
    );
  });

  it("rejeita fila de outra empresa", async () => {
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      unassignedTicketsQueueId: null,
      update: jest.fn()
    });
    (Queue.findByPk as jest.Mock).mockResolvedValue({
      id: 9,
      companyId: 99
    });

    await expect(
      SetCompanyUnassignedTicketsQueueService({ companyId: 1, queueId: 9 })
    ).rejects.toMatchObject({
      message: "ERR_UNASSIGNED_TICKETS_QUEUE_INVALID_COMPANY"
    });
  });

  it("rejeita fila inexistente", async () => {
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      unassignedTicketsQueueId: null,
      update: jest.fn()
    });
    (Queue.findByPk as jest.Mock).mockResolvedValue(null);

    await expect(
      SetCompanyUnassignedTicketsQueueService({ companyId: 1, queueId: 9 })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("substitui a configuração pelo novo setor", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (Company.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      unassignedTicketsQueueId: 3,
      update
    });
    (Queue.findByPk as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1
    });

    const result = await SetCompanyUnassignedTicketsQueueService({
      companyId: 1,
      queueId: 7
    });

    expect(result).toBe(7);
    expect(update).toHaveBeenCalledWith(
      { unassignedTicketsQueueId: 7 },
      expect.anything()
    );
  });
});
