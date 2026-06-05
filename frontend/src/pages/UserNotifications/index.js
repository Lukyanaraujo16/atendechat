import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography,
  IconButton,
  makeStyles,
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import ConfirmationNumberOutlinedIcon from "@material-ui/icons/ConfirmationNumberOutlined";
import EventOutlinedIcon from "@material-ui/icons/EventOutlined";
import AttachMoneyOutlinedIcon from "@material-ui/icons/AttachMoneyOutlined";
import TrackChangesOutlinedIcon from "@material-ui/icons/TrackChangesOutlined";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import ArchiveOutlinedIcon from "@material-ui/icons/ArchiveOutlined";
import FilterListIcon from "@material-ui/icons/FilterList";
import MoreHorizIcon from "@material-ui/icons/MoreHoriz";

import MainContainer from "../../components/MainContainer";
import {
  AppPageHeader,
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppSecondaryButton,
  AppPrimaryButton,
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";
import useIsMobile from "../../hooks/useIsMobile";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  navigateFromNotificationData,
  notificationVisualType,
} from "../../utils/notificationNavigation";
import { formatNotificationTime } from "../../utils/formatNotificationTime";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  paper: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  tableWrap: {
    overflow: "auto",
    flex: 1,
  },
  unreadRow: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  mobileToolbar: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    width: "100%",
    maxWidth: "100%",
  },
  mobileTabs: {
    width: "100%",
    maxWidth: "100%",
  },
  mobileSearchRow: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    width: "100%",
  },
  mobileActionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    width: "100%",
  },
  mobileSelectBar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    width: "100%",
  },
  mobileCardChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    maxWidth: "100%",
  },
  unreadCard: {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
  },
}));

function TypeIcon({ v }) {
  if (v === "message") return <ChatBubbleOutlineIcon fontSize="small" color="action" />;
  if (v === "appointment") return <EventOutlinedIcon fontSize="small" color="action" />;
  if (v === "billing") return <AttachMoneyOutlinedIcon fontSize="small" color="action" />;
  if (v === "crm") return <TrackChangesOutlinedIcon fontSize="small" color="action" />;
  return <ConfirmationNumberOutlinedIcon fontSize="small" color="action" />;
}

function kindLabel(v) {
  if (v === "message") return i18n.t("userNotificationCenter.kindTicket");
  if (v === "appointment") return i18n.t("userNotificationCenter.kindAppointment");
  if (v === "billing") return i18n.t("userNotificationCenter.kindBilling");
  if (v === "crm") return i18n.t("userNotificationCenter.kindCrm");
  return i18n.t("userNotificationCenter.kindAll");
}

function statusLabel(n) {
  if (n.archivedAt) return i18n.t("userNotificationCenter.statusArchived");
  if (n.read) return i18n.t("userNotificationCenter.statusRead");
  return i18n.t("userNotificationCenter.statusUnread");
}

