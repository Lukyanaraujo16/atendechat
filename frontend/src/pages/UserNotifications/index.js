import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
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
  makeStyles,
} from "@material-ui/core";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import ConfirmationNumberOutlinedIcon from "@material-ui/icons/ConfirmationNumberOutlined";
import EventOutlinedIcon from "@material-ui/icons/EventOutlined";
import AttachMoneyOutlinedIcon from "@material-ui/icons/AttachMoneyOutlined";

import MainContainer from "../../components/MainContainer";
import { AppPageHeader } from "../../ui";
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
}));

function TypeIcon({ v }) {
  if (v === "message") return <ChatBubbleOutlineIcon fontSize="small" color="action" />;
  if (v === "appointment") return <EventOutlinedIcon fontSize="small" color="action" />;
  if (v === "billing") return <AttachMoneyOutlinedIcon fontSize="small" color="action" />;
  return <ConfirmationNumberOutlinedIcon fontSize="small" color="action" />;
}

export default function UserNotificationsPage() {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState("all");
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
      if (String(searchApplied).trim() !== "") params.q = String(searchApplied).trim();

      const { data } = await api.get("/notifications", { params });
      setRows(Array.isArray(data?.notifications) ? data.notifications : []);
      setTotal(Number(data?.count) || 0);
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
    navigateFromNotificationData(n.data, history);
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

  return (
    <MainContainer className={classes.root}>
      <AppPageHeader
        title={
          <Typography variant="h5" color="primary" component="h1">
            {i18n.t("userNotificationCenter.pageTitle")}
          </Typography>
        }
      />
      <Paper className={classes.paper} elevation={1}>
        <Box px={2} pt={2} className={classes.toolbar}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setPage(0);
            }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label={i18n.t("userNotificationCenter.all")} value="all" />
            <Tab label={i18n.t("userNotificationCenter.unread")} value="unread" />
            <Tab label={i18n.t("userNotificationCenter.readTab")} value="read" />
            <Tab label={i18n.t("userNotificationCenter.archivedTab")} value="archived" />
          </Tabs>
        </Box>
        <Box px={2} pb={1} className={classes.toolbar}>
          <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
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
        </Box>
        <Box className={classes.tableWrap}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={32} />
            </Box>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
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
                        {n.archivedAt
                          ? i18n.t("userNotificationCenter.statusArchived")
                          : n.read
                            ? i18n.t("userNotificationCenter.statusRead")
                            : i18n.t("userNotificationCenter.statusUnread")}
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
