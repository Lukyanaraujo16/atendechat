import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";

import { useHistory } from "react-router-dom";
import {
  parseISO,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  differenceInCalendarDays,
  differenceInMinutes,
  differenceInHours,
  startOfDay,
  isValid,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import clsx from "clsx";

import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Badge from "@material-ui/core/Badge";
import { Tooltip } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import AndroidIcon from "@material-ui/icons/Android";
import VisibilityIcon from "@material-ui/icons/Visibility";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import InstagramIcon from "@material-ui/icons/Instagram";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import TicketMessagesDialog from "../TicketMessagesDialog";
import ConfirmationModal from "../ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";
import { useAcceptTicket } from "../../hooks/useAcceptTicket";
import useIsMobile from "../../hooks/useIsMobile";

import ContactTag from "../ContactTag";
import ContactLabelChip from "../ContactLabelChip";
import { canDeleteTickets } from "../../utils/canDeleteTickets";
import { formatTicketLastMessagePreview } from "../../utils/formatTicketLastMessagePreview";
import {
  getSubtleBorder,
  getSubtleBorderColor,
  getInboxCardSurface,
  getInboxCardSurfaceHover,
  getCardElevation,
  getCardElevationHover,
  getCardSelectedBackground,
  getCardSelectedBorder,
  getCardSelectedShadow,
} from "../../theme/ticketPanelStyles";
import { toast } from "react-toastify";

const MAX_TAGS_VISIBLE = 3;
const MAX_CONTACT_LABELS_VISIBLE = 2;

/** Tempo relativo legível estilo lista de conversas (sem alterar dados do ticket). */
function formatWhatsAppListTime(date) {
  if (!date || !isValid(date)) return "";
  const now = new Date();
  if (isToday(date)) {
    const mins = differenceInMinutes(now, date);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins} min`;
    const hrs = differenceInHours(now, date);
    if (hrs < 24) return `há ${hrs} h`;
    return format(date, "HH:mm", { locale: ptBR });
  }
  if (isYesterday(date)) return "Ontem";
  const dayDiff = differenceInCalendarDays(startOfDay(now), startOfDay(date));
  if (dayDiff >= 2 && dayDiff <= 6) return `há ${dayDiff} dias`;
  if (dayDiff > 6) return format(date, "dd/MM/yy", { locale: ptBR });
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

/**
 * Item da lista de atendimentos.
 * Fase 3 (atalhos): setas para navegar entre linhas; Enter abre o ticket (comportamento nativo do ListItem botão).
 * Ações rápidas extras por ícone na linha não foram adicionadas para não repetir Aceitar/Finalizar já na base do card;
 * o ponto natural seria ListItemSecondaryAction com IconButton size="small" + Tooltip só no hover.
 */
const MICRO_MS = 180;
const MICRO_EASE = "ease";
const CARD_MS = 220;
const CARD_RADIUS = 14;

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
  listItemRoot: {
    position: "relative",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: CARD_RADIUS,
    margin: 0,
    marginBottom: 10,
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    border: getSubtleBorder(theme),
    backgroundColor: getInboxCardSurface(theme),
    boxShadow: getCardElevation(theme),
    "&.MuiListItem-root": {
      borderRadius: CARD_RADIUS,
    },
    transition: `all ${MICRO_MS}ms ${MICRO_EASE}`,
    cursor: "pointer",
    "@media (hover: hover)": {
      "&:hover:not($listItemSelected):not($listItemBusy)": {
        backgroundColor: getInboxCardSurfaceHover(theme),
        border: `1px solid ${alpha(theme.palette.success.main, 0.14)}`,
        boxShadow: getCardElevationHover(theme),
      },
    },
    "&$listItemSelected:hover": {
      background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.2)}, ${alpha(theme.palette.success.main, 0.1)})`,
    },
    "&:focus-visible": {
      outline: `2px solid ${alpha(theme.palette.success.main, 0.55)}`,
      outlineOffset: 2,
    },
    "&.Mui-selected": {
      backgroundColor: "transparent",
    },
    "&:hover $actionsRow, &$listItemSelected $actionsRow": {
      opacity: 1,
      maxHeight: 120,
      marginTop: theme.spacing(1),
      paddingTop: theme.spacing(0.75),
      borderTopWidth: 1,
    },
    "@media (max-width: 959px)": {
      "& $actionsRow": {
        opacity: 1,
        maxHeight: 120,
        marginTop: theme.spacing(1),
        paddingTop: theme.spacing(0.75),
        borderTopWidth: 1,
      },
    },
  },
  listItemSelected: {
    border: getCardSelectedBorder(theme),
    background: getCardSelectedBackground(theme),
    boxShadow: getCardSelectedShadow(theme),
  },
  listItemBusy: {
    opacity: 0.6,
    pointerEvents: "none",
  },
  listItemCompact: {
    padding: "10px 12px",
    marginBottom: 8,
  },
  listItemBulkSelect: {
    paddingLeft: 10,
    paddingRight: 12,
  },
  bulkCheckbox: {
    padding: 4,
    marginRight: theme.spacing(0.5),
    alignSelf: "center",
    flexShrink: 0,
  },
  queueBar: {
    flex: "none",
    width: 4,
    alignSelf: "stretch",
    flexShrink: 0,
    borderRadius: 999,
    marginRight: theme.spacing(0.75),
    marginTop: 2,
    marginBottom: 2,
    minHeight: 36,
  },
  cardBodyRow: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 11,
  },
  avatarWrap: {
    alignSelf: "center",
    flexShrink: 0,
    minWidth: "auto",
    marginRight: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    fontSize: "1.125rem",
    fontWeight: 600,
    borderRadius: "50%",
    overflow: "hidden",
    border: `1px solid ${alpha(theme.palette.success.main, 0.18)}`,
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
    "& .MuiAvatar-img": {
      borderRadius: "50%",
      objectFit: "cover",
      width: "100%",
      height: "100%",
    },
  },
  avatarSelected: {
    border: `1px solid ${alpha(theme.palette.success.main, 0.55)}`,
  },
  avatarCompact: {
    width: 44,
    height: 44,
    fontSize: "1rem",
  },
  unreadBadge: {
    fontSize: "0.65rem",
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    lineHeight: "18px",
    borderRadius: 999,
    transform: "scale(1) translate(18%, -12%)",
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
    alignSelf: "center",
    paddingTop: 1,
    paddingBottom: 1,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    minHeight: 22,
  },
  nameBlock: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: 1,
    gap: theme.spacing(0.5),
  },
  contactNameCompact: {
    fontSize: "0.875rem",
  },
  contactName: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    lineHeight: 1.35,
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  topRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: theme.spacing(0.25),
    flexShrink: 0,
    maxWidth: "38%",
    paddingTop: 1,
  },
  timeText: {
    fontSize: "0.72rem",
    fontWeight: 500,
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
    letterSpacing: "0.01em",
  },
  statusChip: {
    height: "auto",
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 999,
    transition: `all ${MICRO_MS}ms ${MICRO_EASE}`,
    "& .MuiChip-label": {
      padding: "3px 8px",
    },
  },
  lastMessagePreview: {
    fontSize: "0.8125rem",
    lineHeight: 1.4,
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "break-word",
    marginTop: theme.spacing(0.5),
    opacity: 0.92,
    transition: `color ${MICRO_MS}ms ${MICRO_EASE}`,
  },
  lastMessageMedia: {
    fontStyle: "normal",
    fontWeight: 500,
  },
  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.75),
    rowGap: theme.spacing(0.5),
  },
  moreTagsChip: {
    height: "auto",
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 999,
    opacity: 0.85,
    "& .MuiChip-label": {
      padding: "3px 8px",
    },
  },
  chipQueue: {
    maxWidth: "100%",
    height: "auto",
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 999,
    backgroundColor: alpha(theme.palette.text.secondary, isDark ? 0.12 : 0.08),
    "& .MuiChip-label": {
      padding: "3px 8px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  chipUser: {
    maxWidth: "100%",
    height: "auto",
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 999,
    borderColor: alpha(theme.palette.text.secondary, 0.35),
    backgroundColor: alpha(theme.palette.text.secondary, isDark ? 0.1 : 0.06),
    "& .MuiChip-label": {
      padding: "3px 8px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  chipConnection: {
    maxWidth: "100%",
    height: "auto",
    fontSize: "0.68rem",
    fontWeight: 600,
    borderRadius: 999,
    borderColor: alpha(theme.palette.text.secondary, 0.25),
    backgroundColor: alpha(theme.palette.text.secondary, isDark ? 0.08 : 0.04),
    "& .MuiChip-label": {
      padding: "3px 8px",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 0,
    paddingTop: 0,
    borderTop: `1px solid ${getSubtleBorderColor(theme)}`,
    borderTopWidth: 0,
    opacity: 0,
    maxHeight: 0,
    overflow: "hidden",
    transition: theme.transitions.create(
      ["opacity", "max-height", "margin-top", "padding-top", "border-top-width"],
      { duration: 200 }
    ),
  },
  actionBtn: {
    minWidth: 64,
    fontSize: "0.68rem",
    fontWeight: 600,
    padding: "4px 12px",
    borderRadius: 999,
    textTransform: "none",
    boxShadow: "none",
    transition: `all ${MICRO_MS}ms ${MICRO_EASE}`,
    "@media (max-width: 959px)": {
      minWidth: 72,
      padding: "5px 14px",
    },
  },
  actionAccept: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.success.dark,
      transform: "translateY(-1px)",
    },
  },
  actionDanger: {
    backgroundColor: alpha(theme.palette.error.main, isDark ? 0.85 : 0.92),
    color: theme.palette.error.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.error.dark,
      transform: "translateY(-1px)",
    },
  },
  actionTransfer: {
    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.85 : 0.92),
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
      transform: "translateY(-1px)",
    },
  },
  listDeleteBtn: {
    padding: 4,
    flexShrink: 0,
    color: theme.palette.error.main,
    transition: `all ${MICRO_MS}ms ${MICRO_EASE}`,
    "@media (max-width: 959px)": {
      padding: 6,
    },
  },
  pinBtn: {
    padding: 4,
    flexShrink: 0,
    color: theme.palette.text.secondary,
    transition: `all ${MICRO_MS}ms ${MICRO_EASE}`,
    "&:hover": {
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
  },
  pinBtnActive: {
    color: theme.palette.primary.main,
  },
  pinIconNearName: {
    fontSize: 14,
    marginRight: 4,
    color: theme.palette.primary.main,
    verticalAlign: "middle",
    opacity: 0.9,
  },
  peekIcon: {
    color: alpha(theme.palette.success.main, isDark ? 0.9 : 0.85),
    cursor: "pointer",
    flexShrink: 0,
    transition: `color ${MICRO_MS}ms ${MICRO_EASE}, transform ${MICRO_MS}ms ${MICRO_EASE}`,
    "&:hover": {
      transform: "scale(1.08)",
    },
  },
};
});