export default function UserNotificationsPage() {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState("all");
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});

  const canUse =
    Boolean(user?.id) &&
    (Boolean(user?.super) ||
      (user?.companyId != null && user?.companyId !== ""));

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([id]) => Number(id))
        .filter((id) => !Number.isNaN(id)),
    [selected]
  );

  const load = useCallback(async () => {
    if (!canUse) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
      };
      if (tab === "unread") params.read = "false";
      if (tab === "read") params.read = "true";
      if (tab === "archived") params.archived = "only";
      if (kind === "ticket") params.kind = "ticket";
      if (kind === "appointment") params.kind = "appointment";
      if (kind === "billing") params.kind = "billing";
      if (kind === "crm") params.kind = "crm";
      if (String(searchApplied).trim() !== "") params.q = String(searchApplied).trim();

      const { data } = await api.get("/notifications", { params });
      const list = Array.isArray(data?.notifications) ? data.notifications : [];
      const count = Number(data?.count) || 0;
      const maxPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1);
      if (list.length === 0 && page > maxPage) {
        setPage(maxPage);
        return;
      }
      setRows(list);
      setTotal(count);
      setSelected({});
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [canUse, page, rowsPerPage, tab, kind, searchApplied]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (id) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const toggleSelectAllOnPage = (checked) => {
    const next = { ...selected };
    rows.forEach((r) => {
      next[r.id] = checked;
    });
    setSelected(next);
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected[r.id]);

  const openRow = async (n) => {
    if (!n.read) {
      try {
        await api.put(`/notifications/${n.id}/read`);
        setRows((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x
          )
        );
      } catch (e) {
        toastError(e);
      }
    }
    navigateFromNotificationData(n.data, history, {
      effectiveFeatures: user?.effectiveUserFeatures,
    });
  };

  const markAll = async () => {
    try {
      await api.put("/notifications/read-all");
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const archiveAllRead = async () => {
    try {
      await api.put("/notifications/archive-all");
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const bulkMarkRead = async () => {
    if (!selectedIds.length) return;
    try {
      await api.put("/notifications/read-bulk", { ids: selectedIds });
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const bulkArchive = async () => {
    if (!selectedIds.length) return;
    try {
      await api.put("/notifications/archive-bulk", { ids: selectedIds });
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  const confirmAction = (messageKey) =>
    window.confirm(i18n.t(messageKey));

  const markOneRead = async (n) => {
    if (!n?.id || n.read) return;
    try {
      await api.put(`/notifications/${n.id}/read`);
      setRows((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x
        )
      );
    } catch (e) {
      toastError(e);
    }
  };

  const archiveOne = async (n) => {
    if (!n?.id) return;
    try {
      await api.put(`/notifications/${n.id}/archive`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteOne = async (n, e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (!confirmAction("userNotificationCenter.confirmDeleteOne")) return;
    try {
      await api.delete(`/notifications/${n.id}`);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirmAction("userNotificationCenter.confirmDeleteSelected")) return;
    try {
      await api.post("/notifications/delete-selected", { ids: selectedIds });
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteAllRead = async () => {
    if (!confirmAction("userNotificationCenter.confirmDeleteRead")) return;
    try {
      await api.post("/notifications/delete-read");
      setPage(0);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteAllArchived = async () => {
    if (!confirmAction("userNotificationCenter.confirmDeleteArchived")) return;
    try {
      await api.post("/notifications/delete-archived");
      setPage(0);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteAll = async () => {
    if (!confirmAction("userNotificationCenter.confirmDeleteAll")) return;
    try {
      await api.post("/notifications/delete-all", { confirm: true });
      setPage(0);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  if (!canUse) {
    return (
      <MainContainer>
        <Typography>{i18n.t("userNotificationCenter.noCompany")}</Typography>
      </MainContainer>
    );
  }

  const emptyMessage =
    tab === "unread"
      ? i18n.t("userNotificationCenter.emptyUnread")
      : tab === "read"
        ? i18n.t("userNotificationCenter.emptyRead")
        : tab === "archived"
          ? i18n.t("userNotificationCenter.emptyArchived")
          : String(searchApplied).trim() !== ""
            ? i18n.t("userNotificationCenter.emptyFiltered")
            : i18n.t("userNotificationCenter.empty");

  const buildNotificationActionItems = (n) => {
    const items = [
      {
        key: "open",
        label: i18n.t("userNotificationCenter.openDestination"),
        icon: <OpenInNewIcon fontSize="small" />,
        onClick: () => openRow(n),
      },
    ];
    if (!n.read) {
      items.push({
        key: "read",
        label: i18n.t("userNotificationCenter.markReadOne"),
        icon: <DoneAllIcon fontSize="small" />,
        onClick: () => markOneRead(n),
      });
    }
    if (!n.archivedAt) {
      items.push({
        key: "archive",
        label: i18n.t("userNotificationCenter.archiveOne"),
        icon: <ArchiveOutlinedIcon fontSize="small" />,
        onClick: () => archiveOne(n),
      });
    }
    items.push({ key: "delete-divider", divider: true });
    items.push({
      key: "delete",
      label: i18n.t("userNotificationCenter.deleteOneAria"),
      icon: <DeleteOutlineIcon fontSize="small" />,
      danger: true,
      onClick: () => deleteOne(n),
    });
    return items;
  };

  const renderNotificationMobileCard = (n) => {
    const visualType = notificationVisualType(n);
    return (
      <MobileEntityCard
        key={n.id}
        className={!n.read ? classes.unreadCard : undefined}
        leading={
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            style={{ gap: 4 }}
          >
            <Checkbox
              size="small"
              checked={Boolean(selected[n.id])}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelect(n.id)}
            />
            <TypeIcon v={visualType} />
          </Box>
        }
        title={n.title}
        subtitle={n.body}
        badges={
          <MobileActionsMenu
            items={buildNotificationActionItems(n)}
            ariaLabel={i18n.t("userNotificationCenter.mobile.actions")}
          />
        }
        onClick={() => openRow(n)}
      >
        <Box className={classes.mobileCardChips}>
          <Chip size="small" variant="outlined" label={kindLabel(visualType)} />
          <Chip
            size="small"
            variant="outlined"
            color={!n.read && !n.archivedAt ? "primary" : "default"}
            label={statusLabel(n)}
          />
        </Box>
        <Typography variant="caption" color="textSecondary" display="block">
          {n.createdAt ? formatNotificationTime(n.createdAt) : "—"}
        </Typography>
      </MobileEntityCard>
    );
  };

  const kindFilterControl = (
    <FormControl variant="outlined" size="small" fullWidth={isMobile}>
      <InputLabel id="notif-kind-label">
        {i18n.t("userNotificationCenter.filterKind")}
      </InputLabel>
      <Select
        labelId="notif-kind-label"
        label={i18n.t("userNotificationCenter.filterKind")}
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setPage(0);
        }}
      >
        <MenuItem value="">{i18n.t("userNotificationCenter.kindAll")}</MenuItem>
        <MenuItem value="ticket">{i18n.t("userNotificationCenter.kindTicket")}</MenuItem>
        <MenuItem value="appointment">
          {i18n.t("userNotificationCenter.kindAppointment")}
        </MenuItem>
        <MenuItem value="billing">{i18n.t("userNotificationCenter.kindBilling")}</MenuItem>
        <MenuItem value="crm">{i18n.t("userNotificationCenter.kindCrm")}</MenuItem>
      </Select>
    </FormControl>
  );

  return (
    <MainContainer className={classes.root}>
      <AppPageHeader
        title={
          <Typography variant="h5" color="primary" component="h1">
            {i18n.t("userNotificationCenter.pageTitle")}
          </Typography>
        }
      />
      {isMobile ? (
        <AppDialog
          open={filtersDialogOpen}
          onClose={() => setFiltersDialogOpen(false)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("userNotificationCenter.mobile.filters")}</AppDialogTitle>
          <AppDialogContent>
            {kindFilterControl}
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={() => setFiltersDialogOpen(false)}>
              {i18n.t("transferTicketModal.buttons.cancel")}
            </AppSecondaryButton>
            <AppPrimaryButton
              onClick={() => {
                setFiltersDialogOpen(false);
                setPage(0);
              }}
            >
              {i18n.t("userNotificationCenter.mobile.applyFilters")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : null}

      {isMobile ? (
        <AppDialog
          open={bulkActionsOpen}
          onClose={() => setBulkActionsOpen(false)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("userNotificationCenter.mobile.bulkActions")}</AppDialogTitle>
          <AppDialogContent>
            <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
              <Button variant="outlined" size="small" onClick={() => { markAll(); setBulkActionsOpen(false); }}>
                {i18n.t("userNotificationCenter.markAllRead")}
              </Button>
              <Button variant="outlined" size="small" onClick={() => { archiveAllRead(); setBulkActionsOpen(false); }}>
                {i18n.t("userNotificationCenter.archiveRead")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={!selectedIds.length}
                onClick={() => { bulkMarkRead(); setBulkActionsOpen(false); }}
              >
                {i18n.t("userNotificationCenter.bulkMarkRead")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={!selectedIds.length}
                onClick={() => { bulkArchive(); setBulkActionsOpen(false); }}
              >
                {i18n.t("userNotificationCenter.bulkArchive")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                disabled={!selectedIds.length}
                onClick={() => { bulkDelete(); setBulkActionsOpen(false); }}
              >
                {i18n.t("userNotificationCenter.bulkDelete")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={() => { deleteAllRead(); setBulkActionsOpen(false); }}
              >
                {i18n.t("userNotificationCenter.deleteRead")}
              </Button>
              {tab === "archived" ? (
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={() => { deleteAllArchived(); setBulkActionsOpen(false); }}
                >
                  {i18n.t("userNotificationCenter.deleteArchived")}
                </Button>
              ) : null}
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={() => { deleteAll(); setBulkActionsOpen(false); }}
              >
                {i18n.t("userNotificationCenter.deleteAll")}
              </Button>
            </Box>
          </AppDialogContent>
          <AppDialogActions>
            <AppSecondaryButton onClick={() => setBulkActionsOpen(false)}>
              {i18n.t("transferTicketModal.buttons.cancel")}
            </AppSecondaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : null}

      <Paper className={classes.paper} elevation={1}>
        <Box px={2} pt={2} className={isMobile ? classes.mobileToolbar : classes.toolbar}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setPage(0);
            }}
            indicatorColor="primary"
            textColor="primary"
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons={isMobile ? "auto" : undefined}
            className={isMobile ? classes.mobileTabs : undefined}
          >
            <Tab label={i18n.t("userNotificationCenter.all")} value="all" />
            <Tab label={i18n.t("userNotificationCenter.unread")} value="unread" />
            <Tab label={i18n.t("userNotificationCenter.readTab")} value="read" />
            <Tab label={i18n.t("userNotificationCenter.archivedTab")} value="archived" />
          </Tabs>

          {isMobile ? (
            <Box className={classes.mobileSearchRow}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder={i18n.t("userNotificationCenter.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearchApplied(search);
                    setPage(0);
                  }
                }}
              />
              <Box className={classes.mobileActionsRow}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSearchApplied(search);
                    setPage(0);
                  }}
                >
                  {i18n.t("userNotificationCenter.searchButton")}
                </Button>
                <AppSecondaryButton
                  size="small"
                  startIcon={<FilterListIcon />}
                  onClick={() => setFiltersDialogOpen(true)}
                >
                  {i18n.t("userNotificationCenter.mobile.filters")}
                </AppSecondaryButton>
                <AppSecondaryButton
                  size="small"
                  startIcon={<MoreHorizIcon />}
                  onClick={() => setBulkActionsOpen(true)}
                >
                  {i18n.t("userNotificationCenter.mobile.bulkActions")}
                </AppSecondaryButton>
              </Box>
              <Box className={classes.mobileSelectBar}>
                <Checkbox
                  indeterminate={selectedIds.length > 0 && !allOnPageSelected}
                  checked={allOnPageSelected}
                  onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  size="small"
                />
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("userNotificationCenter.mobile.selectAll")}
                  {selectedIds.length > 0
                    ? ` · ${i18n.t("userNotificationCenter.mobile.selectedCount", { count: selectedIds.length })}`
                    : ""}
                </Typography>
              </Box>
            </Box>
          ) : null}
        </Box>

        {!isMobile ? (
          <>
            <Box px={2} pb={1} className={classes.toolbar}>
              <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
                <InputLabel id="notif-kind-label-desktop">
                  {i18n.t("userNotificationCenter.filterKind")}
                </InputLabel>
                <Select
                  labelId="notif-kind-label-desktop"
                  label={i18n.t("userNotificationCenter.filterKind")}
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">{i18n.t("userNotificationCenter.kindAll")}</MenuItem>
                  <MenuItem value="ticket">{i18n.t("userNotificationCenter.kindTicket")}</MenuItem>
                  <MenuItem value="appointment">
                    {i18n.t("userNotificationCenter.kindAppointment")}
                  </MenuItem>
                  <MenuItem value="billing">{i18n.t("userNotificationCenter.kindBilling")}</MenuItem>
                  <MenuItem value="crm">{i18n.t("userNotificationCenter.kindCrm")}</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                variant="outlined"
                placeholder={i18n.t("userNotificationCenter.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearchApplied(search);
                    setPage(0);
                  }
                }}
                style={{ flex: "1 1 200px", maxWidth: 360 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSearchApplied(search);
                  setPage(0);
                }}
              >
                {i18n.t("userNotificationCenter.searchButton")}
              </Button>
              <Box flex="1" />
              <Button variant="outlined" size="small" onClick={markAll}>
                {i18n.t("userNotificationCenter.markAllRead")}
              </Button>
              <Button variant="outlined" size="small" onClick={archiveAllRead}>
                {i18n.t("userNotificationCenter.archiveRead")}
              </Button>
            </Box>
            <Box px={2} pb={1} className={classes.toolbar}>
              <Button
                size="small"
                variant="text"
                disabled={!selectedIds.length}
                onClick={bulkMarkRead}
              >
                {i18n.t("userNotificationCenter.bulkMarkRead")}
              </Button>
              <Button
                size="small"
                variant="text"
                disabled={!selectedIds.length}
                onClick={bulkArchive}
              >
                {i18n.t("userNotificationCenter.bulkArchive")}
              </Button>
              <Button
                size="small"
                variant="text"
                color="secondary"
                disabled={!selectedIds.length}
                onClick={bulkDelete}
              >
                {i18n.t("userNotificationCenter.bulkDelete")}
              </Button>
              <Button size="small" variant="text" color="secondary" onClick={deleteAllRead}>
                {i18n.t("userNotificationCenter.deleteRead")}
              </Button>
              {tab === "archived" ? (
                <Button
                  size="small"
                  variant="text"
                  color="secondary"
                  onClick={deleteAllArchived}
                >
                  {i18n.t("userNotificationCenter.deleteArchived")}
                </Button>
              ) : null}
              <Button size="small" variant="text" color="secondary" onClick={deleteAll}>
                {i18n.t("userNotificationCenter.deleteAll")}
              </Button>
            </Box>
          </>
        ) : null}

        <Box className={classes.tableWrap} px={isMobile ? 2 : 0} pb={isMobile ? 2 : 0}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={32} />
            </Box>
          ) : isMobile ? (
            rows.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                {emptyMessage}
              </Typography>
            ) : (
              <MobileCardList>
                {rows.map((n) => renderNotificationMobileCard(n))}
              </MobileCardList>
            )
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={
                        selectedIds.length > 0 && !allOnPageSelected
                      }
                      checked={allOnPageSelected}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell width={48} />
                  <TableCell>{i18n.t("userNotificationCenter.colTitle")}</TableCell>
                  <TableCell>{i18n.t("userNotificationCenter.colPreview")}</TableCell>
                  <TableCell width={160}>{i18n.t("userNotificationCenter.colWhen")}</TableCell>
                  <TableCell width={120}>{i18n.t("userNotificationCenter.colStatus")}</TableCell>
                  <TableCell width={56} align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="textSecondary">
                        {emptyMessage}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((n) => (
                    <TableRow
                      key={n.id}
                      hover
                      className={!n.read ? classes.unreadRow : undefined}
                      onClick={() => openRow(n)}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell
                        padding="checkbox"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={Boolean(selected[n.id])}
                          onChange={() => toggleSelect(n.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <TypeIcon v={notificationVisualType(n)} />
                      </TableCell>
                      <TableCell>{n.title}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary" noWrap>
                          {n.body}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {n.createdAt ? formatNotificationTime(n.createdAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {statusLabel(n)}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("userNotificationCenter.deleteOneAria")}
                          onClick={(e) => deleteOne(n, e)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Box>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onChangePage={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onChangeRowsPerPage={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage={i18n.t("userNotificationCenter.rowsPerPage")}
        />
      </Paper>
    </MainContainer>
  );
}
