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

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { grey, blue, amber } from "@material-ui/core/colors";
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
import TicketMessagesDialog from "../TicketMessagesDialog";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import ContactTag from "../ContactTag";

const MAX_TAGS_VISIBLE = 3;

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
const useStyles = makeStyles((theme) => ({
  listItemRoot: {
    position: "relative",
    alignItems: "flex-start",
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(["background-color"], { duration: 200 }),
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    "&.Mui-selected": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(25, 118, 210, 0.16)"
          : "rgba(25, 118, 210, 0.07)",
      boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
    },
    "&.Mui-selected:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(25, 118, 210, 0.22)"
          : "rgba(25, 118, 210, 0.1)",
    },
  },
  listItemCompact: {
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
    marginLeft: theme.spacing(0.25),
    marginRight: theme.spacing(0.25),
  },
  pendingTicket: {
    cursor: "default",
  },
  queueBar: {
    flex: "none",
    width: 3,
    minHeight: 52,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: theme.spacing(1.25),
    marginTop: theme.spacing(0.5),
  },
  avatarWrap: {
    marginTop: theme.spacing(0.25),
    alignSelf: "flex-start",
  },
  avatar: {
    width: 48,
    height: 48,
    fontSize: "1.1rem",
    fontWeight: 600,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.type === "dark" ? "none" : "0 1px 2px rgba(0,0,0,0.06)",
  },
  avatarCompact: {
    width: 40,
    height: 40,
  },
  unreadBadge: {
    fontSize: "0.62rem",
    fontWeight: 700,
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    lineHeight: "18px",
    transform: "scale(1) translate(20%, -10%)",
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
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
    height: 22,
    fontSize: "0.7rem",
    fontWeight: 600,
    borderRadius: 8,
    "& .MuiChip-label": {
      paddingLeft: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
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
    height: 22,
    fontSize: "0.65rem",
    fontWeight: 600,
    borderRadius: 8,
    opacity: 0.85,
  },
  chipQueue: {
    maxWidth: "100%",
    height: 22,
    fontSize: "0.7rem",
    borderRadius: 8,
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  chipUser: {
    maxWidth: "100%",
    height: 22,
    fontSize: "0.7rem",
    borderRadius: 8,
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  chipConnection: {
    maxWidth: "100%",
    height: 22,
    fontSize: "0.7rem",
    borderRadius: 8,
    "& .MuiChip-label": {
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    justifyContent: "flex-end",
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(0.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  actionBtn: {
    minWidth: 72,
    fontSize: "0.65rem",
    padding: "4px 8px",
  },
  actionAccept: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.success.dark,
    },
  },
  actionDanger: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.error.dark,
    },
  },
}));

