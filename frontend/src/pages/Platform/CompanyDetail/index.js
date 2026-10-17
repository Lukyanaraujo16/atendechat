import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Prompt, Redirect, useHistory, useParams } from "react-router-dom";
import { Box, Chip, Tab, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import { Formik } from "formik";
import { toast } from "react-toastify";

import MainContainer from "../../../components/MainContainer";
import ConfirmationModal from "../../../components/ConfirmationModal";
import useCompanies from "../../../hooks/useCompanies";
import usePlans from "../../../hooks/usePlans";
import toastError from "../../../errors/toastError";
import { AuthContext } from "../../../context/Auth/AuthContext";
import {
  AppLoadingState,
  AppNeutralButton,
  AppPrimaryButton,
  AppSecondaryButton,
  AppTabs,
} from "../../../ui";
import CompanyFinanceSection from "../../../components/CompanyFinanceSection";
import useSubscriptionSummary from "../../../components/CompanyFinanceSection/useSubscriptionSummary";
import { useCompanyQuickActions } from "../../../components/CompaniesManager/CompanyActionDialogs";
import {
  buildCompanyPayload,
  companyToFormValues,
} from "../../../components/CompaniesManager/companyHelpers";
import CompanyDetailHeader from "./CompanyDetailHeader";
import TabCadastro from "./TabCadastro";
import TabPlano from "./TabPlano";
import TabFuncionalidades from "./TabFuncionalidades";
import TabUsuarios from "./TabUsuarios";
import {
  BACKEND_FIELD_ERRORS,
  FIELD_TAB,
  diffChangedKeys,
  validateCompanyForm,
} from "./companyFormValidation";

export const COMPANY_DETAIL_TABS = [
  { value: "cadastro", label: "Cadastro" },
  { value: "plano", label: "Plano e operação" },
  { value: "financeiro", label: "Financeiro" },
  { value: "funcionalidades", label: "Funcionalidades" },
  { value: "usuarios", label: "Usuários" },
];
const TAB_VALUES = COMPANY_DETAIL_TABS.map((t) => t.value);
/** Abas que editam o formulário principal (salvo via PUT /companies/:id). */
const FORM_TABS = ["cadastro", "plano", "funcionalidades"];

const UNSAVED_MESSAGE =
  "Existem alterações não salvas nesta empresa. Deseja sair e descartá-las?";

const useStyles = makeStyles((theme) => ({
  tabsBar: {
    position: "sticky",
    top: 0,
    zIndex: 3,
    backgroundColor: theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },
  tab: {
    minWidth: 0,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    textTransform: "none",
  },
  saveBar: {
    position: "sticky",
    bottom: 0,
    zIndex: 3,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.paper, 0.96)
        : alpha(theme.palette.background.paper, 0.97),
    [theme.breakpoints.down("xs")]: {
      justifyContent: "stretch",
      "& > *": { flex: "1 1 auto" },
    },
  },
  dirtyChip: {
    marginRight: "auto",
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.warning.main, 0.16),
    color: theme.palette.type === "dark" ? theme.palette.warning.light : theme.palette.warning.dark,
  },
}));

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = Number(params.companyId);
  const validId = Number.isInteger(companyId) && companyId > 0;
  const tab = params.tab || "cadastro";
  const validTab = TAB_VALUES.includes(tab);

  if (!validId) return <Redirect to="/saas/companies" />;
  if (!validTab) return <Redirect to={`/saas/companies/${companyId}/cadastro`} />;
  return <CompanyDetailContent key={companyId} companyId={companyId} tab={tab} />;
}

