import api from "./api";

export const getInventorySettings = () => api.get("/inventory/settings");

export const updateInventorySettings = (body) =>
  api.put("/inventory/settings", body);

export const getInventoryReceiptBranding = () =>
  api.get("/inventory/receipt-branding");

export const uploadInventoryReceiptLogo = (file) => {
  const body = new FormData();
  body.append("logo", file);
  return api.post("/inventory/settings/receipt-logo", body);
};

export const deleteInventoryReceiptLogo = () =>
  api.delete("/inventory/settings/receipt-logo");

export const listInventoryCategories = (params) =>
  api.get("/inventory/categories", { params });

export const createInventoryCategory = (body) =>
  api.post("/inventory/categories", body);

export const updateInventoryCategory = (id, body) =>
  api.put(`/inventory/categories/${id}`, body);

export const deleteInventoryCategory = (id) =>
  api.delete(`/inventory/categories/${id}`);

export const listInventoryProducts = (params, config = {}) =>
  api.get("/inventory/products", { ...config, params });

export const getInventoryProduct = (id) =>
  api.get(`/inventory/products/${id}`);

export const createInventoryProduct = (body) =>
  api.post("/inventory/products", body);

export const updateInventoryProduct = (id, body) =>
  api.put(`/inventory/products/${id}`, body);

export const deleteInventoryProduct = (id) =>
  api.delete(`/inventory/products/${id}`);

export const listInventoryProductAttributes = (params) =>
  api.get("/inventory/product-attributes", { params });

export const createInventoryProductAttribute = (body) =>
  api.post("/inventory/product-attributes", body);

export const createInventoryProductAttributeOption = (attributeId, body) =>
  api.post(`/inventory/product-attributes/${attributeId}/options`, body);

export const listInventoryProductVariants = (productId, params) =>
  api.get(`/inventory/products/${productId}/variants`, { params });

export const createInventoryProductVariant = (productId, body) =>
  api.post(`/inventory/products/${productId}/variants`, body);

export const updateInventoryProductVariant = (productId, variantId, body) =>
  api.put(`/inventory/products/${productId}/variants/${variantId}`, body);

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

export const searchInventoryCustomers = (params, config = {}) =>
  api.get("/inventory/customers/search", { ...config, params });

export const searchInventoryContacts = (params, config = {}) =>
  api.get("/inventory/contacts/search", { ...config, params });

export const listInventoryCustomers = (params) =>
  api.get("/inventory/customers", { params });

export const createInventoryCustomer = (body) =>
  api.post("/inventory/customers", body);

export const getInventoryCustomer = (id) =>
  api.get(`/inventory/customers/${id}`);

export const updateInventoryCustomer = (id, body) =>
  api.put(`/inventory/customers/${id}`, body);

export const activateInventoryCustomer = (id) =>
  api.post(`/inventory/customers/${id}/activate`);

export const deactivateInventoryCustomer = (id) =>
  api.post(`/inventory/customers/${id}/deactivate`);

export const getInventoryCustomerCredit = (id) =>
  api.get(`/inventory/customers/${id}/credit`);

export const getInventoryCustomerAccount = (id) =>
  api.get(`/inventory/customers/${id}/account`);

export const createInventoryCustomerFromContact = (contactId, body = {}) =>
  api.post(`/inventory/customers/from-contact/${contactId}`, body);

export const previewInventoryStoreCreditSchedule = (body) =>
  api.post("/inventory/store-credit/preview", body);

export const getInventoryReceivablesSummary = (params) =>
  api.get("/inventory/receivables/summary", { params });

export const listInventoryReceivables = (params) =>
  api.get("/inventory/receivables", { params });

export const getInventoryReceivable = (id) =>
  api.get(`/inventory/receivables/${id}`);

export const createInventoryReceivablePayment = (receivableId, body) =>
  api.post(`/inventory/receivables/${receivableId}/payments`, body);

export const reverseInventoryReceivablePayment = (paymentId, body) =>
  api.post(`/inventory/receivable-payments/${paymentId}/reverse`, body || {});

export const getInventoryReportReceivables = (params) =>
  api.get("/inventory/reports/receivables", { params });

export const getInventoryReportStoreCredit = (params) =>
  api.get("/inventory/reports/store-credit", { params });

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

export const updateInventorySaleGlobalDiscount = (saleId, body) =>
  api.put(`/inventory/sales/${saleId}/global-discount`, body);

export const deleteInventorySaleItem = (saleId, itemId) =>
  api.delete(`/inventory/sales/${saleId}/items/${itemId}`);

export const completeInventorySale = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/complete`, body);

export const cancelInventorySale = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/cancel`, body);

export const updateInventorySalePayment = (saleId, body) =>
  api.put(`/inventory/sales/${saleId}/payment`, body);

export const getInventorySalePayments = (saleId) =>
  api.get(`/inventory/sales/${saleId}/payments`);

export const addInventorySalePayment = (saleId, body) =>
  api.post(`/inventory/sales/${saleId}/payments`, body);

export const updateInventorySalePaymentLine = (saleId, paymentId, body) =>
  api.put(`/inventory/sales/${saleId}/payments/${paymentId}`, body);

export const deleteInventorySalePaymentLine = (saleId, paymentId) =>
  api.delete(`/inventory/sales/${saleId}/payments/${paymentId}`);

export const settleInventorySalePaymentLine = (saleId, paymentId, body) =>
  api.post(`/inventory/sales/${saleId}/payments/${paymentId}/settle`, body || {});

export const updateInventorySaleDelivery = (saleId, body) =>
  api.put(`/inventory/sales/${saleId}/delivery`, body);

export const listInventoryDeliveryMethods = (params) =>
  api.get("/inventory/delivery-methods", { params });

export const createInventoryDeliveryMethod = (body) =>
  api.post("/inventory/delivery-methods", body);

export const updateInventoryDeliveryMethod = (id, body) =>
  api.put(`/inventory/delivery-methods/${id}`, body);

export const deactivateInventoryDeliveryMethod = (id) =>
  api.delete(`/inventory/delivery-methods/${id}`);

export const getInventoryReportSummary = (params) =>
  api.get("/inventory/reports/summary", { params });

export const getInventoryReportSellers = (params) =>
  api.get("/inventory/reports/sellers", { params });

export const getInventoryReportProducts = (params) =>
  api.get("/inventory/reports/products", { params });

export const getInventoryReportCustomers = (params) =>
  api.get("/inventory/reports/customers", { params });
