import { isInternalUser } from "../isInternalUser";

describe("isInternalUser", () => {
  it("super=true → interno", () => {
    expect(isInternalUser({ super: true, profile: "admin" })).toBe(true);
  });

  it('profile=superadmin → interno', () => {
    expect(isInternalUser({ super: false, profile: "superadmin" })).toBe(true);
  });

  it("profile=admin e super=false → não interno", () => {
    expect(isInternalUser({ super: false, profile: "admin" })).toBe(false);
  });

  it("profile=user → não interno", () => {
    expect(isInternalUser({ super: false, profile: "user" })).toBe(false);
  });

  it("dados ausentes → não interno", () => {
    expect(isInternalUser(null)).toBe(false);
    expect(isInternalUser(undefined)).toBe(false);
    expect(isInternalUser({})).toBe(false);
  });

  it("supportMode em admin comum não torna interno (campo ignorado)", () => {
    const payload = { super: false, profile: "admin", supportMode: true };
    expect(isInternalUser(payload)).toBe(false);
  });
});
