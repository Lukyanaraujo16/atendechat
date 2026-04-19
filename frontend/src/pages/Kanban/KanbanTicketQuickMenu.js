import React, { useState, useEffect, useCallback, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import FormControl from "@material-ui/core/FormControl";
import FormHelperText from "@material-ui/core/FormHelperText";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import PersonAddDisabledOutlinedIcon from "@material-ui/icons/PersonAddDisabledOutlined";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";
import DoneOutlinedIcon from "@material-ui/icons/DoneOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  iconBtn: {
    padding: 4,
    margin: -4,
    marginLeft: 4,
  },
  menuPaper: {
    minWidth: 220,
  },
}));

/** Utilizadores vinculados ao setor via associação User.queues (ListUsersService inclui `queues`). */
function userHasQueueMembership(user, queueId) {
  const q = Number(queueId);
  if (!queueId || Number.isNaN(q)) return false;
  return Array.isArray(user?.queues) && user.queues.some((x) => Number(x.id) === q);
}

function filterUsersByQueue(usersList, queueId) {
  if (!queueId || !Array.isArray(usersList)) return [];
  return usersList.filter((u) => userHasQueueMembership(u, queueId));
}

function buildUpdateBody(ticket, overrides) {
  return {
    status: overrides.status !== undefined ? overrides.status : ticket.status,
    userId: overrides.userId !== undefined ? overrides.userId : ticket.userId ?? null,
    queueId: overrides.queueId !== undefined ? overrides.queueId : ticket.queueId ?? null,
    whatsappId: ticket.whatsappId != null ? String(ticket.whatsappId) : undefined,
    useIntegration: ticket.useIntegration ?? false,
    promptId: ticket.promptId ?? null,
    integrationId: ticket.integrationId ?? null,
  };
}

/**
 * Menu discreto + diálogos para ações rápidas no card do Kanban.
 */