function CompanyDetailContent({ companyId, tab }) {
  const classes = useStyles();
  const history = useHistory();
  const { user, enterSupportMode } = useContext(AuthContext);
  const isSuper = Boolean(user?.super);
  const { find, update, fetchStorageSnapshots } = useCompanies();
  const { list: listPlans } = usePlans();
  // Central de assinatura (C3): status separados no cabeçalho + reaproveitada na guia Financeiro.
  const subscription = useSubscriptionSummary(companyId, { enabled: isSuper });
  const reloadSubscription = subscription.reload;

  const [company, setCompany] = useState(null);
  const [initialFormValues, setInitialFormValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [plans, setPlans] = useState([]);
  const [storageSnapshots, setStorageSnapshots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const formikRef = useRef(null);
  const skipPromptRef = useRef(false);

  const basePath = `/saas/companies/${companyId}`;

  /* --------------------------- carregamento --------------------------- */

  const loadSnapshots = useCallback(async () => {
    try {
      setStorageSnapshots(await fetchStorageSnapshots(companyId));
    } catch (e) {
      setStorageSnapshots([]);
    }
  }, [companyId, fetchStorageSnapshots]);

  /**
   * Recarrega a empresa. Com `keepEdits`, preserva no formulário os campos que o utilizador
   * alterou e ainda não salvou (ex.: renovação feita na aba Financeiro).
   */
  const reload = useCallback(
    async ({ keepEdits = true, silent = true } = {}) => {
      if (!silent) setLoading(true);
      try {
        const data = await find(companyId);
        setCompany(data);
        setLoadError(null);
        const nextInitial = companyToFormValues(data);
        const f = formikRef.current;
        if (f) {
          const edited = {};
          if (keepEdits) {
            diffChangedKeys(f.values, f.initialValues).forEach((k) => {
              edited[k] = f.values[k];
            });
          }
          f.resetForm({ values: nextInitial });
          if (Object.keys(edited).length) {
            f.setValues({ ...nextInitial, ...edited }, false);
          }
        } else {
          setInitialFormValues(nextInitial);
        }
        loadSnapshots();
        return data;
      } catch (e) {
        if (!silent || !formikRef.current) {
          const status = e?.response?.status;
          setLoadError(
            status === 404
              ? "Empresa não encontrada. Ela pode ter sido excluída."
              : "Não foi possível carregar os dados da empresa."
          );
        }
        toastError(e);
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [companyId, find, loadSnapshots]
  );

  useEffect(() => {
    reload({ silent: false, keepEdits: false });
  }, [reload]);

  useEffect(() => {
    let alive = true;
    listPlans()
      .then((list) => {
        if (alive) setPlans(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------- alterações não salvas --------------------- */

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = UNSAVED_MESSAGE;
      return UNSAVED_MESSAGE;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const promptMessage = useCallback(
    (location) => {
      if (skipPromptRef.current) return true;
      const p = location?.pathname || "";
      if (p === basePath || p.startsWith(`${basePath}/`)) return true; // troca de aba
      return UNSAVED_MESSAGE;
    },
    [basePath]
  );

  /* ------------------------------ ações ------------------------------ */

  const { actions, dialogs } = useCompanyQuickActions({
    onChanged: () => {
      reload({ keepEdits: true });
      reloadSubscription();
    },
    onDeleted: () => {
      skipPromptRef.current = true;
      history.push("/saas/companies");
    },
  });

  const goToTab = (value) => {
    history.push(`${basePath}/${value}`);
  };

  const handleSubmit = async (values, formik) => {
    const built = buildCompanyPayload(values, {
      initialValues: formik.initialValues || initialFormValues,
      isSuper,
    });
    if (!built.ok) {
      formik.setFieldError(built.field, built.message);
      toast.error(built.message);
      if (FIELD_TAB[built.field] && FIELD_TAB[built.field] !== tab) goToTab(FIELD_TAB[built.field]);
      return;
    }
    if (!Object.keys(built.payload).length) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    setSaving(true);
    try {
      await update({ id: companyId, ...built.payload });
      await reload({ keepEdits: false });
      toast.success("Alterações salvas com sucesso.");
    } catch (e) {
      const code = e?.response?.data?.error;
      const mapped = BACKEND_FIELD_ERRORS[code];
      if (mapped) {
        formik.setFieldTouched(mapped.field, true, false);
        formik.setFieldError(mapped.field, mapped.message);
        toast.error(e?.response?.data?.message || mapped.message);
        if (FIELD_TAB[mapped.field] && FIELD_TAB[mapped.field] !== tab) {
          goToTab(FIELD_TAB[mapped.field]);
        }
      } else {
        toastError(e);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = async (formik) => {
    const errors = await formik.validateForm();
    const keys = Object.keys(errors);
    if (keys.length) {
      const touched = {};
      keys.forEach((k) => {
        touched[k] = true;
      });
      formik.setTouched({ ...formik.touched, ...touched }, false);
      const targetTab = FIELD_TAB[keys[0]] || tab;
      toast.error(
        targetTab !== tab
          ? `Corrija os campos destacados na aba “${
              COMPANY_DETAIL_TABS.find((t) => t.value === targetTab)?.label || targetTab
            }”.`
          : "Corrija os campos destacados antes de salvar."
      );
      if (targetTab !== tab) goToTab(targetTab);
      return;
    }
    formik.submitForm();
  };

  const formValidate = useCallback(
    (values) => validateCompanyForm(values, formikRef.current?.initialValues || initialFormValues || {}),
    [initialFormValues]
  );

  const headerCompany = useMemo(() => company, [company]);

  /* ------------------------------ render ------------------------------ */

  if (loading && !company) {
    return (
      <MainContainer>
        <AppLoadingState message="Carregando empresa…" />
      </MainContainer>
    );
  }

  if (!company || !initialFormValues) {
    return (
      <MainContainer>
        <Box py={4} display="flex" flexDirection="column" alignItems="flex-start" style={{ gap: 16 }}>
          <Alert severity="error">{loadError || "Não foi possível carregar a empresa."}</Alert>
          <Box display="flex" style={{ gap: 8 }}>
            <AppNeutralButton onClick={() => history.push("/saas/companies")}>
              Voltar para Empresas
            </AppNeutralButton>
            <AppSecondaryButton onClick={() => reload({ silent: false, keepEdits: false })}>
              Tentar novamente
            </AppSecondaryButton>
          </Box>
        </Box>
      </MainContainer>
    );
  }

  const isFormTab = FORM_TABS.includes(tab);

  return (
    <MainContainer>
      <Formik
        innerRef={formikRef}
        initialValues={initialFormValues}
        validate={formValidate}
        validateOnBlur
        validateOnChange={false}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          // Sem <form>: as abas Financeiro/Usuários têm formulários próprios (em diálogos) e
          // eventos de submit propagam pela árvore React; o salvamento é explícito no botão.
          <Box>
            <DirtyTracker dirty={formik.dirty} onChange={setDirty} />
            <Prompt when={formik.dirty} message={promptMessage} />

            <CompanyDetailHeader
              company={headerCompany}
              subscription={subscription.data}
              dirty={formik.dirty}
              isSuper={isSuper}
              canAccess={isSuper && !user?.supportMode}
              isOwnCompany={user?.companyId != null && user.companyId === company.id}
              onBack={() => history.push("/saas/companies")}
              onAccess={() => enterSupportMode(company.id)}
              actions={actions}
            />

            <Box className={classes.tabsBar}>
              <AppTabs
                value={tab}
                onChange={(e, value) => goToTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                indicatorColor="primary"
                textColor="primary"
                aria-label="Seções da empresa"
              >
                {COMPANY_DETAIL_TABS.map((t) => (
                  <Tab key={t.value} value={t.value} label={t.label} className={classes.tab} />
                ))}
              </AppTabs>
            </Box>

            {tab === "cadastro" ? <TabCadastro /> : null}
            {tab === "plano" ? (
              <TabPlano
                plans={plans}
                companyId={company.id}
                loading={saving}
                storageSnapshots={storageSnapshots}
                onStorageRecalculated={() => reload({ keepEdits: true })}
              />
            ) : null}
            {tab === "financeiro" ? (
              isSuper ? (
                <CompanyFinanceSection
                  companyId={company.id}
                  company={company}
                  subscriptionState={subscription}
                  onCompanyChanged={() => reload({ keepEdits: true })}
                />
              ) : (
                <Alert severity="info">O financeiro da empresa é restrito ao Super Admin.</Alert>
              )
            ) : null}
            {tab === "funcionalidades" ? <TabFuncionalidades plans={plans} /> : null}
            {tab === "usuarios" ? <TabUsuarios company={company} /> : null}

            {isFormTab ? (
              <Box className={classes.saveBar}>
                {formik.dirty ? (
                  <Chip size="small" label="Alterações não salvas" className={classes.dirtyChip} />
                ) : (
                  <Typography variant="caption" color="textSecondary" style={{ marginRight: "auto" }}>
                    As alterações das abas Cadastro, Plano e operação e Funcionalidades são salvas juntas.
                  </Typography>
                )}
                <AppNeutralButton
                  type="button"
                  disabled={!formik.dirty || saving}
                  onClick={() => setDiscardOpen(true)}
                >
                  Cancelar alterações
                </AppNeutralButton>
                <AppPrimaryButton
                  type="button"
                  loading={saving}
                  disabled={!formik.dirty}
                  onClick={() => handleSaveClick(formik)}
                >
                  Salvar alterações
                </AppPrimaryButton>
              </Box>
            ) : formik.dirty ? (
              <Box mt={2}>
                <Alert severity="warning">
                  Há alterações não salvas nas abas Cadastro, Plano e operação ou Funcionalidades.
                  Volte a uma delas para salvar ou cancelar.
                </Alert>
              </Box>
            ) : null}
            <ConfirmationModal
              title="Descartar alterações?"
              open={discardOpen}
              onClose={() => setDiscardOpen(false)}
              onConfirm={() => {
                formik.resetForm();
                setDiscardOpen(false);
              }}
              confirmText="Descartar"
            >
              As alterações não salvas nas abas Cadastro, Plano e operação e Funcionalidades serão
              perdidas.
            </ConfirmationModal>
          </Box>
        )}
      </Formik>
      {dialogs}
    </MainContainer>
  );
}

/** Propaga o estado "dirty" do Formik para o componente (beforeunload). */
function DirtyTracker({ dirty, onChange }) {
  useEffect(() => {
    onChange(Boolean(dirty));
  }, [dirty, onChange]);
  return null;
}
