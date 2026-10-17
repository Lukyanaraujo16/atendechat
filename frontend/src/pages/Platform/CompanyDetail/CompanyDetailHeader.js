import React from "react";
import { Box, Chip, Typography, Tooltip } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import ArrowBack from "@material-ui/icons/ArrowBack";
import Autorenew from "@material-ui/icons/Autorenew";
import LockOutlined from "@material-ui/icons/LockOutlined";
import LockOpen from "@material-ui/icons/LockOpen";
import HeadsetMic from "@material-ui/icons/HeadsetMic";
import ChatBubbleOutline from "@material-ui/icons/ChatBubbleOutline";
import NoteOutlined from "@material-ui/icons/NoteOutlined";
import History from "@material-ui/icons/History";
import DeleteForever from "@material-ui/icons/DeleteForever";

import { useDate } from "../../../hooks/useDate";
import { i18n } from "../../../translate/i18n";
import {
  AppNeutralButton,
  AppSecondaryButton,
  MobileActionsMenu,
} from "../../../ui";
import {
  getDueDisplayMeta,
  previewRenewedDueDate,
  formatPlanValueDiscrete,
} from "../../../components/CompaniesManager/companyHelpers";
import { getCompanyEffectivePlanValue } from "../../../utils/companyPlanValue";
import { ToneChip } from "../../../components/CompanyFinanceSection/FinanceChips";
import {
  STATUS_EXPLANATION,
  financialStatusInfo,
  operationalStatusInfo,
  subscriptionStatusInfo,
} from "../../../components/CompanyFinanceSection/subscriptionStatus";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  topRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
  },
  titleBlock: {
    flex: "1 1 260px",
    minWidth: 0,
  },
  title: {
    fontWeight: 600,
    lineHeight: 1.25,
    wordBreak: "break-word",
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  chipActive: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.success.main, 0.18),
    color: theme.palette.type === "dark" ? theme.palette.success.light : theme.palette.success.dark,
  },
  chipBlocked: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.type === "dark" ? theme.palette.error.light : theme.palette.error.dark,
  },
  dueExpired: { color: theme.palette.error.main, borderColor: theme.palette.error.main },
  dueToday: { color: theme.palette.type === "dark" ? "#ffb74d" : "#e65100", borderColor: "currentColor" },
  dueSoon: { color: theme.palette.type === "dark" ? "#ffee58" : "#f9a825", borderColor: "currentColor" },
  dueOk: {},
  dueNeutral: {},
}));

const DUE_CLASS = {
  expired: "dueExpired",
  today: "dueToday",
  soon: "dueSoon",
  ok: "dueOk",
  neutral: "dueNeutral",
};

/**
 * Cabeçalho compacto da página da empresa: nome, status, plano, vencimento e ações contextuais.
 */
