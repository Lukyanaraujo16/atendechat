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
  updateInventorySale,
  updateInventorySalePayment,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import ConfirmationModal from "../../components/ConfirmationModal";
import SaleItemsEditor from "./SaleItemsEditor";
import SaleDrawer from "./SaleDrawer";
import { cardInstallmentFormValue } from "./cardInstallments";
import { formatSaleNumber, isSaleEditable } from "./utils";
import SaleWizardStepper from "./wizard/SaleWizardStepper";
import SaleWizardCustomerStep, {
  contactOptionFromSale,
} from "./wizard/SaleWizardCustomerStep";
import SaleWizardPaymentStep from "./wizard/SaleWizardPaymentStep";
import SaleWizardReviewStep from "./wizard/SaleWizardReviewStep";
import SaleWizardSuccess from "./wizard/SaleWizardSuccess";
import SaleWizardTotals from "./wizard/SaleWizardTotals";
import {
  SALE_WIZARD_STEP_IDS,
  nextSaleWizardStep,
  prevSaleWizardStep,
} from "./wizard/saleWizardSteps";
import {
  defaultRegisterAsPaid,
  resolveRegisterAsPaidForComplete,
} from "./wizard/paymentDefaults";

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
  const [selectedContact, setSelectedContact] = useState(null);
  const [walkIn, setWalkIn] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    contactId: "",
    sellerUserId: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: "",
    cardInstallmentCount: "",
    paymentNotes: "",
  });
  const [registerAsPaid, setRegisterAsPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const completingRef = useRef(false);

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
        sellerUserId: sellerFallback,
        notes: data.notes || "",
      });
      const contact = contactOptionFromSale(data);
      setSelectedContact(contact);
      setWalkIn(!contact && data.contactId == null);
      setPaymentForm({
        paymentMethod: data.paymentMethod || "",
        cardInstallmentCount: cardInstallmentFormValue(
          data.paymentMethod,
          data.cardInstallmentCount
        ),
        paymentNotes: data.paymentNotes || "",
      });
      setRegisterAsPaid(
        data.paymentMethod
          ? defaultRegisterAsPaid(data.paymentMethod)
          : false
      );
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
      !sameId(headerForm.sellerUserId, sale.sellerUserId) ||
      (headerForm.notes || "") !== (sale.notes || "") ||
      (walkIn && sale.contactId != null));

  const paymentDirty =
    editable &&
    perms.canManagePayments &&
    sale &&
    ((paymentForm.paymentMethod || "") !== (sale.paymentMethod || "") ||
      (paymentForm.paymentMethod === "credit_card"
        ? Number(paymentForm.cardInstallmentCount || 1) !==
          Number(sale.cardInstallmentCount || 0)
        : Boolean(sale.cardInstallmentCount)) ||
      (paymentForm.paymentNotes || "") !== (sale.paymentNotes || ""));

  const persistHeader = async () => {
    const payload = {
      notes: headerForm.notes.trim() || null,
      sellerUserId: headerForm.sellerUserId
        ? Number(headerForm.sellerUserId)
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

  const persistPayment = async () => {
    const { data } = await updateInventorySalePayment(sale.id, {
      paymentMethod: paymentForm.paymentMethod || null,
      cardInstallmentCount:
        paymentForm.paymentMethod === "credit_card"
          ? Number(paymentForm.cardInstallmentCount || 1)
          : null,
      paymentNotes: paymentForm.paymentNotes.trim() || null,
      paymentStatus: "unpaid",
      paidAmount: 0,
    });
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

    if (step === SALE_WIZARD_STEP_IDS.CUSTOMER) {
      if (!headerForm.sellerUserId) {
        toast.error(i18n.t("inventorySales.sales.validation.sellerRequired"));
        return;
      }
      setSaving(true);
      try {
        await persistHeader();
        setStep(SALE_WIZARD_STEP_IDS.PRODUCTS);
      } catch (err) {
        toastError(err);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === SALE_WIZARD_STEP_IDS.PRODUCTS) {
      if (itemCount < 1) {
        toast.error(i18n.t("inventorySales.sales.wizard.products.needItems"));
        return;
      }
      setStep(SALE_WIZARD_STEP_IDS.PAYMENT);
      return;
    }

    if (step === SALE_WIZARD_STEP_IDS.PAYMENT) {
      if (perms.canManagePayments && paymentForm.paymentMethod === "credit_card") {
        const count = Number(paymentForm.cardInstallmentCount);
        if (!Number.isInteger(count) || count < 1 || count > 18) {
          toast.error(i18n.t("inventorySales.sales.wizard.payment.installmentsRequired"));
          return;
        }
      }
      setSaving(true);
      try {
        if (perms.canManagePayments && (paymentDirty || paymentForm.paymentMethod)) {
          await persistPayment();
        }
        setStep(SALE_WIZARD_STEP_IDS.REVIEW);
      } catch (err) {
        toastError(err);
      } finally {
        setSaving(false);
      }
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
      if (editable) {
        if (headerDirty) {
          await persistHeader();
        }
        if (perms.canManagePayments && (paymentDirty || paymentForm.paymentMethod)) {
          await persistPayment();
        }
      }

      const sellerUserId = Number(
        headerForm.sellerUserId || sale.sellerUserId
      );
      const body = { sellerUserId };
      if (perms.canManagePayments) {
        body.registerAsPaid = resolveRegisterAsPaidForComplete(
          paymentForm.paymentMethod || sale.paymentMethod,
          registerAsPaid
        );
      }

      const { data } = await completeInventorySale(sale.id, body);
      setSale(data);
      applySaleForms(data);
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
                selectedContact={selectedContact}
                setSelectedContact={setSelectedContact}
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
                  sale={sale}
                  readOnly={!editable}
                  onSaleUpdated={refreshSale}
                />
                <Box className={classes.productsTotals}>
                  <SaleWizardTotals sale={sale} itemCount={itemCount} />
                </Box>
              </Box>
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.PAYMENT ? (
              <SaleWizardPaymentStep
                sale={sale}
                paymentForm={paymentForm}
                setPaymentForm={setPaymentForm}
                registerAsPaid={registerAsPaid}
                setRegisterAsPaid={setRegisterAsPaid}
                canManagePayments={perms.canManagePayments}
                disabled={!editable || busy}
              />
            ) : null}

            {step === SALE_WIZARD_STEP_IDS.REVIEW ? (
              <SaleWizardReviewStep
                sale={sale}
                headerForm={headerForm}
                paymentForm={paymentForm}
                registerAsPaid={registerAsPaid}
                canManagePayments={perms.canManagePayments}
                users={users}
                selectedContact={selectedContact}
                walkIn={walkIn}
                confirming={confirming}
                onConfirm={handleConfirm}
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
