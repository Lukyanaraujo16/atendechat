import { useCallback, useMemo } from "react";
import api, { openApi } from "../../services/api";

const usePlans = () => {
  const getPlanList = useCallback(async (params) => {
    const { data } = await openApi.request({
      url: "/plans/list",
      method: "GET",
      params,
    });
    return data;
  }, []);

  const list = useCallback(async (params) => {
    const { data } = await api.request({
      url: "/plans/all",
      method: "GET",
      params,
    });
    return data;
  }, []);

  const finder = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/plans/${id}`,
      method: "GET",
    });
    return data;
  }, []);

  const save = useCallback(async (data) => {
    const { data: responseData } = await api.request({
      url: "/plans",
      method: "POST",
      data,
    });
    return responseData;
  }, []);

  const update = useCallback(async (data) => {
    const { data: responseData } = await api.request({
      url: `/plans/${data.id}`,
      method: "PUT",
      data,
    });
    return responseData;
  }, []);

  const remove = useCallback(async (id) => {
    const { data } = await api.request({
      url: `/plans/${id}`,
      method: "DELETE",
    });
    return data;
  }, []);

  const getPlanCompany = useCallback(async (params, id) => {
    const { data } = await api.request({
      url: `/companies/listPlan/${id}`,
      method: "GET",
      params,
    });
    return data;
  }, []);

  return useMemo(
    () => ({
      getPlanList,
      list,
      save,
      update,
      finder,
      remove,
      getPlanCompany,
    }),
    [getPlanList, list, save, update, finder, remove, getPlanCompany]
  );
};

export default usePlans;