const KanbanTicketQuickMenu = ({
  ticket,
  authUser,
  usersList,
  queuesList,
  onTicketUpdated,
  canTransfer = true,
}) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tagOptions, setTagOptions] = useState([]);
  const [transferQueueId, setTransferQueueId] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [tagsSelection, setTagsSelection] = useState([]);

  const menuOpen = Boolean(anchorEl);

  const attendantsForSelectedQueue = useMemo(
    () => filterUsersByQueue(usersList, transferQueueId ? Number(transferQueueId) : null),
    [usersList, transferQueueId]
  );

  useEffect(() => {
    if (dialog !== "transfer" || !transferQueueId || !transferUserId) return;
    const allowed = attendantsForSelectedQueue.some((u) => String(u.id) === transferUserId);
    if (!allowed) setTransferUserId("");
  }, [dialog, transferQueueId, transferUserId, attendantsForSelectedQueue]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/tags/list");
        const list = Array.isArray(data) ? data : data?.tags || [];
        setTagOptions(Array.isArray(list) ? list : []);
      } catch (e) {
        toastError(e);
      }
    };
    load();
  }, []);

  const closeMenu = () => setAnchorEl(null);

  const handleOpenMenu = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setAnchorEl(e.currentTarget);
  };

  const openDialog = (type) => {
    closeMenu();
    if (type === "transfer") {
      setTransferQueueId(ticket.queueId ? String(ticket.queueId) : "");
      setTransferUserId("");
    }
    if (type === "tags") {
      setTagsSelection(Array.isArray(ticket.tags) ? [...ticket.tags] : []);
    }
    setDialog(type);
  };

  const putTicket = async (body) => {
    setSaving(true);
    try {
      const { data } = await api.put(`/tickets/${ticket.id}`, body);
      if (data) onTicketUpdated(data);
      setDialog(null);
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = () => {
    closeMenu();
    putTicket(buildUpdateBody(ticket, { userId: null }));
  };

  const handleTransferSave = () => {
    if (!transferQueueId) return;
    const newQueueId = Number(transferQueueId);
    const overrides = { queueId: newQueueId };
    if (transferUserId) {
      const newUserId = Number(transferUserId);
      if (ticket.userId != null && newUserId !== ticket.userId) {
        if (!window.confirm(i18n.t("kanban.quickActions.confirmTransferUser"))) return;
      }
      overrides.userId = newUserId;
    }
    putTicket(buildUpdateBody(ticket, overrides));
  };

  const handleTagsSave = async () => {
    setSaving(true);
    try {
      const tagsPayload = tagsSelection
        .map((t) => (t && typeof t === "object" && t.id ? t : null))
        .filter(Boolean);
      await api.post("/tags/sync", {
        ticketId: ticket.id,
        tags: tagsPayload,
      });
      onTicketUpdated({
        ...ticket,
        tags: tagsPayload,
      });
      setDialog(null);
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseTicket = useCallback(() => {
    closeMenu();
    if (!window.confirm(i18n.t("kanban.quickActions.confirmClose"))) return;
    setSaving(true);
    api
      .put(`/tickets/${ticket.id}`, {
        status: "closed",
        userId: authUser?.id,
        queueId: ticket.queue?.id ?? ticket.queueId,
        useIntegration: false,
        promptId: null,
        integrationId: null,
      })
      .then(({ data }) => {
        if (data) onTicketUpdated(data);
      })
      .catch(toastError)
      .finally(() => setSaving(false));
  }, [ticket, authUser, onTicketUpdated]);

  const isClosed = ticket.status === "closed";
  const transferAllowed = Boolean(canTransfer);
  const iconTooltip = transferAllowed
    ? i18n.t("kanban.quickActions.transferTooltip")
    : i18n.t("kanban.quickActions.menuAria");

  return (
    <>
      <span
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      >
        <Tooltip title={iconTooltip}>
          <IconButton
            className={classes.iconBtn}
            size="small"
            aria-label={i18n.t("kanban.quickActions.menuAria")}
            onClick={handleOpenMenu}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </span>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        classes={{ paper: classes.menuPaper }}
      >
        {!isClosed && transferAllowed && (
          <MenuItem
            onClick={() => {
              openDialog("transfer");
            }}
          >
            <ListItemIcon>
              <SwapHorizIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={i18n.t("kanban.quickActions.transferConversation")} />
          </MenuItem>
        )}
        {!isClosed && transferAllowed && ticket.userId && (
          <MenuItem onClick={handleUnassign}>
            <ListItemIcon>
              <PersonAddDisabledOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={i18n.t("kanban.quickActions.unassign")} />
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            openDialog("tags");
          }}
        >
          <ListItemIcon>
            <LocalOfferOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={i18n.t("kanban.quickActions.tags")} />
        </MenuItem>
        {!isClosed && (
          <MenuItem onClick={handleCloseTicket} disabled={saving}>
            <ListItemIcon>
              <DoneOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={i18n.t("kanban.quickActions.close")} />
          </MenuItem>
        )}
      </Menu>

      <Dialog open={dialog === "transfer"} onClose={() => !saving && setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{i18n.t("kanban.quickActions.transferConversation")}</DialogTitle>
        <DialogContent>
          <FormControl variant="outlined" margin="normal" fullWidth size="small" required>
            <InputLabel>{i18n.t("kanban.quickActions.selectQueue")}</InputLabel>
            <Select
              label={i18n.t("kanban.quickActions.selectQueue")}
              value={transferQueueId}
              onChange={(e) => setTransferQueueId(e.target.value)}
            >
              {(queuesList || []).map((q) => (
                <MenuItem key={q.id} value={String(q.id)}>
                  {q.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            variant="outlined"
            margin="normal"
            fullWidth
            size="small"
            disabled={!transferQueueId}
          >
            <InputLabel>{i18n.t("kanban.quickActions.selectUserOptional")}</InputLabel>
            <Select
              label={i18n.t("kanban.quickActions.selectUserOptional")}
              value={transferUserId}
              onChange={(e) => setTransferUserId(e.target.value)}
              displayEmpty
              disabled={!transferQueueId}
            >
              <MenuItem value="">
                <em>{i18n.t("kanban.quickActions.keepCurrentAttendant")}</em>
              </MenuItem>
              {attendantsForSelectedQueue.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
            {transferQueueId && attendantsForSelectedQueue.length === 0 ? (
              <FormHelperText>{i18n.t("kanban.quickActions.noAttendantsForQueue")}</FormHelperText>
            ) : null}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saving}>
            {i18n.t("kanban.quickActions.cancel")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={saving || !transferQueueId}
            onClick={handleTransferSave}
          >
            {i18n.t("kanban.quickActions.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === "tags"} onClose={() => !saving && setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("kanban.quickActions.tags")}</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={tagOptions}
            value={tagsSelection}
            onChange={(e, v) => setTagsSelection(v)}
            getOptionLabel={(o) => (typeof o === "string" ? o : o?.name || "")}
            getOptionSelected={(option, value) => Boolean(value) && option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                margin="normal"
                placeholder={i18n.t("kanban.quickActions.tagsPlaceholder")}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={saving}>
            {i18n.t("kanban.quickActions.cancel")}
          </Button>
          <Button color="primary" variant="contained" disabled={saving} onClick={handleTagsSave}>
            {i18n.t("kanban.quickActions.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default KanbanTicketQuickMenu;
