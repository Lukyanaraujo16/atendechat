import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import moment from "moment";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Chip,
} from "@material-ui/core";
import { Pagination } from "@material-ui/lab";
import { makeStyles } from "@material-ui/core/styles";
import GetAppIcon from "@material-ui/icons/GetApp";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import AudiotrackIcon from "@material-ui/icons/Audiotrack";
import VideocamIcon from "@material-ui/icons/Videocam";
import ImageIcon from "@material-ui/icons/Image";

import MainContainer from "../../components/MainContainer";
import CompanyStorageUsageCard from "../../components/CompanyStorageUsageCard";
import {
  AppPageHeader,
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
import useIsMobile from "../../hooks/useIsMobile";
import FilterListIcon from "@material-ui/icons/FilterList";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { showSuccessToast, showWarningToast } from "../../errors/feedbackToasts";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  },
  summaryCard: {
    padding: theme.spacing(2),
    textAlign: "center",
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: "1rem",
    marginTop: theme.spacing(0.5),
  },
  preview: {
    width: 56,
    height: 56,
    objectFit: "cover",
    borderRadius: 6,
    backgroundColor: theme.palette.action.hover,
  },
  previewIcon: {
    width: 56,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: theme.palette.action.hover,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  bulkBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(144, 202, 249, 0.12)"
        : theme.palette.primary.light,
    border: `1px solid ${theme.palette.divider}`,
  },
  paginationBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1),
  },
  paginationPages: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    [theme.breakpoints.up("sm")]: {
      width: "auto",
      flex: "0 0 auto",
    },
  },
  mobileToolbar: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    width: "100%",
    maxWidth: "100%",
  },
  mobileSearchRow: {
    width: "100%",
  },
  mobileCardChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    maxWidth: "100%",
  },
  mobilePreviewImage: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "calc(100dvh - 120px)",
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  },
  mobilePreviewVideo: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "calc(100dvh - 120px)",
  },
  mobilePreviewAudio: {
    width: "100%",
  },
  mobileLoadMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2, 0),
  },
  mobileThumbnail: {
    width: 48,
    height: 48,
    objectFit: "cover",
    borderRadius: 6,
    backgroundColor: theme.palette.action.hover,
  },
  mobileThumbnailIcon: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: theme.palette.action.hover,
  },
}));

const TYPE_TABS = ["all", "image", "video", "audio", "document", "other"];
const SORT_KEYS = ["createdAt_desc", "createdAt_asc", "size_desc", "size_asc"];
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const PAGE_SIZE_STORAGE_KEY = "mediaManager.pageSize";

function readStoredPageSize() {
  try {
    const n = parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY), 10);
    if (PAGE_SIZE_OPTIONS.includes(n)) return n;
  } catch {
    /* ignore */
  }
  return 25;
}

