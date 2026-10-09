import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Typography,
} from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import {
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  completeInventorySale,
  deleteInventorySale,
  getInventorySale,
  getInventorySalePayments,
  updateInventorySale,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import ConfirmationModal from "../../components/ConfirmationModal";
import SaleItemsEditor from "./SaleItemsEditor";
import SaleDrawer from "./SaleDrawer";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { formatSaleNumber, isSaleEditable } from "./utils";
import SaleWizardStepper from "./wizard/SaleWizardStepper";
import SaleWizardCustomerStep, {
  customerOptionFromSale,
  deliverySourceFromCustomer,
} from "./wizard/SaleWizardCustomerStep";
import SaleWizardPaymentStep from "./wizard/SaleWizardPaymentStep";
import SaleWizardDeliveryStep from "./wizard/SaleWizardDeliveryStep";
import SaleWizardReviewStep from "./wizard/SaleWizardReviewStep";
import SaleWizardSuccess from "./wizard/SaleWizardSuccess";
import SaleWizardTotals from "./wizard/SaleWizardTotals";
import {
  SALE_WIZARD_STEP_IDS,
  nextSaleWizardStep,
  prevSaleWizardStep,
} from "./wizard/saleWizardSteps";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: 960,
    width: "100%",
    margin: "0 auto",
    paddingBottom: theme.spacing(4),
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    justifyContent: "space-between",
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  footerRight: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginLeft: "auto",
  },
  productsTotals: {
    marginTop: theme.spacing(2),
  },
}));

function sameId(left, right) {
  const a = left == null || left === "" ? "" : String(left);
  const b = right == null || right === "" ? "" : String(right);
  return a === b;
}

