import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Button from "@material-ui/core/Button";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Popover from "@material-ui/core/Popover";
import TextField from "@material-ui/core/TextField";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import EditIcon from "@material-ui/icons/Edit";
import EventIcon from "@material-ui/icons/Event";
import FlagOutlinedIcon from "@material-ui/icons/FlagOutlined";
import BusinessCenterOutlinedIcon from "@material-ui/icons/BusinessCenterOutlined";
import { format } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { isForbiddenPermissionError } from "../../utils/apiErrorUtils";
import { toast } from "react-toastify";
import { getErrorToastOptions } from "../../errors/feedbackToasts";
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";

const PRIORITIES = ["low", "medium", "high", "urgent"];

function dateFnsLocale() {
  const lang = (i18n.language || "pt").toLowerCase();
  if (lang.startsWith("es")) return es;
  if (lang.startsWith("en")) return enUS;
  return ptBR;
}

function dateToDatetimeLocalInput(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local) {
  if (!local || !String(local).trim()) return null;
  const dt = new Date(local);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function formatMoneyBrief(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function ContactCrmSection({
  contactId,
  refreshKey = 0,
  terminology,
  onOpenDealEdit,
  onCreateCrm,
}) {
  const history = useHistory();
  const isMobile = useIsMobile();
  const [deals, setDeals] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [followAnchor, setFollowAnchor] = useState(null);
  const [followDealId, setFollowDealId] = useState(null);
  const [followLocal, setFollowLocal] = useState("");
  const [followDialogOpen, setFollowDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!contactId) {
      setDeals([]);
      return;
    }
    setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        api.get(`/crm/deals/by-contact/${contactId}`),
        api.get("/crm/pipelines"),
      ]);
      setDeals(Array.isArray(dRes.data) ? dRes.data : []);
      setPipelines(Array.isArray(pRes.data) ? pRes.data : []);
    } catch (e) {
      if (!isForbiddenPermissionError(e)) {
        toastError(e);
      }
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const stagesForPipeline = (pipelineId) => {
    const p = pipelines.find((x) => Number(x.id) === Number(pipelineId));
    if (!p?.stages?.length) return [];
    return [...p.stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  };

  const openFollowEditor = (e, deal) => {
    setFollowDealId(deal.id);
    setFollowLocal(
      deal.nextFollowUpAt ? dateToDatetimeLocalInput(new Date(deal.nextFollowUpAt)) : ""
    );
    if (isMobile) {
      setFollowDialogOpen(true);
    } else {
      setFollowAnchor(e.currentTarget);
    }
  };

  const closeFollowEditor = () => {
    setFollowAnchor(null);
    setFollowDealId(null);
    setFollowDialogOpen(false);
  };

  const saveFollowUp = async () => {
    if (!followDealId) return;
    const iso = datetimeLocalToIso(followLocal);
    setBusyId(followDealId);
    try {
      await api.put(`/crm/deals/${followDealId}`, {
        nextFollowUpAt: iso,
      });
      toast.success(i18n.t("crm.ticket.followUpSaved"), getErrorToastOptions());
      closeFollowEditor();
      await loadData();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  const clearFollowUp = async (dealId) => {
    setBusyId(dealId);
    try {
      await api.put(`/crm/deals/${dealId}`, { nextFollowUpAt: null });
      toast.success(i18n.t("crm.ticket.followUpCleared"), getErrorToastOptions());
      await loadData();
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleStageChange = async (deal, stageId) => {
    setBusyId(deal.id);
    try {
      await api.put(`/crm/deals/${deal.id}/stage`, { stageId: Number(stageId) });
      toast.success(i18n.t("crm.ticket.stageUpdated"), getErrorToastOptions());
      await loadData();
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const handlePriorityChange = async (deal, priority) => {
    setBusyId(deal.id);
    try {
      await api.put(`/crm/deals/${deal.id}`, { priority });
      toast.success(i18n.t("crm.ticket.priorityUpdated"), getErrorToastOptions());
      await loadData();
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const resolveAttention = async (dealId) => {
    setBusyId(dealId);
    try {
      await api.put(`/crm/deals/${dealId}/resolve-attention`);
      toast.success(i18n.t("crm.ticket.attentionResolvedToast"), getErrorToastOptions());
      await loadData();
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const openInCrm = (dealId) => {
    history.push(`/crm?dealId=${dealId}`);
  };

  const loc = dateFnsLocale();

  const renderDealActions = (deal, busy) => (
    <Box display="flex" flexWrap="wrap" style={{ gap: 6 }} alignItems="center" width="100%">
      <FormControl
        size="small"
        variant="outlined"
        style={{ minWidth: 120, flex: "1 1 100%" }}
        fullWidth={isMobile}
        disabled={busy || deal.status !== "open" || !stagesForPipeline(deal.pipelineId).length}
      >
        <InputLabel shrink>{i18n.t("crm.ticket.changeStage")}</InputLabel>
        <Select
          label={i18n.t("crm.ticket.changeStage")}
          value={deal.stageId || ""}
          displayEmpty
          onChange={(e) => handleStageChange(deal, e.target.value)}
        >
          {stagesForPipeline(deal.pipelineId).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl
        size="small"
        variant="outlined"
        style={{ minWidth: 110, flex: isMobile ? "1 1 100%" : "1 1 45%" }}
        fullWidth={isMobile}
        disabled={busy}
      >
        <InputLabel shrink>{i18n.t("crm.filters.priority")}</InputLabel>
        <Select
          label={i18n.t("crm.filters.priority")}
          value={deal.priority || "medium"}
          onChange={(e) => handlePriorityChange(deal, e.target.value)}
        >
          {PRIORITIES.map((p) => (
            <MenuItem key={p} value={p}>
              {i18n.t(`crm.priority.${p}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!isMobile ? (
        <>
          <Tooltip title={i18n.t("crm.ticket.setFollowUp")}>
            <span>
              <IconButton
                size="small"
                disabled={busy || deal.status !== "open"}
                onClick={(e) => openFollowEditor(e, deal)}
              >
                <EventIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {deal.nextFollowUpAt ? (
            <Button size="small" onClick={() => clearFollowUp(deal.id)} disabled={busy}>
              {i18n.t("crm.followUp.clearReminder")}
            </Button>
          ) : null}
          {deal.attentionAt ? (
            <Button
              size="small"
              color="secondary"
              disabled={busy}
              onClick={() => resolveAttention(deal.id)}
            >
              {i18n.t("crm.attention.resolve")}
            </Button>
          ) : null}
          <Tooltip title={i18n.t("crm.ticket.openInCrm")}>
            <IconButton size="small" onClick={() => openInCrm(deal.id)}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onOpenDealEdit ? (
            <Tooltip title={i18n.t("crm.deal.editTitle")}>
              <IconButton size="small" onClick={() => onOpenDealEdit(deal.id)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </>
      ) : null}
    </Box>
  );

  const renderMobileDealCard = (deal) => {
    const busy = busyId === deal.id;
    const wonLabel = terminology?.statusWon || i18n.t("crm.status.won");
    const lostLabel = terminology?.statusLost || i18n.t("crm.status.lost");
    let statusLabel = i18n.t("crm.status.open");
    if (deal.status === "won") statusLabel = wonLabel;
    if (deal.status === "lost") statusLabel = lostLabel;

    const menuItems = [
      deal.status === "open"
        ? {
            key: "follow",
            label: i18n.t("crm.ticket.setFollowUp"),
            icon: <EventIcon fontSize="small" />,
            onClick: () => openFollowEditor(null, deal),
          }
        : null,
      deal.nextFollowUpAt
        ? {
            key: "clearFollow",
            label: i18n.t("crm.followUp.clearReminder"),
            onClick: () => clearFollowUp(deal.id),
          }
        : null,
      deal.attentionAt
        ? {
            key: "resolve",
            label: i18n.t("crm.attention.resolve"),
            onClick: () => resolveAttention(deal.id),
          }
        : null,
      {
        key: "open",
        label: i18n.t("crm.ticket.openInCrm"),
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: () => openInCrm(deal.id),
      },
      onOpenDealEdit
        ? {
            key: "edit",
            label: i18n.t("crm.actions.edit"),
            icon: <EditIcon fontSize="small" />,
            onClick: () => onOpenDealEdit(deal.id),
          }
        : null,
    ].filter(Boolean);

    return (
      <MobileEntityCard
        key={deal.id}
        leading={<BusinessCenterOutlinedIcon color="action" />}
        title={deal.title || "—"}
        subtitle={`${deal.pipeline?.name ? `${deal.pipeline.name} · ` : ""}${deal.stage?.name || "—"}`}
        badges={
          <MobileActionsMenu
            items={menuItems}
            ariaLabel={i18n.t("crm.mobile.dealActions")}
          />
        }
        footer={<Chip size="small" label={statusLabel} />}
      >
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("crm.filters.assignee")}: {deal.assignedUser?.name || "—"}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("crm.reports.valueCurrent")}: {formatMoneyBrief(deal.value)}
        </Typography>
        {deal.nextFollowUpAt ? (
          <Typography variant="caption" color="textSecondary" display="block">
            {i18n.t("crm.followUp.nextFollowUp")}:{" "}
            {format(new Date(deal.nextFollowUpAt), "Pp", { locale: loc })}
          </Typography>
        ) : null}
        {deal.attentionAt ? (
          <Chip
            size="small"
            icon={<FlagOutlinedIcon style={{ fontSize: 14 }} />}
            label={i18n.t("crm.attention.chip")}
            color="secondary"
          />
        ) : null}
        {renderDealActions(deal, busy)}
      </MobileEntityCard>
    );
  };

  const renderDesktopDealCard = (deal) => {
    const busy = busyId === deal.id;
    const wonLabel = terminology?.statusWon || i18n.t("crm.status.won");
    const lostLabel = terminology?.statusLost || i18n.t("crm.status.lost");
    let statusLabel = i18n.t("crm.status.open");
    if (deal.status === "won") statusLabel = wonLabel;
    if (deal.status === "lost") statusLabel = lostLabel;

    return (
      <Box
        key={deal.id}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 6,
          padding: 8,
          marginBottom: 8,
          fontSize: 12,
        }}
      >
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" style={{ gap: 4 }}>
          <Typography variant="body2" style={{ fontWeight: 600, flex: 1 }} noWrap>
            {deal.title || "—"}
          </Typography>
          <Chip size="small" label={statusLabel} style={{ height: 22, fontSize: 11 }} />
        </Box>
        <Typography variant="caption" color="textSecondary" display="block">
          {deal.pipeline?.name ? `${deal.pipeline.name} · ` : ""}
          {deal.stage?.name || "—"}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("crm.filters.assignee")}: {deal.assignedUser?.name || "—"}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("crm.filters.priority")}:{" "}
          {i18n.t(`crm.priority.${deal.priority || "medium"}`)}
        </Typography>
        {deal.nextFollowUpAt ? (
          <Typography variant="caption" color="textSecondary" display="block">
            {i18n.t("crm.followUp.nextFollowUp")}:{" "}
            {format(new Date(deal.nextFollowUpAt), "Pp", { locale: loc })}
          </Typography>
        ) : null}
        {deal.attentionAt ? (
          <Chip
            size="small"
            icon={<FlagOutlinedIcon style={{ fontSize: 14 }} />}
            label={i18n.t("crm.attention.chip")}
            style={{ height: 22, fontSize: 11, marginTop: 4 }}
            color="secondary"
          />
        ) : null}
        {Array.isArray(deal.tags) && deal.tags.length ? (
          <Typography variant="caption" display="block" style={{ marginTop: 4 }}>
            {deal.tags.join(", ")}
          </Typography>
        ) : null}
        <Typography variant="caption" display="block" style={{ marginTop: 2 }}>
          {i18n.t("crm.reports.valueCurrent")}: {formatMoneyBrief(deal.value)}
        </Typography>

        <Divider style={{ margin: "8px 0" }} />

        {renderDealActions(deal, busy)}
      </Box>
    );
  };

  if (!contactId) return null;

  return (
    <Box style={{ marginTop: 8, maxWidth: "100%", overflowX: "hidden" }}>
      <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
        {i18n.t("crm.ticket.contactCrmTitle")}
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" py={1}>
          <CircularProgress size={22} />
        </Box>
      ) : deals.length === 0 ? (
        <Box>
          <Typography variant="caption" color="textSecondary" display="block">
            {i18n.t("crm.ticket.noDeals")}
          </Typography>
          {onCreateCrm ? (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              style={{ marginTop: 8 }}
              fullWidth={isMobile}
              onClick={onCreateCrm}
            >
              {i18n.t("crm.ticket.createCrmItem")}
            </Button>
          ) : null}
        </Box>
      ) : isMobile ? (
        <MobileCardList>{deals.map((deal) => renderMobileDealCard(deal))}</MobileCardList>
      ) : (
        deals.map((deal) => renderDesktopDealCard(deal))
      )}

      {isMobile ? (
        <AppDialog open={followDialogOpen} onClose={closeFollowEditor} maxWidth="xs">
          <AppDialogTitle>{i18n.t("crm.ticket.setFollowUp")}</AppDialogTitle>
          <AppDialogContent>
            <TextField
              type="datetime-local"
              size="small"
              fullWidth
              variant="outlined"
              value={followLocal}
              onChange={(e) => setFollowLocal(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={closeFollowEditor} disabled={busyId === followDealId}>
              {i18n.t("crm.common.cancel")}
            </AppSecondaryButton>
            <AppPrimaryButton onClick={saveFollowUp} disabled={busyId === followDealId}>
              {i18n.t("crm.common.save")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : (
        <Popover
          open={Boolean(followAnchor)}
          anchorEl={followAnchor}
          onClose={closeFollowEditor}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box p={2} style={{ minWidth: 260 }}>
            <Typography variant="subtitle2" gutterBottom>
              {i18n.t("crm.ticket.setFollowUp")}
            </Typography>
            <TextField
              type="datetime-local"
              size="small"
              fullWidth
              variant="outlined"
              value={followLocal}
              onChange={(e) => setFollowLocal(e.target.value)}
              InputLabelProps={{ shrink: true }}
              style={{ marginBottom: 8 }}
            />
            <Button
              variant="contained"
              color="primary"
              size="small"
              disabled={busyId === followDealId}
              onClick={saveFollowUp}
            >
              {i18n.t("crm.common.save")}
            </Button>
          </Box>
        </Popover>
      )}
    </Box>
  );
}
