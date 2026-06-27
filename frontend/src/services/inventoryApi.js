import api from "./api";

export const getInventorySettings = () => api.get("/inventory/settings");

export const updateInventorySettings = (body) =>
  api.put("/inventory/settings", body);

export const listInventoryCategories = (params) =>
  api.get("/inventory/categories", { params });

export const createInventoryCategory = (body) =>
  api.post("/inventory/categories", body);

export const updateInventoryCategory = (id, body) =>
  api.put(`/inventory/categories/${id}`, body);

export const deleteInventoryCategory = (id) =>
  api.delete(`/inventory/categories/${id}`);

export const listInventoryProducts = (params) =>
  api.get("/inventory/products", { params });

export const getInventoryProduct = (id) =>
  api.get(`/inventory/products/${id}`);

export const createInventoryProduct = (body) =>
  api.post("/inventory/products", body);

export const updateInventoryProduct = (id, body) =>
  api.put(`/inventory/products/${id}`, body);

export const deleteInventoryProduct = (id) =>
  api.delete(`/inventory/products/${id}`);

export const listLowStockProducts = () =>
  api.get("/inventory/products/low-stock");

export const listStockMovements = (params) =>
  api.get("/inventory/stock-movements", { params });

export const createStockMovement = (body) =>
  api.post("/inventory/stock-movements", body);

export const listProductStockMovements = (productId, params) =>
  api.get(`/inventory/products/${productId}/stock-movements`, { params });

export const listInventorySales = (params) =>
  api.get("/inventory/sales", { params });

export const createInventorySale = (body) =>
  api.post("/inventory/sales", body);

export const getInventorySale = (id) =>
  api.get(`/inventory/sales/${id}`);

export const updateInventorySale = (id, body) =>
  api.put(`/inventory/sales/${id}`, body);

export const deleteInventorySale = (id) =>
  api.delete(`/inventory/sales/${id}`);

export const addInventorySaleItem = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/items`, body);

export const updateInventorySaleItem = (saleId, itemId, body) =>
  api.put(`/inventory/sales/${saleId}/items/${itemId}`, body);

export const deleteInventorySaleItem = (saleId, itemId) =>
  api.delete(`/inventory/sales/${saleId}/items/${itemId}`);

export const completeInventorySale = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/complete`, body);

export const cancelInventorySale = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/cancel`, body);

export const updateInventorySalePayment = (saleId, body) =>
  api.put(`/inventory/sales/${saleId}/payment`, body);

export const getInventoryReportSummary = (params) =>
  api.get("/inventory/reports/summary", { params });

export const getInventoryReportSellers = (params) =>
  api.get("/inventory/reports/sellers", { params });

export const getInventoryReportProducts = (params) =>
  api.get("/inventory/reports/products", { params });

export const getInventoryReportCustomers = (params) =>
  api.get("/inventory/reports/customers", { params });