function formatBytesEst(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = num;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function typeIcon(type) {
  switch (type) {
    case "image":
      return <ImageIcon color="action" />;
    case "video":
      return <VideocamIcon color="action" />;
    case "audio":
      return <AudiotrackIcon color="action" />;
    case "document":
      return <InsertDriveFileIcon color="action" />;
    default:
      return <InsertDriveFileIcon color="disabled" />;
  }
}

export default function MediaManager() {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const canAccess = user?.profile === "admin" || user?.supportMode === true;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [mobileListItems, setMobileListItems] = useState([]);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(readStoredPageSize);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("createdAt_desc");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [storage, setStorage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [recalculateLoading, setRecalculateLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedMap, setSelectedMap] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setSelectedMap({});
  }, [typeFilter, searchDebounced, sort, page, pageSize]);

  const loadStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const { data } = await api.get("/companies/storage");
      setStorage(data);
    } catch {
      setStorage({ usedBytes: 0, usedFormatted: "0 B" });
    } finally {
      setStorageLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/company-media", {
        params: {
          type: typeFilter,
          search: searchDebounced || undefined,
          page,
          limit: pageSize,
          sort,
        },
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setCount(Number(data.count) || 0);
      setSummary(data.summary || null);
      if (data.summary?.totalBytes > 0) {
        setStorage((prev) => {
          const used = Number(prev?.usedBytes ?? 0);
          if (used > 0) return prev;
          return {
            ...(prev || {}),
            usedBytes: data.summary.totalBytes,
            summaryTotalBytes: data.summary.totalBytes,
          };
        });
      }
    } catch (e) {
      toastError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, searchDebounced, sort]);

  const handleRecalculateStorage = useCallback(async () => {
    setRecalculateLoading(true);
    try {
      const { data } = await api.post("/companies/storage/recalculate");
      setStorage(data);
      showSuccessToast("companyStorage.toasts.recalculated");
      await loadList();
    } catch (e) {
      toastError(e);
    } finally {
      setRecalculateLoading(false);
    }
  }, [loadList, loadStorage]);

  useEffect(() => {
    if (!canAccess) return;
    loadStorage();
  }, [canAccess, loadStorage]);

  useEffect(() => {
    if (!canAccess) return;
    loadList();
  }, [canAccess, loadList]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, searchDebounced, sort, pageSize]);

  useEffect(() => {
    if (!isMobile) return;
    if (page === 1) {
      setMobileListItems(items);
      return;
    }
    setMobileListItems((prev) => {
      const ids = new Set(prev.map((x) => x.id));
      const added = items.filter((x) => !ids.has(x.id));
      return added.length ? [...prev, ...added] : prev;
    });
  }, [items, page, isMobile]);

  const totalPages = useMemo(() => {
    if (count <= 0) return 0;
    return Math.max(1, Math.ceil(count / pageSize));
  }, [count, pageSize]);

  const rangeLabel = useMemo(() => {
    if (count <= 0 || !items.length) {
      return i18n.t("mediaManager.pagination.empty");
    }
    const from = (page - 1) * pageSize + 1;
    const to = (page - 1) * pageSize + items.length;
    return i18n.t("mediaManager.pagination.range", { from, to, count });
  }, [count, items.length, page, pageSize]);

  const handlePageSizeChange = (event) => {
    const next = parseInt(event.target.value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(next)) return;
    setPageSize(next);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
    setPage(1);
  };

  const handleTablePageChange = (_, newPage) => {
    setPage(newPage + 1);
  };

  const handleNumberedPageChange = (_, value) => {
    setPage(value);
  };

  const handleLoadMore = () => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  };

  const handleCopyLink = async (row) => {
    if (!row?.mediaUrl) return;
    try {
      await navigator.clipboard.writeText(row.mediaUrl);
      showSuccessToast("mediaManager.mobile.linkCopied");
    } catch {
      showWarningToast("mediaManager.mobile.linkCopyFailed");
    }
  };

  const canPreview = (row) =>
    Boolean(row?.mediaUrl) && !row.missing && ["image", "video", "audio"].includes(row.type);

  const selectedEntries = useMemo(() => Object.values(selectedMap), [selectedMap]);
  const selectedCount = selectedEntries.length;
  const estimatedBatchBytes = useMemo(
    () => selectedEntries.reduce((acc, r) => acc + (Number(r.sizeBytes) || 0), 0),
    [selectedEntries]
  );

  const allPageSelected =
    items.length > 0 && items.every((row) => Boolean(selectedMap[row.id]));
  const somePageSelected =
    items.some((row) => Boolean(selectedMap[row.id])) && !allPageSelected;

  const toggleRow = (row) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[row.id]) delete next[row.id];
      else {
        next[row.id] = {
          id: row.id,
          source: row.source,
          sourceId: row.sourceId,
          storageRel: row.storageRel,
          sizeBytes: Number(row.sizeBytes) || 0,
        };
      }
      return next;
    });
  };

  const handleSelectAllPage = (event) => {
    const checked = event.target.checked;
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (checked) {
        items.forEach((row) => {
          next[row.id] = {
            id: row.id,
            source: row.source,
            sourceId: row.sourceId,
            storageRel: row.storageRel,
            sizeBytes: Number(row.sizeBytes) || 0,
          };
        });
      } else {
        items.forEach((row) => {
          delete next[row.id];
        });
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(
        `/company-media/${deleteTarget.source}/${encodeURIComponent(deleteTarget.sourceId)}`
      );
      showSuccessToast("mediaManager.toasts.deleted");
      const rid = deleteTarget.id;
      setDeleteTarget(null);
      setSelectedMap((prev) => {
        if (!prev[rid]) return prev;
        const next = { ...prev };
        delete next[rid];
        return next;
      });
      await loadList();
      await loadStorage();
    } catch (e) {
      toastError(e);
    }
  };

  const handleBatchDelete = async () => {
    const payloadItems = selectedEntries.map((x) => ({
      id: x.id,
      source: x.source,
      sourceId: x.sourceId,
      storageRel: x.storageRel,
      sizeBytes: x.sizeBytes,
    }));
    if (!payloadItems.length) return;
    try {
      const { data } = await api.post("/company-media/delete-batch", {
        items: payloadItems,
      });
      setBatchDialogOpen(false);
      const deletedIds = new Set(
        (Array.isArray(data.deleted) ? data.deleted : []).map((d) => d.id)
      );
      setSelectedMap({});
      const deleted = Number(data.deletedCount) || 0;
      const failed = Number(data.failedCount) || 0;
      const freedFmt = data.freedFormatted || formatBytesEst(data.freedBytes || 0);

      if (deleted > 0) {
        setItems((prev) =>
          prev.filter((row) => !deletedIds.has(row.id))
        );
        setCount((c) => Math.max(0, c - deleted));
      }

      if (deleted === 0 && failed > 0) {
        const firstReason = data.failed?.[0]?.reason;
        showWarningToast("mediaManager.toasts.batchNoneProcessed", {
          reason: firstReason ? ` Motivo: ${firstReason}` : "",
        });
      } else if (failed > 0) {
        showWarningToast("mediaManager.toasts.batchDeletedPartial", {
          deleted,
          failed,
          size: freedFmt,
        });
      } else if (deleted > 0) {
        showSuccessToast("mediaManager.toasts.batchDeleted", {
          count: deleted,
          size: freedFmt,
        });
      }
      await loadList();
      await loadStorage();
    } catch (e) {
      toastError(e);
    }
  };

  const displayItems = isMobile ? mobileListItems : items;

  const buildMediaActionItems = (row) => {
    const actionItems = [];
    if (canPreview(row)) {
      actionItems.push({
        key: "preview",
        label: i18n.t("mediaManager.mobile.preview"),
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => setPreviewTarget(row),
      });
    }
    if (row.mediaUrl && !row.missing) {
      actionItems.push({
        key: "open",
        label: i18n.t("mediaManager.open"),
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: () => window.open(row.mediaUrl, "_blank", "noopener,noreferrer"),
      });
      actionItems.push({
        key: "copy",
        label: i18n.t("mediaManager.mobile.copyLink"),
        icon: <FileCopyOutlinedIcon fontSize="small" />,
        onClick: () => handleCopyLink(row),
      });
      actionItems.push({
        key: "download",
        label: i18n.t("mediaManager.download"),
        icon: <GetAppIcon fontSize="small" />,
        onClick: () => {
          const a = document.createElement("a");
          a.href = row.mediaUrl;
          a.download = row.fileName || "";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        },
      });
    }
    actionItems.push({ key: "delete-divider", divider: true });
    actionItems.push({
      key: "delete",
      label: i18n.t("mediaManager.deleteMedia"),
      icon: <DeleteOutlineIcon fontSize="small" />,
      danger: true,
      onClick: () => setDeleteTarget(row),
    });
    return actionItems;
  };

  const renderMediaLeading = (row) => {
    if (row.type === "image" && !row.missing && row.mediaUrl) {
      return (
        <img
          className={classes.mobileThumbnail}
          src={row.mediaUrl}
          alt=""
          onClick={(e) => {
            e.stopPropagation();
            setPreviewTarget(row);
          }}
          style={{ cursor: "pointer" }}
        />
      );
    }
    return <Box className={classes.mobileThumbnailIcon}>{typeIcon(row.type)}</Box>;
  };

  const renderMediaMobileCard = (row) => (
    <MobileEntityCard
      key={row.id}
      leading={
        <Box display="flex" flexDirection="column" alignItems="center" style={{ gap: 4 }}>
          <Checkbox
            size="small"
            checked={Boolean(selectedMap[row.id])}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleRow(row)}
          />
          {renderMediaLeading(row)}
        </Box>
      }
      title={row.fileName}
      badges={
        <MobileActionsMenu
          items={buildMediaActionItems(row)}
          ariaLabel={i18n.t("mediaManager.mobile.actions")}
        />
      }
      onClick={() => {
        if (canPreview(row)) setPreviewTarget(row);
        else if (row.mediaUrl && !row.missing) {
          window.open(row.mediaUrl, "_blank", "noopener,noreferrer");
        }
      }}
    >
      <Box className={classes.mobileCardChips}>
        <Chip size="small" variant="outlined" label={i18n.t(`mediaManager.types.${row.type}`)} />
        <Chip size="small" variant="outlined" label={row.sizeFormatted} />
        <Chip
          size="small"
          variant="outlined"
          label={i18n.t(`mediaManager.source.${row.source}`)}
        />
        {row.missing ? (
          <Chip
            size="small"
            label={i18n.t("mediaManager.missingFile")}
            color="default"
            variant="outlined"
          />
        ) : null}
      </Box>
      <Typography variant="caption" color="textSecondary" display="block">
        {moment(row.createdAt).format("L LT")}
      </Typography>
    </MobileEntityCard>
  );

  const renderPreviewContent = () => {
    if (!previewTarget?.mediaUrl || previewTarget.missing) return null;
    if (previewTarget.type === "image") {
      return (
        <img
          className={classes.mobilePreviewImage}
          src={previewTarget.mediaUrl}
          alt={previewTarget.fileName || ""}
        />
      );
    }
    if (previewTarget.type === "video") {
      return (
        <video
          className={classes.mobilePreviewVideo}
          src={previewTarget.mediaUrl}
          controls
          playsInline
        />
      );
    }
    if (previewTarget.type === "audio") {
      return (
        <audio
          className={classes.mobilePreviewAudio}
          src={previewTarget.mediaUrl}
          controls
        />
      );
    }
    return (
      <Box textAlign="center" py={2}>
        <Typography variant="body2" color="textSecondary" paragraph>
          {previewTarget.fileName}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<OpenInNewIcon />}
          onClick={() => window.open(previewTarget.mediaUrl, "_blank", "noopener,noreferrer")}
        >
          {i18n.t("mediaManager.open")}
        </Button>
        <Box mt={1}>
          <Button
            variant="outlined"
            startIcon={<GetAppIcon />}
            component="a"
            href={previewTarget.mediaUrl}
            download={previewTarget.fileName}
          >
            {i18n.t("mediaManager.download")}
          </Button>
        </Box>
      </Box>
    );
  };

  const sortFilterControl = (
    <FormControl variant="outlined" size="small" fullWidth>
      <InputLabel id="media-sort-label">{i18n.t("mediaManager.sort.label")}</InputLabel>
      <Select
        labelId="media-sort-label"
        label={i18n.t("mediaManager.sort.label")}
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      >
        {SORT_KEYS.map((k) => (
          <MenuItem key={k} value={k}>
            {i18n.t(`mediaManager.sort.${k}`)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  if (!canAccess) {
    return (
      <MainContainer>
        <Box p={3}>
          <Typography color="error">{i18n.t("mediaManager.noAccess")}</Typography>
          <Button style={{ marginTop: 16 }} onClick={() => history.push("/settings")}>
            {i18n.t("mediaManager.backToSettings")}
          </Button>
        </Box>
      </MainContainer>
    );
  }

  return (
    <MainContainer className={classes.root}>
      <AppPageHeader
        title={
          <Typography variant="h5" color="primary" component="h1">
            {i18n.t("mediaManager.title")}
          </Typography>
        }
        subtitle={
          <Typography variant="body2" color="textSecondary">
            {i18n.t("mediaManager.subtitle")}
          </Typography>
        }
      />

      {isMobile ? (
        <AppDialog
          open={filtersDialogOpen}
          onClose={() => setFiltersDialogOpen(false)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("mediaManager.mobile.filters")}</AppDialogTitle>
          <AppDialogContent>{sortFilterControl}</AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={() => setFiltersDialogOpen(false)}>
              {i18n.t("mediaManager.cancel")}
            </AppSecondaryButton>
            <AppPrimaryButton onClick={() => setFiltersDialogOpen(false)}>
              {i18n.t("mediaManager.mobile.applyFilters")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : null}

      <AppDialog
        open={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        maxWidth="md"
      >
        <AppDialogTitle>
          {previewTarget?.fileName || i18n.t("mediaManager.mobile.preview")}
        </AppDialogTitle>
        <AppDialogContent dividers={false}>{renderPreviewContent()}</AppDialogContent>
        <AppDialogActions>
          {previewTarget?.mediaUrl && !previewTarget?.missing ? (
            <>
              <AppSecondaryButton onClick={() => handleCopyLink(previewTarget)}>
                {i18n.t("mediaManager.mobile.copyLink")}
              </AppSecondaryButton>
              <AppSecondaryButton
                component="a"
                href={previewTarget.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {i18n.t("mediaManager.open")}
              </AppSecondaryButton>
            </>
          ) : null}
          <AppPrimaryButton onClick={() => setPreviewTarget(null)}>
            {i18n.t("mediaManager.mobile.closePreview")}
          </AppPrimaryButton>
        </AppDialogActions>
      </AppDialog>

      <Box
        display="flex"
        flexWrap="wrap"
        alignItems="flex-start"
        style={{ gap: 12 }}
      >
        <Box flex="1" minWidth={isMobile ? 0 : 280} width={isMobile ? "100%" : undefined}>
          <CompanyStorageUsageCard
            data={storage ? { ...storage, summary } : null}
            loading={storageLoading}
          />
        </Box>
        <Box display="flex" flexDirection="column" alignItems="flex-start" style={{ gap: 8 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            disabled={recalculateLoading || storageLoading}
            onClick={handleRecalculateStorage}
            startIcon={
              recalculateLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {i18n.t("companyStorage.recalculate")}
          </Button>
          <Typography variant="caption" color="textSecondary" style={{ maxWidth: 280 }}>
            {i18n.t("companyStorage.recalculateHint")}
          </Typography>
        </Box>
      </Box>

      {summary &&
      storage &&
      Number(summary.totalBytes || 0) !== Number(storage.usedBytes || 0) ? (
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("mediaManager.storageSummaryMismatch", {
            mediaTotal: summary.totalFormatted || "—",
            dbTotal: storage.usedFormatted || "—",
          })}
        </Typography>
      ) : null}

      {summary ? (
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.total")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.totalFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.images")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.imageFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.videos")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.videoFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.audios")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.audioFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.documents")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.documentFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Paper className={classes.summaryCard} variant="outlined">
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.summary.other")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {summary.otherFormatted || "—"}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      ) : null}

      <Paper style={{ padding: 16 }}>
        <Tabs
          value={typeFilter}
          onChange={(e, v) => setTypeFilter(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {TYPE_TABS.map((t) => (
            <Tab key={t} value={t} label={i18n.t(`mediaManager.tabs.${t}`)} />
          ))}
        </Tabs>
        <Box className={isMobile ? classes.mobileToolbar : classes.filters} mt={2}>
          <TextField
            fullWidth={isMobile}
            className={isMobile ? classes.mobileSearchRow : undefined}
            size="small"
            variant="outlined"
            label={i18n.t("mediaManager.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              endAdornment: loading ? (
                <InputAdornment position="end">
                  <CircularProgress size={18} />
                </InputAdornment>
              ) : null,
            }}
          />
          {isMobile ? (
            <Box display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 8 }}>
              <AppSecondaryButton
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => setFiltersDialogOpen(true)}
              >
                {i18n.t("mediaManager.mobile.filters")}
              </AppSecondaryButton>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("mediaManager.resultsCount", { count })}
              </Typography>
            </Box>
          ) : (
            <>
              <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
                <InputLabel id="media-sort-label-desktop">
                  {i18n.t("mediaManager.sort.label")}
                </InputLabel>
                <Select
                  labelId="media-sort-label-desktop"
                  label={i18n.t("mediaManager.sort.label")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {SORT_KEYS.map((k) => (
                    <MenuItem key={k} value={k}>
                      {i18n.t(`mediaManager.sort.${k}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary" style={{ marginLeft: 8 }}>
                {i18n.t("mediaManager.resultsCount", { count })}
              </Typography>
            </>
          )}
        </Box>

        {selectedCount > 0 ? (
          <Box className={classes.bulkBar}>
            <Typography variant="body2" style={{ flex: 1, fontWeight: 600 }}>
              {i18n.t("mediaManager.bulk.selectedCountPage", { count: selectedCount })}
            </Typography>
            <Button
              color="secondary"
              variant="contained"
              size="small"
              onClick={() => setBatchDialogOpen(true)}
            >
              {i18n.t("mediaManager.bulk.deleteSelected")}
            </Button>
            <Button size="small" onClick={() => setSelectedMap({})}>
              {i18n.t("mediaManager.bulk.clearSelection")}
            </Button>
          </Box>
        ) : null}

        {loading && !displayItems.length ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          displayItems.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("mediaManager.pagination.empty")}
            </Typography>
          ) : (
            <>
              <MobileCardList>
                {displayItems.map((row) => renderMediaMobileCard(row))}
              </MobileCardList>
              {loading ? (
                <Box className={classes.mobileLoadMore}>
                  <CircularProgress size={28} />
                </Box>
              ) : null}
              {page < totalPages && !loading ? (
                <Box className={classes.mobileLoadMore}>
                  <AppSecondaryButton onClick={handleLoadMore}>
                    {i18n.t("mediaManager.mobile.loadMore")}
                  </AppSecondaryButton>
                </Box>
              ) : null}
            </>
          )
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Tooltip title={i18n.t("mediaManager.table.selectAll")}>
                    <Checkbox
                      indeterminate={somePageSelected}
                      checked={allPageSelected}
                      onChange={handleSelectAllPage}
                      inputProps={{ "aria-label": i18n.t("mediaManager.table.selectAll") }}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{i18n.t("mediaManager.table.preview")}</TableCell>
                <TableCell>{i18n.t("mediaManager.table.name")}</TableCell>
                <TableCell>{i18n.t("mediaManager.table.type")}</TableCell>
                <TableCell>{i18n.t("mediaManager.table.size")}</TableCell>
                <TableCell>{i18n.t("mediaManager.table.source")}</TableCell>
                <TableCell>{i18n.t("mediaManager.table.date")}</TableCell>
                <TableCell align="right">{i18n.t("mediaManager.table.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={Boolean(selectedMap[row.id])}
                      onChange={() => toggleRow(row)}
                      inputProps={{ "aria-label": row.fileName }}
                    />
                  </TableCell>
                  <TableCell>
                    {row.type === "image" && !row.missing && row.mediaUrl ? (
                      <img className={classes.preview} src={row.mediaUrl} alt="" />
                    ) : (
                      <Box className={classes.previewIcon}>{typeIcon(row.type)}</Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box
                      display="flex"
                      alignItems="center"
                      flexWrap="wrap"
                      style={{ gap: 6 }}
                    >
                      <span>{row.fileName}</span>
                      {row.missing ? (
                        <Chip
                          size="small"
                          label={i18n.t("mediaManager.missingFile")}
                          color="default"
                          variant="outlined"
                        />
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell>{i18n.t(`mediaManager.types.${row.type}`)}</TableCell>
                  <TableCell>{row.sizeFormatted}</TableCell>
                  <TableCell>{i18n.t(`mediaManager.source.${row.source}`)}</TableCell>
                  <TableCell>{moment(row.createdAt).format("L LT")}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={i18n.t("mediaManager.open")}>
                      <IconButton
                        size="small"
                        component="a"
                        href={row.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("mediaManager.download")}>
                      <IconButton
                        size="small"
                        component="a"
                        href={row.mediaUrl}
                        download={row.fileName}
                      >
                        <GetAppIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("mediaManager.deleteMedia")}>
                      <IconButton size="small" onClick={() => setDeleteTarget(row)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isMobile ? (
          <Box className={classes.paginationBar}>
            <TablePagination
              component="div"
              count={count}
              page={Math.max(0, page - 1)}
              onChangePage={handleTablePageChange}
              rowsPerPage={pageSize}
              onChangeRowsPerPage={handlePageSizeChange}
              rowsPerPageOptions={PAGE_SIZE_OPTIONS}
              labelRowsPerPage={i18n.t("mediaManager.pagination.rowsPerPage")}
              labelDisplayedRows={() => rangeLabel}
            />
            {totalPages > 1 ? (
              <Box className={classes.paginationPages}>
                <Pagination
                  color="primary"
                  size="small"
                  count={totalPages}
                  page={page}
                  onChange={handleNumberedPageChange}
                  showFirstButton
                  showLastButton
                  disabled={loading}
                />
              </Box>
            ) : null}
          </Box>
        ) : (
          <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 16 }}>
            {rangeLabel}
          </Typography>
        )}
      </Paper>

      {isMobile ? (
        <AppDialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("mediaManager.deleteMedia")}</AppDialogTitle>
          <AppDialogContent>
            <Typography variant="body2">{i18n.t("mediaManager.deleteConfirm")}</Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.deleteIrreversible")}
            </Typography>
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={() => setDeleteTarget(null)}>
              {i18n.t("mediaManager.cancel")}
            </AppSecondaryButton>
            <AppPrimaryButton color="secondary" onClick={handleDelete}>
              {i18n.t("mediaManager.deleteMedia")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : (
        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{i18n.t("mediaManager.deleteMedia")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">{i18n.t("mediaManager.deleteConfirm")}</Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.deleteIrreversible")}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>{i18n.t("mediaManager.cancel")}</Button>
            <Button color="secondary" variant="contained" onClick={handleDelete}>
              {i18n.t("mediaManager.deleteMedia")}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <AppDialog
          open={batchDialogOpen}
          onClose={() => setBatchDialogOpen(false)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("mediaManager.bulk.deleteSelected")}</AppDialogTitle>
          <AppDialogContent>
            <Typography variant="body2">
              {i18n.t("mediaManager.bulk.deleteBatchConfirm", {
                count: selectedCount,
                size: formatBytesEst(estimatedBatchBytes),
              })}
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.deleteIrreversible")}
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.bulk.estimatedNote")}
            </Typography>
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={() => setBatchDialogOpen(false)}>
              {i18n.t("mediaManager.cancel")}
            </AppSecondaryButton>
            <AppPrimaryButton color="secondary" onClick={handleBatchDelete}>
              {i18n.t("mediaManager.bulk.deleteSelected")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : (
        <Dialog
          open={batchDialogOpen}
          onClose={() => setBatchDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{i18n.t("mediaManager.bulk.deleteSelected")}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {i18n.t("mediaManager.bulk.deleteBatchConfirm", {
                count: selectedCount,
                size: formatBytesEst(estimatedBatchBytes),
              })}
            </Typography>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.deleteIrreversible")}
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 12 }}>
              {i18n.t("mediaManager.bulk.estimatedNote")}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBatchDialogOpen(false)}>{i18n.t("mediaManager.cancel")}</Button>
            <Button color="secondary" variant="contained" onClick={handleBatchDelete}>
              {i18n.t("mediaManager.bulk.deleteSelected")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </MainContainer>
  );
}