const TicketListItemCustom = ({ ticket, compact = false, selected = false }) => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [ticketUser, setTicketUser] = useState(null);
  const [tag, setTag] = useState([]);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const isMounted = useRef(true);
  const setCurrentTicket = useContext(TicketsSetContext);
  const { user } = useContext(AuthContext);
  const { profile } = user;

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

  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "open",
        userId: user?.id,
      });

      let settingIndex = [];
      try {
        const { data } = await api.get("/settings/");
        settingIndex = Array.isArray(data)
          ? data.filter((s) => s.key === "sendGreetingAccepted")
          : [];
      } catch (err) {
        toastError(err);
      }

      if (settingIndex[0]?.value === "enabled" && !ticket.isGroup) {
        handleSendMessage(ticket.id);
      }
    } catch (err) {
      setLoading(false);

      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }

    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleSendMessage = async (id) => {
    const msg = `{{ms}} *{{name}}*, meu nome é *${user?.name}* e agora vou prosseguir com seu atendimento!`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `*Mensagem Automática:*\n${msg.trim()}`,
    };
    try {
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSelectTicket = useCallback(
    (t) => {
      const code = uuidv4();
      const { id, uuid } = t;
      setCurrentTicket({ id, uuid, code });
    },
    [setCurrentTicket]
  );

  const queueColor = ticket.queue?.color || theme.palette.grey[500];
  const updatedAt = ticket.updatedAt ? parseISO(ticket.updatedAt) : null;
  const timeTooltip =
    updatedAt != null
      ? format(updatedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "";

  const listTimeShort =
    updatedAt != null ? formatWhatsAppListTime(updatedAt) : "";

  const statusChipMeta = useMemo(() => {
    if (ticket.status === "closed") {
      return {
        label: "Finalizado",
        style: {
          backgroundColor: theme.palette.type === "dark" ? grey[700] : grey[200],
          color: theme.palette.type === "dark" ? grey[100] : grey[800],
        },
      };
    }
    if (ticket.status === "pending") {
      if (ticket.chatbot) {
        return {
          label: i18n.t("ticketsListItem.tooltip.chatbot"),
          icon: <AndroidIcon style={{ fontSize: 14 }} />,
          style: {
            backgroundColor: theme.palette.type === "dark" ? grey[700] : grey[200],
            color: theme.palette.type === "dark" ? grey[100] : grey[700],
          },
        };
      }
      return {
        label: i18n.t("ticketsList.pendingHeader"),
        style: {
          backgroundColor: theme.palette.type === "dark" ? amber[900] : amber[100],
          color: theme.palette.type === "dark" ? amber[100] : amber[900],
        },
      };
    }
    if (ticket.status === "open") {
      return {
        label: "Em atendimento",
        style: {
          backgroundColor:
            theme.palette.type === "dark"
              ? "rgba(46, 125, 50, 0.35)"
              : theme.palette.success.light,
          color: theme.palette.type === "dark" ? theme.palette.success.light : theme.palette.success.dark,
        },
      };
    }
    return null;
  }, [ticket.status, ticket.chatbot, theme]);

  const lastMessageText = ticket.lastMessage != null ? String(ticket.lastMessage) : "";

  const tagList = Array.isArray(tag) ? tag : [];
  const visibleTags = tagList.slice(0, MAX_TAGS_VISIBLE);
  const extraTagCount = Math.max(0, tagList.length - visibleTags.length);

  return (
    <React.Fragment key={ticket.id}>
      <TicketMessagesDialog
        open={openTicketMessageDialog}
        handleClose={() => setOpenTicketMessageDialog(false)}
        ticketId={ticket.id}
      />
      <ListItem
        dense
        button
        data-ticket-list-item
        tabIndex={-1}
        aria-label={ticket.contact?.name || i18n.t("ticketsListItem.ariaTicketRow")}
        onClick={(e) => {
          if (ticket.status === "pending") return;
          handleSelectTicket(ticket);
        }}
        selected={selected}
        className={clsx(classes.listItemRoot, {
          [classes.pendingTicket]: ticket.status === "pending",
          [classes.listItemCompact]: compact,
        })}
      >
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
              className={clsx(classes.avatar, { [classes.avatarCompact]: compact })}
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
              <Typography
                className={clsx(classes.contactName, { [classes.contactNameCompact]: compact })}
                component="span"
                title={ticket.contact.name}
              >
                {ticket.contact.name}
              </Typography>
              {profile === "admin" && (
                <Tooltip title={i18n.t("ticketsListItem.tooltip.peek")}>
                  <VisibilityIcon
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTicketMessageDialog(true);
                    }}
                    fontSize="small"
                    style={{
                      color: blue[700],
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
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

          <Typography className={classes.lastMessagePreview} component="div">
            {lastMessageText.includes("data:image/png;base64") ? (
              <MarkdownWrapper> Localização</MarkdownWrapper>
            ) : (
              <MarkdownWrapper>{lastMessageText}</MarkdownWrapper>
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
            {ticket?.whatsapp?.name ? (
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

          {(ticket.status === "pending" ||
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
                    handleAcepptTicket(ticket.id);
                  }}
                >
                  {i18n.t("ticketsList.buttons.accept")}
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
            </Box>
          )}
        </Box>
      </ListItem>
    </React.Fragment>
  );
};

function ticketListItemPropsAreEqual(prev, next) {
  if (prev.compact !== next.compact) return false;
  if (prev.selected !== next.selected) return false;
  return prev.ticket === next.ticket;
}

export default React.memo(TicketListItemCustom, ticketListItemPropsAreEqual);
