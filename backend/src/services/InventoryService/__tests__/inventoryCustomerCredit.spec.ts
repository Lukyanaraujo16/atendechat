import { computeCreditAvailable } from "../inventoryCustomerCredit";

describe("inventoryCustomerCredit", () => {
  it("creditAvailable = max(limit - used, 0)", () => {
    expect(computeCreditAvailable(2000, 1000)).toBe(1000);
    expect(computeCreditAvailable(500, 800)).toBe(0);
    expect(computeCreditAvailable(0, 0)).toBe(0);
  });
});
