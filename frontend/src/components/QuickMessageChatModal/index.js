import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { toast } from "react-toastify";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";
import { isString } from "lodash";
import clsx from "clsx";
import StarIcon from "@material-ui/icons/Star";
import StarBorderIcon from "@material-ui/icons/StarBorder";

import { i18n } from "../../translate/i18n";
import useQuickMessages from "../../hooks/useQuickMessages";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import toastError from "../../errors/toastError";
import resolveQuickMessageTemplate from "../../utils/resolveQuickMessageTemplate";
import { getFavoriteIds, getRecentIds, toggleFavorite } from "../../utils/quickMessageChatStorage";

const previewText = (text, max = 100) => {
  if (!text || typeof text !== "string") return "—";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
};

const useStyles = makeStyles((theme) => ({
  listRoot: {
    maxHeight: 340,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  hint: {
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  variablesHint: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
  },
  sectionTitle: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(0.5),
  },
  sectionFirst: {
    marginTop: 0,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
}));

const QuickMessageChatModal = ({
  open,
  onClose,
  chatInputControllerRef,
  contact: contactProp,
  ticket: ticketProp,
}) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { list, save } = useQuickMessages();
  const socketManager = useContext(SocketContext);
  const contact = contactProp || {};
  const ticket = ticketProp || {};

  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newShortcode, setNewShortcode] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [favIds, setFavIds] = useState([]);

  const resolvedPreview = useCallback(
    (raw) =>
      resolveQuickMessageTemplate(
        isString(raw) ? raw : String(raw || ""),
        {
          contact,
          ticket,
          user,
          greeting: i18n.t("quickMessages.chat.greetingDefault"),
        }
      ),
    [contact, ticket, user]
  );

  useEffect(() => {
    if (open && user?.id) {
      setFavIds(getFavoriteIds(user.id));
    }
  }, [open, user?.id]);

  const loadList = useCallback(async () => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const messages = await list({ companyId, userId: user.id });
      setItems(Array.isArray(messages) ? messages : []);
    } catch (err) {
      toastError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [list, user?.id]);

  useEffect(() => {
    if (open) {
      loadList();
    } else {
      setSearch("");
      setShowForm(false);
      setNewShortcode("");
      setNewMessage("");
      setSelectedCategory(null);
    }
  }, [open, loadList]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (!open || !companyId || !user?.id) return;
    const socket = socketManager.getSocket(companyId);
    const onQm = () => {
      loadList();
    };
    socket.on(`company-${companyId}-quickmessage`, onQm);
    return () => {
      socket.off(`company-${companyId}-quickmessage`, onQm);
    };
  }, [open, socketManager, user?.id, loadList]);

  const applyAndClose = (row) => {
    const ref = chatInputControllerRef?.current;
    if (ref?.applyQuick) {
      ref.applyQuick(row);
    }
    onClose();
  };

  const handleStar = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    if (user?.id) {
      setFavIds(toggleFavorite(user.id, id));
    }
  };

  const categories = useMemo(() => {
    const s = new Set();
    (items || []).forEach((m) => {
      if (m.category && String(m.category).trim() !== "") {
        s.add(String(m.category).trim());
      }
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [items]);


  const needle = (search || "").toLowerCase().trim();
  const favSet = useMemo(() => new Set(favIds), [favIds]);

  const baseFiltered = useMemo(() => {
    return (items || []).filter((m) => {
      if (selectedCategory != null) {
        const c = m.category && String(m.category).trim() !== "" ? String(m.category).trim() : "";
        if (c !== selectedCategory) return false;
      }
      if (!needle) return true;
      const sc = (m.shortcode && String(m.shortcode).toLowerCase()) || "";
      const body = (m.message && String(m.message).toLowerCase()) || "";
      const cat = (m.category && String(m.category).toLowerCase()) || "";
      return (
        sc.includes(needle) ||
        body.includes(needle) ||
        cat.includes(needle) ||
        `/${sc}`.includes(needle)
      );
    });
  }, [items, selectedCategory, needle]);

  const { favoritesList, recentsList, restList } = useMemo(() => {
    const recentIds = user?.id ? getRecentIds(user.id) : [];
    const recentSet = new Set(recentIds);
    const pool = baseFiltered;
    const favList = pool
      .filter((m) => favSet.has(m.id))
      .sort((a, b) => {
        const ia = favIds.indexOf(a.id);
        const ib = favIds.indexOf(b.id);
        return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
      });
    const recList = recentIds
      .map((id) => pool.find((m) => m.id === id))
      .filter(
        (m) => m && !favSet.has(m.id)
      );
    const rest = pool
      .filter((m) => !favSet.has(m.id) && !recentSet.has(m.id))
      .sort((a, b) =>
        String(a.shortcode || "").localeCompare(String(b.shortcode || ""), undefined, { sensitivity: "base" })
      );
    return { favoritesList: favList, recentsList: recList, restList: rest };
  }, [baseFiltered, favIds, favSet, user?.id, open]);

  const handleSaveNew = async () => {
    const companyId = localStorage.getItem("companyId");
    if (!companyId || !user?.id) return;

    const sc = newShortcode.trim();
    const msg = newMessage.trim();
    if (sc.length < 2) {
      toast.error(i18n.t("quickMessages.validation.shortcodeMin"));
      return;
    }
    if (msg.length < 1) {
      toast.error(i18n.t("quickMessages.validation.messageRequired"));
      return;
    }

    setSaving(true);
    try {
      await save({ shortcode: sc, message: msg });
      toast.success(i18n.t("quickMessages.toasts.success"));
      setShowForm(false);
      setNewShortcode("");
      setNewMessage("");
      await loadList();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = (m) => {
    const isFav = favSet.has(m.id);
    const primary = (
      <span className={classes.titleRow}>
        <Typography component="span" variant="body2" noWrap>
          /{m.shortcode}
        </Typography>
        {m.category && String(m.category).trim() !== "" ? (
          <Chip
            size="small"
            label={String(m.category).trim()}
            color="default"
            variant="outlined"
          />
        ) : null}
        {m.mediaPath ? (
          <Chip
            size="small"
            label={i18n.t("quickMessages.table.attachment")}
          />
        ) : null}
      </span>
    );
    const rawLine = isString(m.message) ? m.message : String(m.message || "");
    return (
      <ListItem
        key={m.id}
        button
        onClick={() => applyAndClose(m)}
      >
        <ListItemText
          primary={primary}
          secondary={previewText(resolvedPreview(rawLine))}
        />
        {user?.id ? (
          <ListItemSecondaryAction>
            <IconButton
              edge="end"
              size="small"
              onClick={(e) => handleStar(e, m.id)}
              aria-label={i18n.t("quickMessages.chat.favoriteToggle")}
            >
              {isFav ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </ListItemSecondaryAction>
        ) : null}
      </ListItem>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        {i18n.t("quickMessages.chat.title")}
      </DialogTitle>
      <DialogContent dividers>
        {showForm ? (
          <Box className={classes.form}>
            <TextField
              label={i18n.t("quickMessages.dialog.shortcode")}
              value={newShortcode}
              onChange={(e) => setNewShortcode(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              helperText={i18n.t("quickMessages.dialog.shortcodeHelper")}
            />
            <TextField
              label={i18n.t("quickMessages.dialog.message")}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              multiline
              minRows={3}
            />
          </Box>
        ) : (
          <>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              placeholder={i18n.t("quickMessages.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Typography variant="body2" className={classes.hint}>
              {i18n.t("quickMessages.chat.hintSlash")}
            </Typography>
            <Typography variant="body2" className={classes.variablesHint}>
              {i18n.t("quickMessages.chat.variablesHint")}
            </Typography>
            <div className={classes.chipRow}>
                <Chip
                  size="small"
                  label={i18n.t("quickMessages.chat.categoryAll")}
                  onClick={() => setSelectedCategory(null)}
                  color={selectedCategory == null ? "primary" : "default"}
                />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    size="small"
                    label={c}
                    onClick={() => setSelectedCategory(c)}
                    color={selectedCategory === c ? "primary" : "default"}
                    variant="outlined"
                  />
                ))}
            </div>
            <List dense className={classes.listRoot} component="nav">
              {loading ? (
                <ListItem>
                  <ListItemText
                    primary={i18n.t("quickMessages.chat.loadingList")}
                  />
                </ListItem>
              ) : baseFiltered.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary={i18n.t("quickMessages.empty.title")}
                    secondary={i18n.t("quickMessages.chat.emptyFilter")}
                  />
                </ListItem>
              ) : (
                <>
                  {favoritesList.length > 0 ? (
                    <>
                      <Typography
                        variant="subtitle2"
                        className={clsx(classes.sectionTitle, classes.sectionFirst)}
                        color="textSecondary"
                      >
                        {i18n.t("quickMessages.chat.sectionsFavorites")}
                      </Typography>
                      {favoritesList.map((m) => renderItem(m))}
                    </>
                  ) : null}
                  {recentsList.length > 0 ? (
                    <>
                      <Typography
                        variant="subtitle2"
                        className={favoritesList.length > 0 ? classes.sectionTitle : classes.sectionFirst}
                        color="textSecondary"
                      >
                        {i18n.t("quickMessages.chat.sectionsRecents")}
                      </Typography>
                      {recentsList.map((m) => renderItem(m))}
                    </>
                  ) : null}
                  {restList.length > 0 ? (
                    <>
                      <Typography
                        variant="subtitle2"
                        className={
                          favoritesList.length > 0 || recentsList.length > 0
                            ? classes.sectionTitle
                            : classes.sectionFirst
                        }
                        color="textSecondary"
                      >
                        {i18n.t("quickMessages.chat.sectionsAll")}
                      </Typography>
                      {restList.map((m) => renderItem(m))}
                    </>
                  ) : null}
                </>
              )}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        {showForm ? (
          <>
            <Button
              onClick={() => {
                setShowForm(false);
                setNewShortcode("");
                setNewMessage("");
              }}
            >
              {i18n.t("quickMessages.chat.backToList")}
            </Button>
            <Button
              color="primary"
              variant="contained"
              onClick={handleSaveNew}
              disabled={saving}
            >
              {i18n.t("quickMessages.dialog.save")}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onClose}
            >
              {i18n.t("quickMessages.buttons.cancel")}
            </Button>
            <Button
              color="primary"
              variant="outlined"
              onClick={() => setShowForm(true)}
            >
              {i18n.t("quickMessages.chat.newReply")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default QuickMessageChatModal;
