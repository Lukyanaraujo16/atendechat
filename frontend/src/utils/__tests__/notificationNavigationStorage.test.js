import { navigateFromNotificationData } from "../notificationNavigation";

describe("navegação dos avisos de armazenamento", () => {
  it("cliente vai para a Central de Mídias", () => {
    const history = { push: jest.fn() };
    navigateFromNotificationData({ companyId: 3, storageThreshold: 90 }, history);
    expect(history.push).toHaveBeenCalledWith("/settings/media-manager");
  });

  it("Super Admin vai para a empresa", () => {
    const history = { push: jest.fn() };
    navigateFromNotificationData({ companyId: 3, storageThreshold: 100, scope: "platform" }, history);
    expect(history.push).toHaveBeenCalledWith("/saas/companies?focus=3");
  });
});
