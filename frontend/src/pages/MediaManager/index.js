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
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
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
import { AppPageHeader } from "../../ui";
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
}));

const TYPE_TABS = ["all", "image", "video", "audio", "document", "other"];
const SORT_KEYS = ["createdAt_desc", "createdAt_asc", "size_desc", "size_asc"];

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
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const canAccess = user?.profile === "admin" || user?.supportMode === true;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("createdAt_desc");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [storage, setStorage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [selectedMap, setSelectedMap] = useState({});

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setSelectedMap({});
  }, [typeFilter, searchDebounced, sort]);

  const loadStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const { data } = await api.get("/companies/storage");
      setStorage(data);
    } catch {
      setStorage(null);
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
          limit: 25,
          sort,
        },
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setCount(Number(data.count) || 0);
      setHasMore(Boolean(data.hasMore));
      setSummary(data.summary || null);
    } catch (e) {
      toastError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, searchDebounced, sort]);

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
  }, [typeFilter, searchDebounced]);

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
          source: row.source,
          sourceId: row.sourceId,
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
            source: row.source,
            sourceId: row.sourceId,
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
      source: x.source,
      sourceId: x.sourceId,
    }));
    if (!payloadItems.length) return;
    try {
      const { data } = await api.post("/company-media/delete-batch", {
        items: payloadItems,
      });
      setBatchDialogOpen(false);
      setSelectedMap({});
      const deleted = Number(data.deletedCount) || 0;
      const failed = Number(data.failedCount) || 0;
      const freedFmt = data.freedFormatted || formatBytesEst(data.freedBytes || 0);

      if (deleted === 0 && failed > 0) {
        showWarningToast("mediaManager.toasts.batchNoneProcessed");
      } else if (failed > 0) {
        showWarningToast("mediaManager.toasts.batchDeletedPartial", {
          deleted,
          failed,
          size: freedFmt,
        });
      } else if (deleted > 0) {
        showSuccessToast("mediaManager.toasts.batchDeleted", { count: deleted, size: freedFmt });
      }
      await loadList();
      await loadStorage();
    } catch (e) {
      toastError(e);
    }
  };

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

      <CompanyStorageUsageCard data={storage} loading={storageLoading} />

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
        <Box className={classes.filters} mt={2}>
          <TextField
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
          <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
            <InputLabel id="media-sort-label">{i18n.t("mediaManager.sort.label")}</InputLabel>
            <Select
              labelId="media-sort-label"
              label={i18n.t("mediaManager.sort.label")}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
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
        </Box>

        {selectedCount > 0 ? (
          <Box className={classes.bulkBar}>
            <Typography variant="body2" style={{ flex: 1, fontWeight: 600 }}>
              {i18n.t("mediaManager.bulk.selectedCount", { count: selectedCount })}
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

        {loading && !items.length ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
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
                    {row.type === "image" ? (
                      <img className={classes.preview} src={row.mediaUrl} alt="" />
                    ) : (
                      <Box className={classes.previewIcon}>{typeIcon(row.type)}</Box>
                    )}
                  </TableCell>
                  <TableCell>{row.fileName}</TableCell>
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

        <Box display="flex" justifyContent="flex-end" mt={2} style={{ gap: 8 }}>
          <Button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {i18n.t("mediaManager.prev")}
          </Button>
          <Button disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            {i18n.t("mediaManager.next")}
          </Button>
        </Box>
      </Paper>

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
    </MainContainer>
  );
}
