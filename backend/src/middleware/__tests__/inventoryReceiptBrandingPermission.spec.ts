import fs from "fs";
import path from "path";

import AppError from "../../errors/AppError";
import {
  INVENTORY_SALES_MANAGE_SETTINGS,
  INVENTORY_SALES_VIEW
} from "../../config/inventorySalesPermissions";
import { isPlatformSuperUser } from "../platformSuperBypass";
import { loadCompanyPlanContext } from "../loadCompanyEffectiveFeatures";
import { computeEffectiveUserFeatureMapForRequest } from "../../services/UserFeaturePermission/UserFeaturePermissionService";
import requireInventorySalesPermission from "../requireInventorySalesPermission";

jest.mock("../platformSuperBypass", () => ({
  isPlatformSuperUser: jest.fn()
}));

jest.mock("../loadCompanyEffectiveFeatures", () => ({
  loadCompanyPlanContext: jest.fn()
}));

jest.mock(
  "../../services/UserFeaturePermission/UserFeaturePermissionService",
  () => ({
    computeEffectiveUserFeatureMapForRequest: jest.fn(),
    USER_FEATURE_DISABLED_MSG: "Sem permissão."
  })
);

const superUser = isPlatformSuperUser as jest.Mock;
const planContext = loadCompanyPlanContext as jest.Mock;
const featureMap = computeEffectiveUserFeatureMapForRequest as jest.Mock;

function run(middleware: ReturnType<typeof requireInventorySalesPermission>) {
  const next = jest.fn();
  return middleware({} as never, {} as never, next).then(() => next);
}

describe("permissão de leitura do branding do recibo", () => {
  beforeEach(() => {
    superUser.mockReset();
    planContext.mockReset();
    featureMap.mockReset();
    superUser.mockResolvedValue(false);
    planContext.mockResolvedValue({ featureMap: { "inventory.sales": true } });
  });

  const readBranding = requireInventorySalesPermission(
    INVENTORY_SALES_VIEW,
    INVENTORY_SALES_MANAGE_SETTINGS
  );
  const editSettings = requireInventorySalesPermission(
    INVENTORY_SALES_MANAGE_SETTINGS
  );

  it("view imprime e manageSettings edita; view sozinha não edita", async () => {
    featureMap.mockResolvedValue({
      [INVENTORY_SALES_VIEW]: true,
      [INVENTORY_SALES_MANAGE_SETTINGS]: false
    });

    const readNext = await run(readBranding);
    expect(readNext).toHaveBeenCalledWith();

    const editNext = await run(editSettings);
    const error = editNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
  });

  it("manageSettings lê e edita o branding", async () => {
    featureMap.mockResolvedValue({
      [INVENTORY_SALES_VIEW]: false,
      [INVENTORY_SALES_MANAGE_SETTINGS]: true
    });

    expect(await run(readBranding)).toHaveBeenCalledWith();
    expect(await run(editSettings)).toHaveBeenCalledWith();
  });

  it("a rota publica a leitura com view ou manageSettings e o PUT só com manageSettings", () => {
    const routes = fs.readFileSync(
      path.resolve(__dirname, "../../routes/inventoryRoutes.ts"),
      "utf8"
    );
    const brandingAt = routes.indexOf('"/inventory/receipt-branding"');
    const sellerAt = routes.indexOf('"/inventory/seller-profiles"');
    const settingsAt = routes.indexOf('"/inventory/settings"');
    const brandingBlock = routes.slice(brandingAt, sellerAt);
    const settingsBlock = routes.slice(settingsAt, brandingAt);

    expect(brandingBlock).toContain("INVENTORY_SALES_VIEW");
    expect(brandingBlock).toContain("INVENTORY_SALES_MANAGE_SETTINGS");
    expect(brandingBlock).toContain("getReceiptBranding");
    expect(settingsBlock).toContain("INVENTORY_SALES_MANAGE_SETTINGS");
    expect(settingsBlock).not.toContain("INVENTORY_SALES_VIEW");
    expect(settingsBlock).toContain("updateSettings");
  });
});
