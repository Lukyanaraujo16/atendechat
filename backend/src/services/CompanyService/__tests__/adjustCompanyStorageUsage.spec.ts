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

  it('atualiza "Companies" e colunas camelCase quoted, sem lowercase unquoted', async () => {
    await incrementCompanyStorageUsage(1, 4096);
    expect(sequelizeQuery).toHaveBeenCalledTimes(1);
    const [sql, options] = sequelizeQuery.mock.calls[0];
    const query = String(sql);
    expect(query).toMatch(/UPDATE\s+"Companies"\s+SET/);
    expect(query).toContain('"storageUsedBytes"');
    expect(query).toContain('"storageCalculatedAt"');
    expect(query).toContain('"updatedAt"');
    expect(query).toMatch(/WHERE\s+"id"\s*=\s*:id/);
    expect(query).toMatch(/GREATEST\(0,\s*"storageUsedBytes"\s*\+\s*:delta\)/);
    expect(query.toLowerCase()).not.toContain("update companies set");
    expect(query).not.toMatch(/(?:^|[^"])storageUsedBytes(?:[^"]|$)/);
    expect(query).not.toMatch(/(?:^|[^"])storageCalculatedAt(?:[^"]|$)/);
    expect(query).not.toMatch(/(?:^|[^"])updatedAt(?:[^"]|$)/);
    expect(options.replacements.delta).toBe(4096);
    expect(options.replacements.id).toBe(1);
    expect(options.replacements.now).toBeInstanceOf(Date);
  });
});
