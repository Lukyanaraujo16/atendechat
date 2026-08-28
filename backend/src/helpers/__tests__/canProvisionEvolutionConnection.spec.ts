jest.mock("../../models/User", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

import User from "../../models/User";
import { canProvisionEvolutionConnection } from "../canProvisionEvolutionConnection";

describe("canProvisionEvolutionConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna false sem userId", async () => {
    expect(await canProvisionEvolutionConnection(null)).toBe(false);
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("Super Admin (super=true) pode provisionar", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({ super: true, profile: "admin" });
    expect(await canProvisionEvolutionConnection(1)).toBe(true);
  });

  it("Super Admin (profile=superadmin) pode provisionar", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      super: false,
      profile: "superadmin"
    });
    expect(await canProvisionEvolutionConnection(2)).toBe(true);
  });

  it("admin tenant não pode provisionar", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      super: false,
      profile: "admin"
    });
    expect(await canProvisionEvolutionConnection(3)).toBe(false);
  });

  it("supervisor não pode provisionar", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      super: false,
      profile: "supervisor"
    });
    expect(await canProvisionEvolutionConnection(4)).toBe(false);
  });

  it("user comum não pode provisionar", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      super: false,
      profile: "user"
    });
    expect(await canProvisionEvolutionConnection(5)).toBe(false);
  });
});
