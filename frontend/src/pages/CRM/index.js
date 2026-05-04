import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, Link } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { makeStyles, alpha, useTheme } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import Skeleton from "@material-ui/lab/Skeleton";
import Alert from "@material-ui/lab/Alert";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
import Tooltip from "@material-ui/core/Tooltip";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import AddIcon from "@material-ui/icons/Add";
import SmsOutlinedIcon from "@material-ui/icons/SmsOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { formatDistanceToNow, format, isTomorrow } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import CrmDealFormDialog from "../../components/Crm/CrmDealFormDialog";
import CrmPipelineEditDialog from "../../components/Crm/CrmPipelineEditDialog";
import CrmCustomFieldsDialog from "../../components/Crm/CrmCustomFieldsDialog";
import CrmAdvancedFilters from "../../components/Crm/CrmAdvancedFilters";
import CrmSavedViewsBar from "../../components/Crm/CrmSavedViewsBar";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getCrmTerminology } from "../../utils/crmTerminology";
import {
  applyCrmAdvancedFilters,
  countActiveAdvancedFilters,
} from "../../utils/applyCrmAdvancedFilters";
import {
  getCrmDealStaleLevel,
  getCrmDealActivityTimestamp,
  getCrmDealStageAvgReferenceMs,
  crmOpenDealIsStaleBeyond,
  CRM_STALE_MS_24,
  CRM_STALE_MS_48,
  CRM_STALE_MS_72,
} from "../../utils/crmDealStale";
import {
  buildCrmViewFiltersPayload,
  parseCrmViewFiltersPayload,
} from "../../utils/crmSavedViewFilters";

const useStyles = makeStyles((theme) => ({
  "@keyframes crmDealHighlightPulse": {
    "0%": {
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}`,
    },
    "70%": {
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}`,
    },
    "100%": {
      boxShadow:
        theme.palette.type === "dark"
          ? "none"
          : `0 2px 8px ${alpha(theme.palette.common.black, 0.06)}`,
    },
  },
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 480,
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.default, 0.5)
        : theme.palette.background.default,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "flex-start",
    marginBottom: theme.spacing(2),
  },
  headerTitle: {
    flex: "1 1 220px",
    minWidth: 0,
  },
  summary: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    flex: "2 1 360px",
    minWidth: 0,
    justifyContent: "flex-end",
  },
  summaryCard: {
    padding: theme.spacing(1.25, 1.75),
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    backgroundColor: theme.palette.background.paper,
    minWidth: 128,
    maxWidth: 200,
  },
  dashboardPaper: {
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    marginBottom: theme.spacing(2),
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: theme.palette.background.paper,
  },
  metricGrid: {
    display: "flex",
    flexWrap: "wrap",
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(-0.75),
    marginRight: theme.spacing(-0.75),
    "& > *": {
      margin: theme.spacing(0.75),
    },
  },
  summaryMini: {
    padding: theme.spacing(1, 1.25),
    borderRadius: 10,
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: alpha(theme.palette.background.default, 0.35),
    minWidth: 104,
    flex: "1 1 100px",
    maxWidth: 160,
  },
  board: {
    display: "flex",
    gap: theme.spacing(2),
    overflowX: "auto",
    flex: 1,
    paddingBottom: theme.spacing(2),
    ...theme.scrollbarStyles,
  },
  column: {
    width: 300,
    minWidth: 300,
    maxHeight: "calc(100vh - 280px)",
    display: "flex",
    flexDirection: "column",
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: alpha(theme.palette.background.paper, 0.92),
  },
  columnHeader: {
    padding: theme.spacing(1.5),
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  columnBody: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    minHeight: 120,
  },
  dealCard: {
    borderRadius: 10,
    padding: theme.spacing(1.25),
    marginBottom: theme.spacing(1),
    border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow:
      theme.palette.type === "dark"
        ? "none"
        : `0 2px 8px ${alpha(theme.palette.common.black, 0.06)}`,
    cursor: "grab",
  },
  dealCardHighlight: {
    animation: "$crmDealHighlightPulse 2s ease-out",
  },
  dealCardNeedsAttention: {
    borderColor: alpha(theme.palette.warning.main, 0.9),
    boxShadow:
      theme.palette.type === "dark"
        ? `0 0 0 2px ${alpha(theme.palette.warning.main, 0.35)}`
        : `0 2px 8px ${alpha(theme.palette.common.black, 0.06)}, 0 0 0 2px ${alpha(
            theme.palette.warning.main,
            0.35
          )}`,
  },
  emptyCol: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(3, 1),
    fontSize: "0.875rem",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    alignItems: "center",
  },
}));

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "BRL" });
}

function columnTotals(deals, stages) {
  const byStage = {};
  stages.forEach((s) => {
    byStage[s.id] = { count: 0, sum: 0 };
  });
  (deals || []).forEach((d) => {
    if (!byStage[d.stageId]) {
      byStage[d.stageId] = { count: 0, sum: 0 };
    }
    byStage[d.stageId].count += 1;
    const val = d.value != null ? Number(d.value) : 0;
    if (!Number.isNaN(val)) byStage[d.stageId].sum += val;
  });
  return byStage;
}

function dateFnsLocale() {
  const lang = (i18n.language || "pt").slice(0, 2);
  if (lang === "en") return enUS;
  if (lang === "es") return es;
  return ptBR;
}

