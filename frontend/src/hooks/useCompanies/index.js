import { useCallback } from "react";
import api from "../../services/api";

const useCompanies = () => {
  const save = useCallback(async (data) => {
    const { data: responseData } = await api.request({
      url: "/companies",
      method: "POST",
      data,
    });
    return responseData;
  }, []);

  const findAll = useCallback(async () => {
    const { data } = await api.request({
      url: `/companies`,
      method: "GET",
    });
    return data;
  }, []);

  const list = useCallback(async () => {
    const { data } = await api.request({
      url: `/companies/list`,
      method: "GET",
    });
    return data;
  }, []);

  const find = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}`,
      method: "GET",
    });
    return data;
  }, []);

  const finding = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}`,
      method: "GET",
    });
    return data;
  }, []);

  const update = useCallback(async (data) => {
    const { data: responseData } = await api.request({
      url: `/companies/${data.id}`,
      method: "PUT",
      data,
    });
    return responseData;
  }, []);

  const remove = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}`,
      method: "DELETE",
    });
    return data;
  }, []);

  const updateSchedules = useCallback(async (data) => {
    const { data: responseData } = await api.request({
      url: `/companies/${data.id}/schedules`,
      method: "PUT",
      data,
    });
    return responseData;
  }, []);

  const updateTimezone = useCallback(async (id, timezone) => {
    const { data: responseData } = await api.request({
      url: `/companies/${id}/timezone`,
      method: "PUT",
      data: { timezone },
    });
    return responseData;
  }, []);

  /**
   * Renovação manual da assinatura (Fase 8.4): o backend exige justificativa e o vencimento
   * exibido na tela (proteção contra clique duplo/concorrência → 409 ERR_RENEWAL_STALE).
   */
  const renewDueDate = useCallback(async (id, { reason, expectedCurrentDueDate } = {}) => {
    const { data: responseData } = await api.request({
      url: `/companies/${id}/renew`,
      method: "POST",
      // undefined é omitido no JSON: o backend aplica a janela anti-duplicidade por tempo.
      data: { reason, expectedCurrentDueDate },
    });
    return responseData;
  }, []);

  const fetchCompanyLogs = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}/logs`,
      method: "GET",
    });
    return data;
  }, []);

  const recalculateStorage = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}/recalculate-storage`,
      method: "POST",
    });
    return data;
  }, []);

  const updateCrmVisibility = useCallback(async (id, crmVisibilityMode) => {
    const { data: responseData } = await api.request({
      url: `/companies/${id}/crm-visibility`,
      method: "PUT",
      data: { crmVisibilityMode },
    });
    return responseData;
  }, []);

  /* ---- Usuários da empresa (Super Admin) — /saas/companies/:companyId/users ---- */

  const listCompanyUsers = useCallback(async (companyId, { searchParam = "", pageNumber = 1 } = {}) => {
    const { data } = await api.request({
      url: `/saas/companies/${companyId}/users`,
      method: "GET",
      params: { searchParam, pageNumber },
    });
    return data;
  }, []);

  const createCompanyUser = useCallback(async (companyId, payload) => {
    const { data } = await api.request({
      url: `/saas/companies/${companyId}/users`,
      method: "POST",
      data: payload,
    });
    return data;
  }, []);

  const updateCompanyUser = useCallback(async (companyId, userId, payload) => {
    const { data } = await api.request({
      url: `/saas/companies/${companyId}/users/${userId}`,
      method: "PUT",
      data: payload,
    });
    return data;
  }, []);

  const setCompanyUserActive = useCallback(async (companyId, userId, active) => {
    const { data } = await api.request({
      url: `/saas/companies/${companyId}/users/${userId}/active`,
      method: "PATCH",
      data: { active },
    });
    return data;
  }, []);

  const setCompanyUserPassword = useCallback(async (companyId, userId, password) => {
    const { data } = await api.request({
      url: `/saas/companies/${companyId}/users/${userId}/password`,
      method: "POST",
      data: { password },
    });
    return data;
  }, []);

  const fetchStorageSnapshots = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/companies/${id}/storage-snapshots`,
      method: "GET",
    });
    return Array.isArray(data) ? data : [];
  }, []);

  /* ---- Fase 8.4-F: situação financeira em lote (uma chamada para a listagem inteira) ---- */

  /** GET /saas/companies/billing-status → { companies: [{ companyId, dueDate, financialStatus, operationalStatus, blockKind, daysLate }] } */
  const fetchBillingStatus = useCallback(async () => {
    const { data } = await api.request({
      url: "/saas/companies/billing-status",
      method: "GET",
    });
    return data;
  }, []);

  /** GET /saas/finance/historical-review/summary → { total, byCompany: { [companyId]: number } } */
  const fetchHistoricalReviewSummary = useCallback(async () => {
    const { data } = await api.request({
      url: "/saas/finance/historical-review/summary",
      method: "GET",
    });
    return data;
  }, []);

  return {
    fetchBillingStatus,
    fetchHistoricalReviewSummary,
    save,
    update,
    remove,
    list,
    find,
    finding,
    findAll,
    updateSchedules,
    updateTimezone,
    updateCrmVisibility,
    renewDueDate,
    fetchCompanyLogs,
    recalculateStorage,
    fetchStorageSnapshots,
    listCompanyUsers,
    createCompanyUser,
    updateCompanyUser,
    setCompanyUserActive,
    setCompanyUserPassword,
  };
};

export default useCompanies;