export default function SaleWizardPage() {
  const classes = useStyles();
  const { saleId } = useParams();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const perms = useInventoryPermissions();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sale, setSale] = useState(null);
  const [step, setStep] = useState(SALE_WIZARD_STEP_IDS.CUSTOMER);
  const [users, setUsers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [walkIn, setWalkIn] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    contactId: "",
    customerId: "",
    sellerUserId: "",
    notes: "",
  });
  const [paymentsBundle, setPaymentsBundle] = useState(null);
  const [storeCreditSchedule, setStoreCreditSchedule] = useState({
    frequency: "monthly",
    installmentCount: 1,
    firstDueDate: "",
  });
  const [storeCreditOverride, setStoreCreditOverride] = useState({
    authorizeOverride: false,
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const completingRef = useRef(false);
  const itemsEditorRef = useRef(null);
  const deliveryStepRef = useRef(null);

  const applySaleForms = useCallback(
    (data) => {
      const sellerFallback =
        data.sellerUserId != null
          ? String(data.sellerUserId)
          : user?.id != null
            ? String(user.id)
            : "";
      setHeaderForm({
        contactId: data.contactId != null ? String(data.contactId) : "",
        customerId: data.customerId != null ? String(data.customerId) : "",
        sellerUserId: sellerFallback,
        notes: data.notes || "",
      });
      const customer = customerOptionFromSale(data);
      setSelectedCustomer(customer);
      setWalkIn(!customer && data.customerId == null && data.contactId == null);
    },
    [user?.id]
  );

  const loadSale = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await getInventorySale(saleId);
      setSale(data);
      applySaleForms(data);
      if (data.status !== "draft") {
        setStep(SALE_WIZARD_STEP_IDS.REVIEW);
      }
    } catch (err) {
      setLoadError(true);
      setSale(null);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [saleId, applySaleForms]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  const refreshSale = useCallback(async () => {
    if (!saleId) return null;
    try {
      const { data } = await getInventorySale(saleId);
      setSale(data);
      return data;
    } catch (err) {
      toastError(err);
      return null;
    }
  }, [saleId]);

  const editable = isSaleEditable(sale) && perms.canCreateSale;
  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  const headerDirty =
    editable &&
    sale &&
    (!sameId(headerForm.contactId, sale.contactId) ||
      !sameId(headerForm.customerId, sale.customerId) ||
      !sameId(headerForm.sellerUserId, sale.sellerUserId) ||
      (headerForm.notes || "") !== (sale.notes || "") ||
      (walkIn && (sale.contactId != null || sale.customerId != null)));

  const persistHeader = async () => {
    const payload = {
      notes: headerForm.notes.trim() || null,
      sellerUserId: headerForm.sellerUserId
        ? Number(headerForm.sellerUserId)
        : null,
      customerId: walkIn
        ? null
        : headerForm.customerId
          ? Number(headerForm.customerId)
          : null,
      contactId: walkIn
        ? null
        : headerForm.contactId
          ? Number(headerForm.contactId)
          : null,
    };
    const { data } = await updateInventorySale(sale.id, payload);
    setSale(data);
    return data;
  };

  const goBackList = () => history.push("/inventory-sales");

  const handleBack = () => {
    if (!editable || sale?.status !== "draft") {
      goBackList();
      return;
    }
    const prev = prevSaleWizardStep(step);
    if (prev) setStep(prev);
    else goBackList();
  };

  const handleNext = async () => {
    if (!editable || saving) return;
    const nextStep = nextSaleWizardStep(step);

    if (step === SALE_WIZARD_STEP_IDS.CUSTOMER) {
      if (!headerForm.sellerUserId) {
        toast.error(i18n.t("inventorySales.sales.validation.sellerRequired"));
        return;
      }
      setSaving(true);
      try {
        await persistHeader();
        if (nextStep) setStep(nextStep);
      } catch (err) {
        toastError(err);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === SALE_WIZARD_STEP_IDS.PRODUCTS) {
      setSaving(true);
      try {
        if (itemsEditorRef.current?.flushPendingSaves) {
          await itemsEditorRef.current.flushPendingSaves();
        }
        const latest = await refreshSale();
        const count = Array.isArray(latest?.items) ? latest.items.length : itemCount;
        if (count < 1) {
          toast.error(i18n.t("inventorySales.sales.wizard.products.needItems"));
          return;
        }
        if (nextStep) setStep(nextStep);
      } catch (err) {
        if (err?.code !== "autosave-failed") {
          toastError(err);
        }
        toast.error(i18n.t("inventorySales.sales.wizard.products.saveBeforeContinue"));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === SALE_WIZARD_STEP_IDS.DELIVERY) {
      setSaving(true);
      try {
        const updated = await deliveryStepRef.current?.persist?.();
        if (!updated) {
          toast.error(i18n.t("inventorySales.sales.wizard.delivery.fixIncomplete"));
          return;
        }
        setSale(updated);
        applySaleForms(updated);
        if (nextStep) setStep(nextStep);
      } catch (err) {
        toastError(err);
        // Modalidade inativa / erro: recarrega modalidades via remount ao retry;
        // não avança.
        try {
          await refreshSale();
        } catch {
          /* ignore */
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === SALE_WIZARD_STEP_IDS.PAYMENT) {
      if (perms.canManagePayments) {
        let bundle = paymentsBundle;
        try {
          const { data } = await getInventorySalePayments(sale.id);
          bundle = data;
          setPaymentsBundle(data);
        } catch (err) {
          toastError(err);
          return;
        }
        const remaining = Number(bundle?.summary?.remainingToAllocate ?? 0);
        if (Math.abs(remaining) > 0.00001) {
          toast.error(
            i18n.t("inventorySales.sales.wizard.payment.needAllocate", {
              amount: formatCurrencyBRL(remaining),
            })
          );
          return;
        }
        const storeCreditAmt = (bundle?.payments || [])
          .filter((p) => p.method === "store_credit")
          .reduce((acc, p) => acc + Number(p.amount || 0), 0);
        if (storeCreditAmt > 0) {
          if (!headerForm.customerId && !sale.customerId) {
            toast.error(
              i18n.t(
                "inventorySales.sales.wizard.payment.storeCreditNeedsCustomer"
              )
            );
            return;
          }
          if (
            !storeCreditSchedule?.frequency ||
            !storeCreditSchedule?.firstDueDate ||
            !storeCreditSchedule?.installmentCount
          ) {
            toast.error(
              i18n.t(
                "inventorySales.sales.wizard.payment.storeCreditScheduleTitle"
              )
            );
            return;
          }
        }
      }
      if (nextStep) setStep(nextStep);
    }
  };

  const handleConfirm = async () => {
    if (!sale?.id || completingRef.current || confirming) return;
    if (!headerForm.sellerUserId && !sale.sellerUserId) {
      toast.error(i18n.t("inventorySales.sales.validation.sellerRequired"));
      setStep(SALE_WIZARD_STEP_IDS.CUSTOMER);
      return;
    }
    if (itemCount < 1) {
      toast.error(i18n.t("inventorySales.sales.wizard.products.needItems"));
      setStep(SALE_WIZARD_STEP_IDS.PRODUCTS);
      return;
    }

    completingRef.current = true;
    setConfirming(true);
    try {
      if (editable && headerDirty) {
        await persistHeader();
      }

      const sellerUserId = Number(
        headerForm.sellerUserId || sale.sellerUserId
      );
      const body = { sellerUserId };
      if (perms.canManagePayments) {
        body.paymentMode = "lines";
      }

      const storeCreditAmt = (paymentsBundle?.payments || [])
        .filter((p) => p.method === "store_credit")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);
      if (storeCreditAmt > 0 && storeCreditSchedule?.frequency) {
        body.storeCreditSchedule = {
          frequency: storeCreditSchedule.frequency,
          installmentCount:
            storeCreditSchedule.frequency === "once"
              ? 1
              : Number(storeCreditSchedule.installmentCount) || 1,
          firstDueDate: storeCreditSchedule.firstDueDate,
        };
        if (storeCreditOverride?.authorizeOverride) {
          body.storeCreditOverride = {
            authorizeOverride: true,
            reason: storeCreditOverride.reason?.trim() || null,
          };
        }
      }

      const { data } = await completeInventorySale(sale.id, body);
      setSale(data);
      applySaleForms(data);
      try {
        const refreshed = await getInventorySale(sale.id);
        // Só substitui se o GET confirmar a venda concluída (evita rascunho stale).
        if (refreshed?.data?.status === "completed") {
          setSale(refreshed.data);
          applySaleForms(refreshed.data);
        }
      } catch {
        // Mantém payload do complete.
      }
      toast.success(i18n.t("inventorySales.sales.toasts.completed"));
    } catch (err) {
      toastError(err);
    } finally {
      completingRef.current = false;
      setConfirming(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!sale?.id || !perms.canCancelSale) return;
    setSaving(true);
    try {
      await deleteInventorySale(sale.id);
      toast.success(i18n.t("inventorySales.sales.toasts.deleted"));
      history.push("/inventory-sales");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const showSuccess = sale?.status === "completed";
  const busy = saving || confirming || loading;

  return (
    <MainContainer>
      <div className={classes.pageRoot} data-testid="sale-wizard-page">
        <Box className={classes.header}>
          <IconButton
            edge="start"
            onClick={goBackList}
            aria-label={i18n.t("inventorySales.sales.wizard.back")}
            data-testid="sale-wizard-back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box minWidth={0}>
            <Typography variant="h5" component="h1" style={{ fontWeight: 700 }}>
              {showSuccess
                ? i18n.t("inventorySales.sales.wizard.success.heading")
                : i18n.t("inventorySales.sales.wizard.title", {
                    number: formatSaleNumber(sale),
                  })}
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : loadError ? (
          <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
            <AppSecondaryButton onClick={loadSale}>
              {i18n.t("inventorySales.common.retry")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : !sale ? null : showSuccess ? (
          <SaleWizardSuccess
            sale={sale}
            onOpenSale={() => setDrawerOpen(true)}
            onNewSale={() => history.push("/inventory-sales/new")}
          />
        ) : sale.status === "cancelled" ? (
          <AppEmptyState
            title={i18n.t("inventorySales.sales.wizard.cancelledTitle")}
            description={i18n.t("inventorySales.sales.wizard.cancelledBody")}
          >
            <AppSecondaryButton onClick={() => setDrawerOpen(true)}>
              {i18n.t("inventorySales.sales.wizard.success.viewSale")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : (
          <>
            <SaleWizardStepper currentStep={step} />

            {step === SALE_WIZARD_STEP_IDS.CUSTOMER ? (
              <SaleWizardCustomerStep
                sale={sale}
                headerForm={headerForm}
                setHeaderForm={setHeaderForm}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                walkIn={walkIn}
                setWalkIn={setWalkIn}
                users={users}
                setUsers={setUsers}
                disabled={!editable || busy}
              />
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.PRODUCTS ? (
              <Box data-testid="sale-wizard-products-step">
                <Typography variant="h5" style={{ fontWeight: 700, marginBottom: 8 }}>
                  {i18n.t("inventorySales.sales.wizard.products.title")}
                </Typography>
                <SaleItemsEditor
                  ref={itemsEditorRef}
                  sale={sale}
                  readOnly={!editable}
                  onSaleUpdated={refreshSale}
                  autoSave
                />
                <Box className={classes.productsTotals}>
                  <SaleWizardTotals sale={sale} itemCount={itemCount} />
                </Box>
              </Box>
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.DELIVERY ? (
              <SaleWizardDeliveryStep
                ref={deliveryStepRef}
                sale={sale}
                contact={
                  deliverySourceFromCustomer(selectedCustomer) ||
                  sale?.contact ||
                  null
                }
                itemCount={itemCount}
                disabled={!editable || busy}
                onSaleUpdated={(data) => {
                  setSale(data);
                  applySaleForms(data);
                }}
              />
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.PAYMENT ? (
              <SaleWizardPaymentStep
                sale={sale}
                canManagePayments={perms.canManagePayments}
                disabled={!editable || busy}
                paymentsBundle={paymentsBundle}
                setPaymentsBundle={setPaymentsBundle}
                onSaleCacheMaybeChanged={refreshSale}
                customerId={headerForm.customerId || sale?.customerId}
                storeCreditSchedule={storeCreditSchedule}
                setStoreCreditSchedule={setStoreCreditSchedule}
                storeCreditOverride={storeCreditOverride}
                setStoreCreditOverride={setStoreCreditOverride}
              />
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.REVIEW ? (
              <SaleWizardReviewStep
                sale={sale}
                headerForm={headerForm}
                paymentsBundle={paymentsBundle}
                canManagePayments={perms.canManagePayments}
                users={users}
                selectedCustomer={selectedCustomer}
                walkIn={walkIn}
                confirming={confirming}
                onConfirm={handleConfirm}
                storeCreditSchedule={storeCreditSchedule}
                storeCreditOverride={storeCreditOverride}
              />
            ) : null}

            {editable && step !== SALE_WIZARD_STEP_IDS.REVIEW ? (
              <Box className={classes.footer}>
                <Box>
                  {perms.canCancelSale ? (
                    <AppSecondaryButton
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                      data-testid="sale-wizard-discard"
                    >
                      {i18n.t("inventorySales.sales.deleteDraft")}
                    </AppSecondaryButton>
                  ) : null}
                </Box>
                <Box className={classes.footerRight}>
                  <AppSecondaryButton onClick={handleBack} disabled={busy}>
                    {i18n.t("inventorySales.sales.wizard.nav.back")}
                  </AppSecondaryButton>
                  <AppPrimaryButton
                    onClick={handleNext}
                    disabled={busy}
                    data-testid="sale-wizard-next"
                  >
                    {saving
                      ? i18n.t("inventorySales.sales.wizard.nav.saving")
                      : i18n.t("inventorySales.sales.wizard.nav.next")}
                  </AppPrimaryButton>
                </Box>
              </Box>
            ) : null}

            {editable && step === SALE_WIZARD_STEP_IDS.REVIEW ? (
              <Box className={classes.footer}>
                <AppSecondaryButton onClick={handleBack} disabled={busy}>
                  {i18n.t("inventorySales.sales.wizard.nav.back")}
                </AppSecondaryButton>
              </Box>
            ) : null}
          </>
        )}
      </div>

      <ConfirmationModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteDraft}
        title={i18n.t("inventorySales.sales.confirmDeleteTitle")}
        destructive
      >
        {i18n.t("inventorySales.sales.confirmDeleteMessage")}
      </ConfirmationModal>

      <SaleDrawer
        open={drawerOpen}
        saleId={sale?.id || null}
        onClose={() => setDrawerOpen(false)}
        onChanged={refreshSale}
      />
    </MainContainer>
  );
}