function formatCrmCustomFieldCardValue(field, raw) {
  if (raw === undefined || raw === null || raw === "") return "—";
  if (field.type === "boolean") {
    return raw === true || raw === "true" || raw === 1
      ? i18n.t("crm.customFields.boolYes")
      : i18n.t("crm.customFields.boolNo");
  }
  if (field.type === "currency") {
    return formatMoney(raw);
  }
  if (field.type === "number") {
    return String(raw);
  }
  if (field.type === "date") {
    try {
      return format(new Date(String(raw).slice(0, 10)), "P", {
        locale: dateFnsLocale(),
      });
    } catch (e) {
      return String(raw);
    }
  }
  return String(raw);
}

function priorityChipProps(priority, theme) {
  const p = priority || "medium";
  if (p === "low") {
    return {
      style: {
        backgroundColor: alpha(theme.palette.info.main, 0.12),
        color: theme.palette.info.dark,
      },
    };
  }
  if (p === "high") {
    return {
      style: {
        backgroundColor: alpha(theme.palette.warning.main, 0.18),
        color: theme.palette.warning.dark,
      },
    };
  }
  if (p === "urgent") {
    return {
      style: {
        backgroundColor: alpha(theme.palette.error.main, 0.14),
        color: theme.palette.error.dark,
      },
    };
  }
  return { variant: "outlined" };
}

function dealStatusLabel(deal, terms) {
  if (deal.status === "won") return terms.statusWon;
  if (deal.status === "lost") return terms.statusLost;
  return i18n.t("crm.status.open");
}

function formatAvgMs(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return i18n.t("crm.dashboard.durationDaysHours", { days, hours });
}

function dealMatchesSearch(deal, q) {
  if (!String(q || "").trim()) return true;
  const t = String(q).trim().toLowerCase();
  if (String(deal.title || "").toLowerCase().includes(t)) return true;
  if (String(deal.contact?.name || "").toLowerCase().includes(t)) return true;
  if (String(deal.contact?.number || "").toLowerCase().includes(t)) return true;
  return false;
}

function dealMatchesTag(deal, tag) {
  if (!String(tag || "").trim()) return true;
  const t = String(tag).trim().toLowerCase();
  const tags = Array.isArray(deal.tags) ? deal.tags : [];
  return tags.some((x) => String(x || "").toLowerCase().includes(t));
}

function dealMatchesStaleFilter(deal, staleFilter) {
  if (!staleFilter) return true;
  if (deal.status !== "open") return false;
  if (staleFilter === "24") return crmOpenDealIsStaleBeyond(deal, CRM_STALE_MS_24);
  if (staleFilter === "48") return crmOpenDealIsStaleBeyond(deal, CRM_STALE_MS_48);
  if (staleFilter === "72") return crmOpenDealIsStaleBeyond(deal, CRM_STALE_MS_72);
  return true;
}

function isSameLocalCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dealFollowUpCategory(deal) {
  const raw = deal.nextFollowUpAt;
  if (raw == null) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  if (t < now) return "overdue";
  if (isSameLocalCalendarDay(new Date(t), new Date())) return "today";
  return "future";
}

function dealMatchesFollowUpFilter(deal, followUpFilter) {
  if (!followUpFilter) return true;
  if (followUpFilter === "has") return deal.nextFollowUpAt != null;
  const cat = dealFollowUpCategory(deal);
  if (followUpFilter === "overdue") return cat === "overdue";
  if (followUpFilter === "today") return cat === "today";
  return true;
}

function dealMatchesAttentionFilter(deal, attentionFilter) {
  if (!attentionFilter) return true;
  if (attentionFilter === "needs") return deal.attentionAt != null;
  return true;
}

function crmAttentionReasonLabel(code) {
  if (code === "NO_ACTIVITY_3D") {
    return i18n.t("crm.attention.reasonNoActivity3d");
  }
  if (code === "AUTOMATION_STALE") {
    return i18n.t("crm.attention.reasonAutomationStale");
  }
  if (code === "AUTOMATION_RULE") {
    return i18n.t("crm.attention.reasonAutomationRule");
  }
  return code ? String(code) : "";
}

function filterDealsClient(allDeals, filters) {
  const {
    search,
    statusFilter,
    assigneeFilter,
    priorityFilter,
    sourceFilter,
    tagFilter,
    staleFilter,
    followUpFilter,
    attentionFilter,
  } = filters;
  return (allDeals || []).filter((d) => {
    if (!dealMatchesSearch(d, search)) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (assigneeFilter === "unassigned") {
      if (d.assignedUserId != null && d.assignedUserId !== "") return false;
    } else if (assigneeFilter) {
      if (String(d.assignedUserId) !== String(assigneeFilter)) return false;
    }
    if (priorityFilter && d.priority !== priorityFilter) return false;
    if (sourceFilter && d.source !== sourceFilter) return false;
    if (!dealMatchesTag(d, tagFilter)) return false;
    if (!dealMatchesStaleFilter(d, staleFilter)) return false;
    if (!dealMatchesFollowUpFilter(d, followUpFilter)) return false;
    if (!dealMatchesAttentionFilter(d, attentionFilter)) return false;
    return true;
  });
}

function staleAccentStyle(level, theme) {
  if (level === "normal") return {};
  const map = {
    warning: theme.palette.warning.main,
    danger: theme.palette.warning.dark,
    critical: theme.palette.error.main,
  };
  const c = map[level];
  if (!c) return {};
  return {
    borderLeft: `3px solid ${c}`,
    paddingLeft: 10,
  };
}

function formatFollowUpChipLabel(deal) {
  const raw = deal.nextFollowUpAt;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const cat = dealFollowUpCategory(deal);
  if (cat === "overdue") return i18n.t("crm.followUp.overdue");
  const locales = dateFnsLocale();
  const timeStr = format(d, "HH:mm", { locale: locales });
  if (cat === "today") {
    return i18n.t("crm.followUp.reminderToday", { time: timeStr });
  }
  if (isTomorrow(d)) {
    return i18n.t("crm.followUp.reminderTomorrow", { time: timeStr });
  }
  return i18n.t("crm.followUp.reminderDate", {
    date: format(d, "P", { locale: locales }),
    time: timeStr,
  });
}