const TicketListItemCustom = ({
  ticket,
  compact = false,
  selected = false,
  bulkSelectMode = false,
  bulkSelected = false,
  onBulkToggle,
  showPinInboxAction = false,
  onTogglePin,
  pinLoading = false,
  onTicketDeleted,
  onOpenTransferTicket,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [ticketUser, setTicketUser] = useState(null);
  const [tag, setTag] = useState([]);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isMounted = useRef(true);
  const setCurrentTicket = useContext(TicketsSetContext);
  const inbox = useContext(TicketsInboxContext);
  const { user } = useContext(AuthContext);
  const { profile } = user;
  const mayDelete = canDeleteTickets(user);
  const { completeAcceptTicket } = useAcceptTicket();
  const isPinned = Boolean(ticket?.isPinned);
  const canShowPin =
    showPinInboxAction && ticket.status === "open" && !bulkSelectMode;

  useEffect(() => {
    if (ticket.userId && ticket.user) {
      setTicketUser(ticket.user?.name?.toUpperCase());
    } else {
      setTicketUser(null);
    }

    setTag(Array.isArray(ticket?.tags) ? ticket.tags : []);

    return () => {
      isMounted.current = false;
    };
  }, [ticket]);

  const handleCloseTicket = async (id) => {
    setTag(Array.isArray(ticket?.tags) ? ticket.tags : []);
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        userId: user?.id,
        queueId: ticket?.queue?.id,
        useIntegration: false,
        promptId: null,
        integrationId: null,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/`);
  };

  const handleReopenTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
        queueId: ticket?.queue?.id,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleAcepptTicket = async () => {
    setLoading(true);
    try {
      await completeAcceptTicket(ticket);
    } catch (err) {
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }
  };

  const handleSelectTicket = useCallback(
    (t) => {
      const code = uuidv4();
      const { id, uuid } = t;
      setCurrentTicket({ id, uuid, code });
      if (isMobile) {
        history.push(`/tickets/${uuid}`);
      }
    },
    [setCurrentTicket, history, isMobile]
  );

  const handleDeleteTicket = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/tickets/${ticket.id}`);
      if (typeof onTicketDeleted === "function") {
        onTicketDeleted(ticket.id);
      } else if (typeof inbox?.removeTicket === "function") {
        inbox.removeTicket(ticket.id);
        if (ticket.status === "open" && typeof inbox?.reloadOpenList === "function") {
          inbox.reloadOpenList();
        } else if (
          ticket.status === "pending" &&
          typeof inbox?.reloadPendingList === "function"
        ) {
          inbox.reloadPendingList();
        }
        if (typeof inbox?.refreshTabCounts === "function") {
          inbox.refreshTabCounts();
        }
      }
      toast.success(i18n.t("ticketOptionsMenu.confirmationModal.deleteSuccess"));
      if (selected) {
        history.push("/tickets");
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setDeleteLoading(false);
        setDeleteConfirmOpen(false);
      }
    }
  };

  const queueColor = ticket.queue?.color || theme.palette.grey[500];
  const updatedAt = ticket.updatedAt ? parseISO(ticket.updatedAt) : null;
  const timeTooltip =
    updatedAt != null
      ? format(updatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "";

  const listTimeShort =
    updatedAt != null ? formatWhatsAppListTime(updatedAt) : "";

  const statusChipMeta = useMemo(() => {
    const isDark = theme.palette.type === "dark";
    if (ticket.isGroup) {
      return {
        label: i18n.t("groups.inbox.chipGroup"),
        style: {
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
          color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
        },
      };
    }
    if (ticket.status === "closed") {
      return {
        label: "Finalizado",
        style: {
          backgroundColor: alpha(theme.palette.text.secondary, isDark ? 0.18 : 0.1),
          color: theme.palette.text.secondary,
        },
      };
    }
    if (ticket.status === "pending") {
      if (ticket.chatbot) {
        return {
          label: i18n.t("ticketsListItem.tooltip.chatbot"),
          icon: <AndroidIcon style={{ fontSize: 14 }} />,
          style: {
            backgroundColor: alpha(theme.palette.info.main, isDark ? 0.22 : 0.12),
            color: isDark ? theme.palette.info.light : theme.palette.info.dark,
          },
        };
      }
      return {
        label: i18n.t("ticketsList.pendingHeader"),
        style: {
          backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.22 : 0.15),
          color: isDark ? theme.palette.warning.light : theme.palette.warning.dark,
        },
      };
    }
    if (ticket.status === "open") {
      return {
        label: "Em atendimento",
        style: {
          backgroundColor: alpha(theme.palette.success.main, isDark ? 0.22 : 0.15),
          color: isDark ? theme.palette.success.light : theme.palette.success.dark,
        },
      };
    }
    return null;
  }, [ticket.status, ticket.chatbot, theme]);

  const lastMessagePreview = useMemo(
    () => formatTicketLastMessagePreview(ticket),
    [ticket.lastMessage, ticket.id]
  );

  const actionBusy = loading || deleteLoading;

  const tagList = Array.isArray(tag) ? tag : [];
  const visibleTags = tagList.slice(0, MAX_TAGS_VISIBLE);
  const extraTagCount = Math.max(0, tagList.length - visibleTags.length);

  const contactLabelList = Array.isArray(ticket?.contact?.labels)
    ? ticket.contact.labels
    : [];
  const visibleContactLabels = contactLabelList.slice(0, MAX_CONTACT_LABELS_VISIBLE);
  const extraContactLabelCount = Math.max(
    0,
    contactLabelList.length - visibleContactLabels.length
  );
  const hiddenContactLabelNames = contactLabelList
    .slice(MAX_CONTACT_LABELS_VISIBLE)
    .map((l) => l.name)
    .join(", ");

  return (
    <React.Fragment key={ticket.id}>
      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      />
      <ConfirmationModal
        title={i18n.t("ticket.delete.confirmTitle")}
        open={deleteConfirmOpen}
        onClose={setDeleteConfirmOpen}
        onConfirm={handleDeleteTicket}
      >
        {i18n.t("ticket.delete.confirmMessage")}
      </ConfirmationModal>
      <ListItem
        dense
        button
        data-ticket-list-item
        tabIndex={-1}
        aria-label={ticket.contact?.name || i18n.t("ticketsListItem.ariaTicketRow")}
        onClick={() => {
          if (bulkSelectMode && typeof onBulkToggle === "function") {
            onBulkToggle(ticket.id);
            return;
          }
          handleSelectTicket(ticket);
        }}
        selected={bulkSelectMode ? bulkSelected : selected}
        className={clsx(classes.listItemRoot, {
          [classes.listItemCompact]: compact,
          [classes.listItemBulkSelect]: bulkSelectMode,
          [classes.listItemSelected]: bulkSelectMode
            ? bulkSelected
            : selected,
          [classes.listItemBusy]: actionBusy,
        })}
        disabled={actionBusy}
      >
        {bulkSelectMode ? (
          <Checkbox
            className={classes.bulkCheckbox}
            color="primary"
            checked={bulkSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (typeof onBulkToggle === "function") {
                onBulkToggle(ticket.id);
              }
            }}
          />
        ) : null}
        {bulkSelectMode ? (
          <Tooltip
            arrow
            placement="right"
            title={ticket.queue?.name?.toUpperCase() || i18n.t("ticketsListItem.noQueue")}
          >
            <Box
              className={classes.queueBar}
              style={{ backgroundColor: queueColor }}
              aria-hidden
            />
          </Tooltip>
        ) : null}

        <Box className={classes.cardBodyRow}>
          <ListItemAvatar className={classes.avatarWrap}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              badgeContent={ticket.unreadMessages > 0 ? ticket.unreadMessages : null}
              color="error"
              invisible={!ticket.unreadMessages}
              classes={{ badge: classes.unreadBadge }}
            >
              <Avatar
                className={clsx(classes.avatar, {
                  [classes.avatarCompact]: compact,
                  [classes.avatarSelected]: bulkSelectMode
                    ? bulkSelected
                    : selected,
                })}
                src={ticket?.contact?.profilePicUrl}
              >
                {!ticket?.contact?.profilePicUrl && ticket.contact?.name
                  ? ticket.contact.name.charAt(0).toUpperCase()
                  : null}
              </Avatar>
            </Badge>
          </ListItemAvatar>

          <Box className={classes.mainColumn}>
          <Box className={classes.topRow}>
            <Box className={classes.nameBlock}>
              {isPinned ? (
                <PushPinIcon className={classes.pinIconNearName} aria-hidden />
              ) : null}
              <Typography
                className={clsx(classes.contactName, { [classes.contactNameCompact]: compact })}
                component="span"
                title={ticket.contact.name}
              >
                {ticket.contact.name}
              </Typography>
              {visibleContactLabels.length > 0 ? (
                <Box display="flex" flexWrap="wrap" alignItems="center" mt={0.25} gridGap={4}>
                  {visibleContactLabels.map((label) => (
                    <ContactLabelChip key={`cl-${ticket.id}-${label.id}`} label={label} />
                  ))}
                  {extraContactLabelCount > 0 ? (
                    <Tooltip title={hiddenContactLabelNames}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`+${extraContactLabelCount}`}
                        style={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </Tooltip>
                  ) : null}
                </Box>
              ) : null}
              {profile === "admin" && (
                <Tooltip title={i18n.t("ticketsListItem.tooltip.peek")}>
                  <VisibilityIcon
                    className={classes.peekIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTicketMessageDialog(true);
                    }}
                    fontSize="small"
                  />
                </Tooltip>
              )}
            </Box>
            <Box className={classes.topRight}>
              {updatedAt && (
                <Tooltip title={timeTooltip || listTimeShort}>
                  <Typography className={classes.timeText} component="span">
                    {listTimeShort}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </Box>

          <Typography
            className={clsx(classes.lastMessagePreview, {
              [classes.lastMessageMedia]: lastMessagePreview.isMedia,
            })}
            component="div"
          >
            {lastMessagePreview.useMarkdown ? (
              <MarkdownWrapper>{lastMessagePreview.text}</MarkdownWrapper>
            ) : (
              lastMessagePreview.text
            )}
          </Typography>

          <Box className={classes.chipsRow}>
            {statusChipMeta ? (
              <Chip
                size="small"
                label={statusChipMeta.label}
                className={classes.statusChip}
                style={statusChipMeta.style}
                {...(statusChipMeta.icon ? { icon: statusChipMeta.icon } : {})}
              />
            ) : null}
            {ticket?.channel === "instagram" ? (
              <Chip
                size="small"
                variant="outlined"
                icon={
                  <InstagramIcon
                    style={{ color: "#e1306c", fontSize: 16 }}
                  />
                }
                label={(
                  ticket?.instagramAccount?.name || i18n.t("connections.tabs.instagram")
                ).toUpperCase()}
                className={classes.chipConnection}
              />
            ) : ticket?.whatsapp?.name ? (
              <Chip
                size="small"
                variant="outlined"
                label={ticket.whatsapp.name.toUpperCase()}
                className={classes.chipConnection}
              />
            ) : null}
            {ticketUser ? (
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label={ticketUser}
                className={classes.chipUser}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={ticket.queue?.name?.toUpperCase() || i18n.t("ticketsListItem.noQueue")}
              className={classes.chipQueue}
              style={{
                borderColor: queueColor,
                backgroundColor: `${queueColor}22`,
              }}
            />
            {visibleTags.map((tagItem) => (
              <ContactTag
                tag={tagItem}
                variant="lite"
                key={`ticket-contact-tag-${ticket.id}-${tagItem.id}`}
              />
            ))}
            {extraTagCount > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`+${extraTagCount}`}
                className={classes.moreTagsChip}
              />
            ) : null}
          </Box>

          {!ticket.isGroup &&
            (ticket.status === "pending" ||
              ticket.status === "open" ||
              ticket.status === "closed") && (
            <Box className={classes.actionsRow}>
              {ticket.status === "pending" && (
                <ButtonWithSpinner
                  variant="contained"
                  size="small"
                  className={clsx(classes.actionBtn, classes.actionAccept)}
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcepptTicket();
                  }}
                >
                  {loading
                    ? i18n.t("ticketsList.buttons.accepting")
                    : i18n.t("ticketsList.buttons.accept")}
                </ButtonWithSpinner>
              )}
              {ticket.status === "pending" && (
                <ButtonWithSpinner
                  variant="contained"
                  size="small"
                  className={clsx(classes.actionBtn, classes.actionTransfer)}
                  startIcon={<SwapHorizIcon fontSize="small" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onOpenTransferTicket === "function") {
                      onOpenTransferTicket(ticket);
                    }
                  }}
                >
                  {i18n.t("ticketOptionsMenu.transfer")}
                </ButtonWithSpinner>
              )}
              {ticket.status !== "closed" && (
                <ButtonWithSpinner
                  variant="contained"
                  size="small"
                  className={clsx(classes.actionBtn, classes.actionDanger)}
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.closed")}
                </ButtonWithSpinner>
              )}
              {ticket.status === "closed" && (
                <ButtonWithSpinner
                  variant="contained"
                  size="small"
                  className={clsx(classes.actionBtn, classes.actionDanger)}
                  loading={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReopenTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.reopen")}
                </ButtonWithSpinner>
              )}
              {canShowPin ? (
                <Tooltip
                  title={
                    isPinned
                      ? i18n.t("ticketsList.pin.unpin")
                      : i18n.t("ticketsList.pin.pin")
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      className={clsx(classes.pinBtn, {
                        [classes.pinBtnActive]: isPinned,
                      })}
                      disabled={loading || pinLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof onTogglePin === "function") {
                          onTogglePin(ticket);
                        }
                      }}
                      aria-label={
                        isPinned
                          ? i18n.t("ticketsList.pin.unpin")
                          : i18n.t("ticketsList.pin.pin")
                      }
                    >
                      {isPinned ? (
                        <PushPinIcon fontSize="small" />
                      ) : (
                        <PushPinOutlinedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
              {mayDelete && !bulkSelectMode ? (
                <Tooltip title={i18n.t("ticketOptionsMenu.delete")}>
                  <IconButton
                    size="small"
                    className={classes.listDeleteBtn}
                    disabled={loading || deleteLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmOpen(true);
                    }}
                    aria-label={i18n.t("ticketOptionsMenu.delete")}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          )}
          </Box>
        </Box>
      </ListItem>
    </React.Fragment>
  );
};

function ticketListItemPropsAreEqual(prev, next) {
  if (prev.compact !== next.compact) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.bulkSelectMode !== next.bulkSelectMode) return false;
  if (prev.bulkSelected !== next.bulkSelected) return false;
  if (prev.showPinInboxAction !== next.showPinInboxAction) return false;
  if (prev.pinLoading !== next.pinLoading) return false;
  if (prev.onTogglePin !== next.onTogglePin) return false;
  if (prev.onOpenTransferTicket !== next.onOpenTransferTicket) return false;
  return prev.ticket === next.ticket;
}

export default React.memo(TicketListItemCustom, ticketListItemPropsAreEqual);