export default function CompanyDetailHeader({
  company,
  subscription,
  dirty,
  isSuper,
  canAccess,
  isOwnCompany,
  onBack,
  onAccess,
  actions,
}) {
  const classes = useStyles();
  const { dateToClient } = useDate();
  if (!company) return null;

  const blocked = company.status === false;
  const dueMeta = getDueDisplayMeta(company, dateToClient);
  const planName = company.planId != null && company.plan?.name ? company.plan.name : "Sem plano";
  const valueStr = formatPlanValueDiscrete(getCompanyEffectivePlanValue(company));
  const canRenew = Boolean(previewRenewedDueDate(company));
  const subStatus = subscription?.status || null;

  const menuItems = [
    {
      key: "access",
      label: i18n.t("platform.companies.accessCompany"),
      icon: <HeadsetMic fontSize="small" />,
      onClick: onAccess,
      hidden: !canAccess,
    },
    {
      key: "billing",
      label: i18n.t("platform.companies.billingActionTooltip"),
      icon: <ChatBubbleOutline fontSize="small" />,
      onClick: () => actions.openBilling(company),
      hidden: !isSuper,
    },
    {
      key: "notes",
      label: i18n.t("platform.companies.internalNotesTooltip"),
      icon: <NoteOutlined fontSize="small" />,
      onClick: () => actions.openNotes(company),
      hidden: !isSuper,
    },
    {
      key: "history",
      label: i18n.t("platform.companies.companyHistoryTooltip"),
      icon: <History fontSize="small" />,
      onClick: () => actions.openHistory(company),
      hidden: !isSuper,
    },
    {
      key: "delete",
      label: i18n.t("platform.companies.deleteCompanyAction"),
      icon: <DeleteForever fontSize="small" />,
      onClick: () => actions.openDelete(company),
      hidden: !isSuper,
      disabled: isOwnCompany,
      danger: true,
      divider: true,
    },
  ];

  return (
    <Box className={classes.root} component="header">
      <Box>
        <AppNeutralButton size="small" startIcon={<ArrowBack fontSize="small" />} onClick={onBack}>
          Voltar para Empresas
        </AppNeutralButton>
      </Box>
      <Box className={classes.topRow}>
        <Box className={classes.titleBlock}>
          <Typography variant="overline" color="textSecondary" display="block" style={{ lineHeight: 1.4 }}>
            Empresa #{company.id}
          </Typography>
          <Typography variant="h5" component="h1" color="primary" className={classes.title}>
            {company.name || "—"}
          </Typography>
          <Box className={classes.meta}>
            {subStatus ? (
              <>
                {[
                  ["Operação", operationalStatusInfo(subStatus.operational, subStatus.blockKind)],
                  ["Financeiro", financialStatusInfo(subStatus.financial)],
                  ["Assinatura", subscriptionStatusInfo(subStatus.subscription)],
                ].map(([title, info]) => (
                  <ToneChip
                    key={title}
                    tone={info.tone}
                    label={`${title}: ${info.label}`}
                    tooltip={`${info.help ? `${info.help} ` : ""}${STATUS_EXPLANATION}`}
                  />
                ))}
              </>
            ) : (
              <Chip
                size="small"
                label={blocked ? "Bloqueada" : "Ativa"}
                classes={{ root: blocked ? classes.chipBlocked : classes.chipActive }}
              />
            )}
            <Chip
              size="small"
              variant="outlined"
              label={`Plano: ${planName}${valueStr ? ` · ${valueStr}` : ""}`}
            />
            <Tooltip title={<span style={{ whiteSpace: "pre-line" }}>{dueMeta.tooltip}</span>} arrow>
              <Chip
                size="small"
                variant="outlined"
                className={classes[DUE_CLASS[dueMeta.category]]}
                label={`Vencimento: ${dueMeta.dateLabel}${
                  dueMeta.shortLabel ? ` · ${dueMeta.shortLabel}` : ""
                }${company.recurrence ? ` · ${company.recurrence}` : ""}`}
              />
            </Tooltip>
            {dirty ? <Chip size="small" color="secondary" label="Alterações não salvas" /> : null}
          </Box>
        </Box>
        {isSuper ? (
          <Box className={classes.actions}>
            <Tooltip
              title={canRenew ? "" : i18n.t("platform.companies.renewInvalidRecurrence")}
              disableHoverListener={canRenew}
            >
              <span>
                <AppSecondaryButton
                  startIcon={<Autorenew fontSize="small" />}
                  onClick={() => actions.openRenew(company)}
                  disabled={!canRenew}
                >
                  Renovar
                </AppSecondaryButton>
              </span>
            </Tooltip>
            <AppNeutralButton
              startIcon={blocked ? <LockOpen fontSize="small" /> : <LockOutlined fontSize="small" />}
              onClick={() => actions.openBlock(company)}
              disabled={isOwnCompany}
            >
              {blocked ? "Desbloquear" : "Bloquear"}
            </AppNeutralButton>
            <MobileActionsMenu items={menuItems} ariaLabel="Mais ações" />
          </Box>
        ) : canAccess ? (
          <AppNeutralButton startIcon={<HeadsetMic fontSize="small" />} onClick={onAccess}>
            {i18n.t("platform.companies.accessCompany")}
          </AppNeutralButton>
        ) : null}
      </Box>
    </Box>
  );
}
