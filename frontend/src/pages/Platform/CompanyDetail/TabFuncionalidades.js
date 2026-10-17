import React from "react";
import Alert from "@material-ui/lab/Alert";
import { Box } from "@material-ui/core";
import { useFormikContext } from "formik";

import { i18n } from "../../../translate/i18n";
import { AppSectionCard } from "../../../ui";
import FeatureGroupsEditor from "../../../components/ModuleSettings/FeatureGroupsEditor";

/**
 * Aba Funcionalidades: módulos/permissões da empresa por categoria.
 * Reutiliza o FeatureGroupsEditor (mode="company"), que respeita as restrições do plano:
 * funcionalidades bloqueadas pelo plano não são habilitadas automaticamente.
 */
export default function TabFuncionalidades({ plans = [] }) {
  const { values, setFieldValue } = useFormikContext();
  const plan = plans.find((p) => String(p.id) === String(values.planId));
  return (
    <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
      {!plan ? (
        <Alert severity="info">
          {values.planId
            ? "Carregando dados do plano…"
            : "A empresa não tem plano selecionado. Selecione um plano na aba “Plano e operação” para ver as restrições."}
        </Alert>
      ) : null}
      <AppSectionCard>
        <FeatureGroupsEditor
          mode="company"
          title={i18n.t("settings.company.form.modulesFeaturesSectionTitle")}
          hint={i18n.t("settings.company.form.modulesFeaturesSectionHint")}
          plan={plan}
          modulePermissions={values.modulePermissions}
          onModulePermissionsChange={(next) => setFieldValue("modulePermissions", next)}
        />
      </AppSectionCard>
    </Box>
  );
}
