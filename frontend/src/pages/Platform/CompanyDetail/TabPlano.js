import React from "react";
import CompanyPlanFields from "../../../components/CompaniesManager/CompanyPlanFields";

/**
 * Aba Plano e operação: plano, recorrência, vencimento, valor contratado, status operacional,
 * fuso, segmento, visibilidade/inicialização do CRM e armazenamento (com recálculo e histórico).
 */
export default function TabPlano({ plans, companyId, loading, storageSnapshots, onStorageRecalculated }) {
  return (
    <CompanyPlanFields
      plans={plans}
      companyId={companyId}
      loading={loading}
      storageSnapshots={storageSnapshots}
      onStorageRecalculated={onStorageRecalculated}
    />
  );
}