function followUpReminderChipProps(category, theme) {
  if (category === "overdue") {
    return {
      variant: "default",
      style: {
        backgroundColor: alpha(theme.palette.error.main, 0.14),
        color: theme.palette.error.dark,
      },
    };
  }
  if (category === "today") {
    return {
      variant: "default",
      style: {
        backgroundColor: alpha(theme.palette.warning.main, 0.18),
        color: theme.palette.warning.dark,
      },
    };
  }
  return { variant: "outlined", style: {} };
}

export default function CrmBoardPage() {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);
  const bizSegment = user?.company?.businessSegment;
  const terms = useMemo(() => getCrmTerminology(bizSegment), [bizSegment]);

  const canInitCrm =
    user?.profile === "admin" || user?.supportMode === true;

  const canEditPipeline =
    user?.profile === "admin" || user?.supportMode === true;

  const [loading, setLoading] = useState(true);
  const [pipelineEditOpen, setPipelineEditOpen] = useState(false);
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilterRows, setAdvancedFilterRows] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState(null);
  const defaultSavedViewBootstrappedRef = useRef(false);
  const [pipelineCustomFields, setPipelineCustomFields] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState("");
  const [allDeals, setAllDeals] = useState([]);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [staleFilter, setStaleFilter] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
  const [attentionFilter, setAttentionFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuDeal, setMenuDeal] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const location = useLocation();

  const loadSavedViews = useCallback(async () => {
    try {
      const { data } = await api.get("/crm/views");
      setSavedViews(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    loadSavedViews();
  }, [loadSavedViews]);

  const applyFilterPayloadToState = useCallback((payload) => {
    const p = parseCrmViewFiltersPayload(payload);
    setAdvancedFilterRows(p.advancedFilterRows);
    setSearchDraft(p.search);
    setSearch(p.search);
    setStatusFilter(p.statusFilter);
    setAssigneeFilter(p.assigneeFilter);
    setPriorityFilter(p.priorityFilter);
    setSourceFilter(p.sourceFilter);
    setTagDraft(p.tagFilter);
    setTagFilter(p.tagFilter);
    setStaleFilter(p.staleFilter);
    setFollowUpFilter(p.followUpFilter);
    setAttentionFilter(p.attentionFilter);
  }, []);

  const clearAllSavedViewFilters = useCallback(() => {
    setAdvancedFilterRows([]);
    setSearchDraft("");
    setSearch("");
    setStatusFilter("");
    setAssigneeFilter("");
    setPriorityFilter("");
    setSourceFilter("");
    setTagDraft("");
    setTagFilter("");
    setStaleFilter("");
    setFollowUpFilter("");
    setAttentionFilter("");
  }, []);

  const currentViewFiltersPayload = useMemo(
    () =>
      buildCrmViewFiltersPayload({
        advancedFilterRows,
        search,
        searchDraft,
        statusFilter,
        assigneeFilter,
        priorityFilter,
        sourceFilter,
        tagFilter,
        tagDraft,
        staleFilter,
        followUpFilter,
        attentionFilter,
      }),
    [
      advancedFilterRows,
      search,
      searchDraft,
      statusFilter,
      assigneeFilter,
      priorityFilter,
      sourceFilter,
      tagFilter,
      tagDraft,
      staleFilter,
      followUpFilter,
      attentionFilter,
    ]
  );

  const loadPipelines = useCallback(async () => {
    const { data } = await api.get("/crm/pipelines");
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await loadPipelines();
        if (cancelled) return;
        setPipelines(list);
        setPipelineId((prev) => {
          if (prev) return prev;
          if (!list.length) return "";
          const def = list.find((p) => p.isDefault) || list[0];
          return String(def.id);
        });
      } catch (e) {
        if (!cancelled) toastError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPipelines]);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => String(p.id) === String(pipelineId)),
    [pipelines, pipelineId]
  );

  const stages = useMemo(() => {
    const s = selectedPipeline?.stages || [];
    return [...s].sort((a, b) => a.position - b.position);
  }, [selectedPipeline]);

  const refreshPipelineCustomFields = useCallback(async () => {
    if (!pipelineId) {
      setPipelineCustomFields([]);
      return;
    }
    try {
      const { data } = await api.get("/crm/custom-fields", {
        params: { pipelineId },
      });
      setPipelineCustomFields(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setPipelineCustomFields([]);
    }
  }, [pipelineId]);

  useEffect(() => {
    refreshPipelineCustomFields();
  }, [refreshPipelineCustomFields]);

  const visibleCardCustomFields = useMemo(() => {
    return pipelineCustomFields
      .filter((f) => f.active && f.visibleOnCard)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .slice(0, 3);
  }, [pipelineCustomFields]);

  const loadDeals = useCallback(async () => {
    if (!pipelineId) {
      setAllDeals([]);
      return;
    }
    try {
      const { data } = await api.get("/crm/deals", {
        params: { pipelineId },
      });
      setAllDeals(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
    }
  }, [pipelineId]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/list");
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const pipelineFirstSetRef = useRef(false);

  useEffect(() => {
    if (!pipelineId) {
      pipelineFirstSetRef.current = false;
      defaultSavedViewBootstrappedRef.current = false;
      return;
    }
    if (!pipelineFirstSetRef.current) {
      pipelineFirstSetRef.current = true;
      return;
    }
    defaultSavedViewBootstrappedRef.current = false;
    setAdvancedFilterRows([]);
    setSelectedSavedViewId(null);
  }, [pipelineId]);

  useEffect(() => {
    if (loading || !pipelineId) return;
    if (defaultSavedViewBootstrappedRef.current) return;
    if (!savedViews.length) return;
    const def = savedViews.find((v) => v.isDefault);
    if (!def) {
      defaultSavedViewBootstrappedRef.current = true;
      return;
    }
    applyFilterPayloadToState(def.filters);
    setSelectedSavedViewId(def.id);
    defaultSavedViewBootstrappedRef.current = true;
  }, [loading, pipelineId, savedViews, applyFilterPayloadToState]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("dealId");
    if (!raw) return undefined;
    const id = Number(raw);
    if (Number.isNaN(id)) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/crm/deals/${id}`);
        if (cancelled || !data?.pipelineId) return;
        setPipelineId((prev) => {
          const next = String(data.pipelineId);
          return prev === next ? prev : next;
        });
      } catch {
        /* deal inexistente ou sem permissão */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("dealId");
    if (!raw) return undefined;
    const id = Number(raw);
    if (Number.isNaN(id)) return undefined;
    if (!(allDeals || []).some((d) => d.id === id)) return undefined;

    const scrollT = window.setTimeout(() => {
      const el = document.querySelector(`[data-crm-deal-card="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(classes.dealCardHighlight);
        window.setTimeout(() => {
          el.classList.remove(classes.dealCardHighlight);
        }, 2100);
      }
    }, 450);
    return () => window.clearTimeout(scrollT);
  }, [location.search, allDeals, classes.dealCardHighlight]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    const t = setTimeout(() => setTagFilter(tagDraft), 350);
    return () => clearTimeout(t);
  }, [tagDraft]);

  const afterBasicFilters = useMemo(
    () =>
      filterDealsClient(allDeals, {
        search,
        statusFilter,
        assigneeFilter,
        priorityFilter,
        sourceFilter,
        tagFilter,
        staleFilter,
        followUpFilter,
        attentionFilter,
      }),
    [
      allDeals,
      search,
      statusFilter,
      assigneeFilter,
      priorityFilter,
      sourceFilter,
      tagFilter,
      staleFilter,
      followUpFilter,
      attentionFilter,
    ]
  );

  const activeAdvancedFilterCount = useMemo(
    () =>
      countActiveAdvancedFilters(advancedFilterRows, pipelineCustomFields),
    [advancedFilterRows, pipelineCustomFields]
  );

  const displayDeals = useMemo(
    () =>
      applyCrmAdvancedFilters(
        afterBasicFilters,
        advancedFilterRows,
        pipelineCustomFields
      ),
    [afterBasicFilters, advancedFilterRows, pipelineCustomFields]
  );

  const totals = useMemo(
    () => columnTotals(displayDeals, stages),
    [displayDeals, stages]
  );

  const dashboardMetrics = useMemo(() => {
    let openN = 0;
    let openSum = 0;
    let wonN = 0;
    let lostN = 0;
    let stale24 = 0;
    let stale48 = 0;
    let stale72 = 0;
    let followUpOverdue = 0;
    let followUpToday = 0;
    let needsAttention = 0;
    const closeDurations = [];
    (allDeals || []).forEach((d) => {
      if (d.attentionAt != null) {
        needsAttention += 1;
      }
      if (d.status === "open") {
        openN += 1;
        const v = d.value != null ? Number(d.value) : 0;
        if (!Number.isNaN(v)) openSum += v;
        if (crmOpenDealIsStaleBeyond(d, CRM_STALE_MS_24)) stale24 += 1;
        if (crmOpenDealIsStaleBeyond(d, CRM_STALE_MS_48)) stale48 += 1;
        if (crmOpenDealIsStaleBeyond(d, CRM_STALE_MS_72)) stale72 += 1;
        const fc = dealFollowUpCategory(d);
        if (fc === "overdue") followUpOverdue += 1;
        if (fc === "today") followUpToday += 1;
      } else if (d.status === "won") {
        wonN += 1;
      } else if (d.status === "lost") {
        lostN += 1;
      }
      if (d.status === "won" || d.status === "lost") {
        const c0 = new Date(d.createdAt).getTime();
        const c1 = new Date(d.updatedAt).getTime();
        if (!Number.isNaN(c0) && !Number.isNaN(c1) && c1 >= c0) {
          closeDurations.push(c1 - c0);
        }
      }
    });
    const decided = wonN + lostN;
    const conversionRate = decided > 0 ? (100 * wonN) / decided : 0;
    const avgCloseMs =
      closeDurations.length > 0
        ? closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length
        : null;
    return {
      openN,
      openSum,
      wonN,
      lostN,
      stale24,
      stale48,
      stale72,
      followUpOverdue,
      followUpToday,
      needsAttention,
      conversionRate,
      avgCloseMs,
    };
  }, [allDeals]);

  /** Tempo médio desde última actividade nos cartões abertos visíveis por etapa (aprox.; sem histórico real por etapa). */
  const stageAvgMs = useMemo(() => {
    const map = {};
    const now = Date.now();
    (stages || []).forEach((s) => {
      const openHere = (displayDeals || []).filter(
        (d) => d.stageId === s.id && d.status === "open"
      );
      if (!openHere.length) {
        map[s.id] = null;
        return;
      }
      let sum = 0;
      openHere.forEach((d) => {
        sum += now - getCrmDealStageAvgReferenceMs(d);
      });
      map[s.id] = sum / openHere.length;
    });
    return map;
  }, [displayDeals, stages]);

  const boardEmptyMessage = useMemo(() => {
    if (allDeals.length > 0 && displayDeals.length === 0) {
      if (afterBasicFilters.length > 0 && activeAdvancedFilterCount > 0) {
        return i18n.t("crm.advancedFilters.emptyBoard");
      }
      if (followUpFilter === "overdue") {
        return i18n.t("crm.empty.noFollowUpOverdue");
      }
      if (followUpFilter === "today") {
        return i18n.t("crm.empty.noFollowUpToday");
      }
      if (attentionFilter === "needs") {
        return i18n.t("crm.empty.noAttentionNeeds");
      }
      if (staleFilter === "48") {
        return i18n.t("crm.empty.noStale", { hours: 48 });
      }
      if (staleFilter === "72") {
        return i18n.t("crm.empty.noStale", { hours: 72 });
      }
      if (staleFilter === "24") {
        return i18n.t("crm.empty.noStale", { hours: 24 });
      }
      return i18n.t("crm.empty.noMatchingFilters");
    }
    if (allDeals.length === 0) {
      return i18n.t("crm.empty.boardNoItems", { item: terms.itemPlural });
    }
    return null;
  }, [
    allDeals.length,
    displayDeals.length,
    afterBasicFilters.length,
    activeAdvancedFilterCount,
    staleFilter,
    followUpFilter,
    attentionFilter,
    terms.itemPlural,
  ]);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const dealId = Number(result.draggableId);
    const destStageId = Number(result.destination.droppableId);
    const prev = allDeals;
    setAllDeals((cur) =>
      cur.map((d) => (d.id === dealId ? { ...d, stageId: destStageId } : d))
    );
    try {
      await api.put(`/crm/deals/${dealId}/stage`, { stageId: destStageId });
      loadDeals();
    } catch (e) {
      setAllDeals(prev);
      toastError(e);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      await api.post("/crm/bootstrap");
      const list = await loadPipelines();
      setPipelines(list);
      if (list.length) {
        const def = list.find((p) => p.isDefault) || list[0];
        setPipelineId(String(def.id));
      }
    } catch (e) {
      toastError(e);
    } finally {
      setBootstrapping(false);
    }
  };

  const openNew = () => {
    setEditingDealId(null);
    setDialogOpen(true);
  };

  const openEdit = (id) => {
    setEditingDealId(id);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingDealId(null);
  };

  const handleMenu = (e, deal) => {
    setMenuAnchor(e.currentTarget);
    setMenuDeal(deal);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDeal(null);
  };

  const handleResolveAttention = async (e, dealId) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    try {
      await api.put(`/crm/deals/${dealId}/resolve-attention`);
      loadDeals();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteDeal = async () => {
    if (!menuDeal) return;
    try {
      await api.delete(`/crm/deals/${menuDeal.id}`);
      closeMenu();
      loadDeals();
    } catch (e) {
      toastError(e);
    }
  };

  const avgCloseLabel =
    dashboardMetrics.avgCloseMs != null
      ? formatAvgMs(dashboardMetrics.avgCloseMs)
      : i18n.t("crm.dashboard.noData");

  const conversionLabel = `${dashboardMetrics.conversionRate.toFixed(1)}%`;

  if (loading) {
    return (
      <Box className={classes.root}>
        <Skeleton variant="rect" height={56} style={{ borderRadius: 8 }} />
        <Box display="flex" mt={2} style={{ gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rect"
              width={300}
              height={400}
              style={{ borderRadius: 12 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (!pipelines.length) {
    return (
      <Box className={classes.root}>
        <Paper
          style={{
            padding: 32,
            maxWidth: 480,
            margin: "auto",
            textAlign: "center",
            borderRadius: 16,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {i18n.t("crm.empty.noPipelineTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {canInitCrm
              ? i18n.t("crm.empty.noPipelineSuperBody")
              : i18n.t("crm.empty.noPipelineBody")}
          </Typography>
          {canInitCrm ? (
            <>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
                paragraph
              >
                {i18n.t("crm.actions.initCrmHint")}
              </Typography>
              <Button
                color="primary"
                variant="contained"
                disabled={bootstrapping}
                onClick={handleBootstrap}
              >
                {i18n.t("crm.actions.initCrm")}
              </Button>
            </>
          ) : null}
        </Paper>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Box className={classes.headerTitle}>
          <Typography variant="h5" style={{ fontWeight: 600 }}>
            {terms.boardTitle}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {terms.itemPlural}
          </Typography>
        </Box>
        <Box
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Button component={Link} to="/crm/reports" variant="outlined">
            {i18n.t("crm.reports.nav")}
          </Button>
          {canEditPipeline && selectedPipeline ? (
            <Button variant="outlined" onClick={() => setPipelineEditOpen(true)}>
              {i18n.t("crm.pipelineEdit.title")}
            </Button>
          ) : null}
          {canEditPipeline && selectedPipeline ? (
            <Button
              variant="outlined"
              onClick={() => setCustomFieldsDialogOpen(true)}
            >
              {i18n.t("crm.customFields.title")}
            </Button>
          ) : null}
          {canInitCrm ? (
            <Button
              component={Link}
              to="/crm/automations"
              variant="outlined"
            >
              {i18n.t("crm.automation.open")}
            </Button>
          ) : null}
          <Button
            color="primary"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openNew}
            style={{ alignSelf: "center" }}
          >
            {terms.createButton}
          </Button>
        </Box>
      </Box>

      {user?.company?.crmVisibilityMode === "assigned" &&
      user?.profile !== "admin" &&
      user?.supportMode !== true ? (
        <Alert severity="info" style={{ marginBottom: 16 }}>
          {i18n.t("crm.visibility.assignedBanner")}
        </Alert>
      ) : null}

      <Paper className={classes.dashboardPaper} elevation={0}>
        <Typography variant="caption" color="textSecondary">
          {i18n.t("crm.dashboard.avgStageNote")}
        </Typography>
        <Box className={classes.metricGrid}>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {terms.metricOpen}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.openN}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {terms.metricValueOpen}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {formatMoney(dashboardMetrics.openSum)}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {terms.metricWon}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.wonN}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {terms.metricLost}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.lostN}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.conversionRate")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {conversionLabel}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.staleOver48")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.stale48}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.followUpOverdue")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.followUpOverdue}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.followUpToday")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.followUpToday}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.needsAttention")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {dashboardMetrics.needsAttention}
            </Typography>
          </Box>
          <Box className={classes.summaryMini}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("crm.dashboard.avgCloseTime")}
            </Typography>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {avgCloseLabel}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Box className={classes.filters} mb={2}>
        <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
          <InputLabel>{i18n.t("crm.summary.pipeline")}</InputLabel>
          <Select
            label={i18n.t("crm.summary.pipeline")}
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            {pipelines.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          variant="outlined"
          label={i18n.t("crm.filters.search")}
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          style={{ minWidth: 240 }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>{i18n.t("crm.filters.status")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.status")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="open">{i18n.t("crm.status.open")}</MenuItem>
            <MenuItem value="won">{terms.statusWon}</MenuItem>
            <MenuItem value="lost">{terms.statusLost}</MenuItem>
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>{i18n.t("crm.filters.priority")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.priority")}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="low">{i18n.t("crm.priority.low")}</MenuItem>
            <MenuItem value="medium">{i18n.t("crm.priority.medium")}</MenuItem>
            <MenuItem value="high">{i18n.t("crm.priority.high")}</MenuItem>
            <MenuItem value="urgent">{i18n.t("crm.priority.urgent")}</MenuItem>
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 150 }}>
          <InputLabel>{i18n.t("crm.filters.source")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.source")}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="manual">{i18n.t("crm.deal.source.manual")}</MenuItem>
            <MenuItem value="whatsapp">{i18n.t("crm.deal.source.whatsapp")}</MenuItem>
            <MenuItem value="instagram">{i18n.t("crm.deal.source.instagram")}</MenuItem>
            <MenuItem value="other">{i18n.t("crm.deal.source.other")}</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          variant="outlined"
          label={i18n.t("crm.filters.tag")}
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          style={{ minWidth: 160 }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
          <InputLabel>{i18n.t("crm.filters.assignee")}</InputLabel>
          <Select
            label={i18n.t("crm.filters.assignee")}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
            <MenuItem value="unassigned">{i18n.t("crm.deal.fields.unassigned")}</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 10 }}>
          <CrmSavedViewsBar
            views={savedViews}
            selectedViewId={selectedSavedViewId}
            onSelectedViewIdChange={setSelectedSavedViewId}
            onApplyParsedFilters={applyFilterPayloadToState}
            onClearAllFilters={clearAllSavedViewFilters}
            currentFiltersPayload={currentViewFiltersPayload}
            user={user}
            onReloadViews={loadSavedViews}
            disabled={!pipelineId || loading}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => setAdvancedFiltersOpen(true)}
            style={{ height: 40 }}
          >
            {i18n.t("crm.advancedFilters.title")}
          </Button>
          {activeAdvancedFilterCount > 0 ? (
            <Chip size="small" label={activeAdvancedFilterCount} />
          ) : null}
          {activeAdvancedFilterCount > 0 ? (
            <Button size="small" onClick={() => setAdvancedFilterRows([])}>
              {i18n.t("crm.advancedFilters.clearAll")}
            </Button>
          ) : null}
        </Box>
        <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 8 }}>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("crm.staleFilter.label")}:
          </Typography>
          {[
            { key: "", label: i18n.t("crm.staleFilter.all") },
            { key: "24", label: i18n.t("crm.staleFilter.h24") },
            { key: "48", label: i18n.t("crm.staleFilter.h48") },
            { key: "72", label: i18n.t("crm.staleFilter.h72") },
          ].map(({ key, label }) => (
            <Chip
              key={key || "all"}
              size="small"
              label={label}
              color={staleFilter === key ? "primary" : "default"}
              onClick={() => setStaleFilter(key)}
              variant={staleFilter === key ? "default" : "outlined"}
            />
          ))}
        </Box>
        <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 8 }}>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("crm.followUp.filterLabel")}:
          </Typography>
          {[
            { key: "", label: i18n.t("crm.filters.all") },
            { key: "has", label: i18n.t("crm.followUp.filterHas") },
            { key: "overdue", label: i18n.t("crm.followUp.filterOverdue") },
            { key: "today", label: i18n.t("crm.followUp.filterToday") },
          ].map(({ key, label }) => (
            <Chip
              key={key || "fu-all"}
              size="small"
              label={label}
              color={followUpFilter === key ? "primary" : "default"}
              onClick={() => setFollowUpFilter(key)}
              variant={followUpFilter === key ? "default" : "outlined"}
            />
          ))}
        </Box>
        <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 8 }}>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("crm.attention.filterLabel")}:
          </Typography>
          {[
            { key: "", label: i18n.t("crm.filters.all") },
            { key: "needs", label: i18n.t("crm.attention.filterNeeds") },
          ].map(({ key, label }) => (
            <Chip
              key={key || "attn-all"}
              size="small"
              label={label}
              color={attentionFilter === key ? "primary" : "default"}
              onClick={() => setAttentionFilter(key)}
              variant={attentionFilter === key ? "default" : "outlined"}
            />
          ))}
        </Box>
      </Box>

      {boardEmptyMessage ? (
        <Box mb={1.5}>
          <Typography variant="body2" color="textSecondary">
            {boardEmptyMessage}
          </Typography>
        </Box>
      ) : null}

      <DragDropContext onDragEnd={onDragEnd}>
        <Box className={classes.board}>
          {stages.map((stage) => {
            const colDeals = displayDeals.filter((d) => d.stageId === stage.id);
            const colMeta = totals[stage.id] || { count: 0, sum: 0 };
            const avgMs = stageAvgMs[stage.id];
            const avgLabel =
              avgMs != null
                ? formatAvgMs(avgMs)
                : i18n.t("crm.dashboard.noData");
            const criticalCount = colDeals.filter(
              (d) =>
                d.status === "open" &&
                getCrmDealStaleLevel(d) === "critical"
            ).length;
            return (
              <Paper key={stage.id} className={classes.column} elevation={0}>
                <Box
                  className={classes.columnHeader}
                  style={{
                    backgroundColor: alpha(stage.color || "#90caf9", 0.28),
                    borderBottom: `3px solid ${stage.color || "#90caf9"}`,
                  }}
                >
                  <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                    {stage.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" component="div">
                    {colMeta.count}{" "}
                    {colMeta.count === 1
                      ? terms.itemSingular
                      : terms.itemPlural}{" "}
                    · {formatMoney(colMeta.sum)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" component="div">
                    {i18n.t("crm.dashboard.avgStageTime")}: {avgLabel}
                  </Typography>
                  {criticalCount > 0 ? (
                    <Typography variant="caption" color="error" component="div">
                      {i18n.t("crm.dashboard.criticalInColumn", {
                        count: criticalCount,
                      })}
                    </Typography>
                  ) : null}
                </Box>
                <Droppable droppableId={String(stage.id)}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={classes.columnBody}
                      style={{
                        backgroundColor: snapshot.isDraggingOver
                          ? alpha(stage.color || "#90caf9", 0.08)
                          : "transparent",
                      }}
                    >
                      {colDeals.length === 0 ? (
                        <Typography className={classes.emptyCol}>
                          {i18n.t("crm.empty.column")}
                        </Typography>
                      ) : null}
                      {colDeals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={String(deal.id)}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => {
                            const staleLevel = getCrmDealStaleLevel(deal);
                            const actTs = getCrmDealActivityTimestamp(deal);
                            return (
                            <Paper
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              data-crm-deal-card={deal.id}
                              className={
                                deal.attentionAt
                                  ? `${classes.dealCard} ${classes.dealCardNeedsAttention}`
                                  : classes.dealCard
                              }
                              elevation={dragSnapshot.isDragging ? 4 : 0}
                              style={staleAccentStyle(staleLevel, theme)}
                            >
                              <Box display="flex" alignItems="flex-start">
                                <Box flex={1} minWidth={0}>
                                  <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                                    <Typography variant="subtitle2" noWrap style={{ flex: 1 }}>
                                      {deal.title}
                                    </Typography>
                                    {deal.ticketId ? (
                                      <Tooltip title={i18n.t("crm.card.ticketFrom")}>
                                        <SmsOutlinedIcon
                                          style={{ fontSize: 18, opacity: 0.65 }}
                                          color="primary"
                                        />
                                      </Tooltip>
                                    ) : null}
                                  </Box>
                                  {deal.contact ? (
                                    <Typography variant="caption" color="textSecondary" noWrap>
                                      {deal.contact.name}
                                      {deal.contact.number ? ` · ${deal.contact.number}` : ""}
                                    </Typography>
                                  ) : null}
                                  {visibleCardCustomFields.length ? (
                                    <Box mt={0.5}>
                                      {visibleCardCustomFields.map((cf) => {
                                        const raw =
                                          deal.customFields &&
                                          typeof deal.customFields === "object"
                                            ? deal.customFields[cf.key]
                                            : undefined;
                                        return (
                                          <Typography
                                            key={cf.id || cf.key}
                                            variant="caption"
                                            color="textSecondary"
                                            display="block"
                                            noWrap
                                          >
                                            {cf.label}:{" "}
                                            {formatCrmCustomFieldCardValue(cf, raw)}
                                          </Typography>
                                        );
                                      })}
                                    </Box>
                                  ) : null}
                                  <Box mt={0.75} display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                                    {deal.status === "open" && staleLevel !== "normal" ? (
                                      <Chip
                                        size="small"
                                        label={i18n.t(`crm.stale.${staleLevel}`)}
                                        style={{
                                          backgroundColor:
                                            staleLevel === "critical"
                                              ? alpha(theme.palette.error.main, 0.14)
                                              : staleLevel === "danger"
                                                ? alpha(theme.palette.warning.main, 0.2)
                                                : alpha(theme.palette.warning.main, 0.12),
                                        }}
                                      />
                                    ) : null}
                                    {deal.value != null && deal.value !== "" ? (
                                      <Chip size="small" label={formatMoney(deal.value)} />
                                    ) : null}
                                    <Chip
                                      size="small"
                                      label={i18n.t(
                                        `crm.deal.source.${deal.source || "manual"}`
                                      )}
                                      variant="outlined"
                                    />
                                    <Chip
                                      size="small"
                                      label={i18n.t(
                                        `crm.priority.${deal.priority || "medium"}`
                                      )}
                                      {...priorityChipProps(deal.priority, theme)}
                                    />
                                    {deal.assignedUser ? (
                                      <Chip
                                        size="small"
                                        label={deal.assignedUser.name}
                                        variant="outlined"
                                      />
                                    ) : null}
                                    {deal.nextFollowUpAt ? (
                                      <Tooltip
                                        title={deal.followUpNote || ""}
                                        disableHoverListener={!deal.followUpNote}
                                      >
                                        <Chip
                                          size="small"
                                          label={formatFollowUpChipLabel(deal)}
                                          {...followUpReminderChipProps(
                                            dealFollowUpCategory(deal),
                                            theme
                                          )}
                                        />
                                      </Tooltip>
                                    ) : null}
                                    {deal.attentionAt ? (
                                      <Tooltip
                                        title={crmAttentionReasonLabel(deal.attentionReason)}
                                      >
                                        <Chip
                                          size="small"
                                          label={i18n.t("crm.attention.chip")}
                                          style={{
                                            backgroundColor: alpha(
                                              theme.palette.warning.main,
                                              0.22
                                            ),
                                            color: theme.palette.warning.dark,
                                          }}
                                        />
                                      </Tooltip>
                                    ) : null}
                                  </Box>
                                  {Array.isArray(deal.tags) && deal.tags.length ? (
                                    <Box mt={0.5} display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                                      {deal.tags.slice(0, 6).map((tg) => (
                                        <Chip key={tg} size="small" label={tg} variant="default" />
                                      ))}
                                    </Box>
                                  ) : null}
                                  {deal.status === "open" && staleLevel !== "normal" ? (
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      style={{ display: "block", marginTop: 6 }}
                                    >
                                      {i18n.t("crm.stale.noUpdateShort")}{" "}
                                      {formatDistanceToNow(new Date(actTs), {
                                        addSuffix: true,
                                        locale: dateFnsLocale(),
                                      })}
                                    </Typography>
                                  ) : (
                                    <Typography
                                      variant="caption"
                                      color="textSecondary"
                                      style={{ display: "block", marginTop: 6 }}
                                    >
                                      {i18n.t("crm.card.lastActivity")}:{" "}
                                      {deal.lastActivityAt || deal.updatedAt
                                        ? formatDistanceToNow(
                                            new Date(deal.lastActivityAt || deal.updatedAt),
                                            { addSuffix: true, locale: dateFnsLocale() }
                                          )
                                        : "—"}
                                    </Typography>
                                  )}
                                  {deal.ticket ? (
                                    <>
                                      <Divider style={{ margin: "8px 0" }} />
                                      <Typography variant="caption" color="textSecondary" noWrap>
                                        #{deal.ticket.id}
                                        {deal.ticket.lastMessage
                                          ? ` · ${deal.ticket.lastMessage}`
                                          : ""}
                                      </Typography>
                                    </>
                                  ) : null}
                                  <Box mt={0.5}>
                                    <Chip
                                      size="small"
                                      label={dealStatusLabel(deal, terms)}
                                      color={
                                        deal.status === "won"
                                          ? "primary"
                                          : deal.status === "lost"
                                            ? "default"
                                            : "default"
                                      }
                                    />
                                  </Box>
                                </Box>
                                <Box display="flex" flexDirection="column" alignItems="flex-end">
                                  {deal.attentionAt ? (
                                    <Tooltip title={i18n.t("crm.attention.resolve")}>
                                      <IconButton
                                        size="small"
                                        aria-label={i18n.t("crm.attention.resolveAria")}
                                        onClick={(e) => handleResolveAttention(e, deal.id)}
                                      >
                                        <CheckCircleOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  ) : null}
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMenu(e, deal);
                                    }}
                                  >
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
                            </Paper>
                            );
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Paper>
            );
          })}
        </Box>
      </DragDropContext>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {menuDeal?.attentionAt ? (
          <MenuItem
            onClick={() => {
              if (menuDeal) handleResolveAttention(null, menuDeal.id);
              closeMenu();
            }}
          >
            {i18n.t("crm.attention.resolve")}
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            if (menuDeal) openEdit(menuDeal.id);
            closeMenu();
          }}
        >
          {i18n.t("crm.actions.edit")}
        </MenuItem>
        <MenuItem onClick={deleteDeal} style={{ color: "#c62828" }}>
          {i18n.t("crm.actions.delete")}
        </MenuItem>
      </Menu>

      <CrmPipelineEditDialog
        open={pipelineEditOpen}
        onClose={() => setPipelineEditOpen(false)}
        pipeline={selectedPipeline}
        onSaved={async () => {
          try {
            const list = await loadPipelines();
            setPipelines(list);
            await loadDeals();
          } catch (e) {
            toastError(e);
          }
        }}
      />
      <CrmDealFormDialog
        open={dialogOpen}
        onClose={closeDialog}
        dealId={editingDealId}
        terminology={terms}
        defaults={
          editingDealId
            ? {}
            : {
                pipelineId: pipelineId ? Number(pipelineId) : undefined,
                stageId: stages[0]?.id,
              }
        }
        onSaved={() => loadDeals()}
      />
      <CrmCustomFieldsDialog
        open={customFieldsDialogOpen}
        onClose={() => setCustomFieldsDialogOpen(false)}
        pipelineId={pipelineId || ""}
        pipelineName={selectedPipeline?.name}
        onSaved={() => refreshPipelineCustomFields()}
      />
      <CrmAdvancedFilters
        open={advancedFiltersOpen}
        onClose={() => setAdvancedFiltersOpen(false)}
        filters={advancedFilterRows}
        onFiltersChange={setAdvancedFilterRows}
        stages={stages}
        users={users}
        customFieldDefs={pipelineCustomFields}
      />
    </Box>
  );
}
