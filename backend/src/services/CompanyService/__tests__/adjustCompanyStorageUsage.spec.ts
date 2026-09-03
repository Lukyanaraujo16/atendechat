/* eslint-disable import/first */
const sequelizeQuery = jest.fn();
const findCompany = jest.fn();

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    query: (...a: unknown[]) => sequelizeQuery(...a)
  }
}));

jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: {
    findByPk: (...a: unknown[]) => findCompany(...a),
    update: jest.fn()
  }
}));

jest.mock("../../../models/Plan", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock("../CreateCompanyStorageSnapshotService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock(
  "../../UserNotificationService/CreateUserNotificationService",
  () => ({
    __esModule: true,
    default: jest.fn()
  })
);
jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { incrementCompanyStorageUsage } from "../adjustCompanyStorageUsage";

describe("incrementCompanyStorageUsage — tabela Companies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelizeQuery.mockResolvedValue([undefined, 1]);
    findCompany.mockResolvedValue(null);
  });

  it('atualiza "Companies" (quoted), não a relação inexistente companies', async () => {
    await incrementCompanyStorageUsage(1, 4096);
    expect(sequelizeQuery).toHaveBeenCalled();
    const sql = String(sequelizeQuery.mock.calls[0][0]);
    expect(sql).toContain('"Companies"');
    expect(sql).toMatch(/UPDATE\s+"Companies"\s+SET/);
    expect(sql.toLowerCase()).not.toContain("update companies set");
  });
});
