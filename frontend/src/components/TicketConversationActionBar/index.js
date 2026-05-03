import React from "react";

import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { green } from "@material-ui/core/colors";
import clsx from "clsx";

import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import EventIcon from "@material-ui/icons/Event";
import UndoRoundedIcon from "@material-ui/icons/UndoRounded";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AccountTreeIcon from "@material-ui/icons/AccountTree";
import FlashOnIcon from "@material-ui/icons/FlashOn";

import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";
import TicketFlowExecutionLogModal from "../TicketFlowExecutionLogModal";
import { Can } from "../Can";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: "100%",
    marginLeft: "auto",
    marginRight: theme.spacing(0.5),
    gap: theme.spacing(2),
    minWidth: 0,
    [theme.breakpoints.down("xs")]: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      paddingBottom: theme.spacing(0.5),
      justifyContent: "flex-start",
    },
  },
  iconGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  destructive: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: theme.spacing(1),
    paddingLeft: theme.spacing(2),
    borderLeft: `1px solid ${theme.palette.divider}`,
  },
  resolveContained: {
    backgroundColor: green[600],
    color: theme.palette.common.white,
    "&:hover": {
      backgroundColor: green[700],
    },
  },
  resolveIconOnly: {
    minWidth: 40,
    padding: theme.spacing(0.75),
  },
  transferOutlined: {
    textTransform: "none",
  },
  transferIconCompact: {
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  deleteIcon: {
    color: theme.palette.error.main,
    "&:hover": {
      backgroundColor: theme.palette.error.main,
      color: theme.palette.common.white,
    },
  },
}));

/**
 * Barra de ações do ticket (status open) — padrão SaaS: uma ação dominante (Resolver) + ícones leves.
 */
const TicketConversationActionBar = ({
  loading,
  userProfile,
  onResolve,
  onReturn,
  onScheduleClick,
  onTransferClick,
  onDeleteClick,
  onQuickRepliesClick,
  ticketId,
  extraIconActions,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <div className={classes.root} data-ticket-action-bar>
      {/* Bloco 1: ações leves (somente ícones) */}
      <div className={classes.iconGroup}>
        <Tooltip title={i18n.t("messagesList.header.buttons.return")}>
          <span>
            <IconButton
              size="small"
              onClick={onReturn}
              disabled={loading}
              aria-label={i18n.t("messagesList.header.buttons.return")}
            >
              {loading ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <UndoRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {ticketId ? (
          <TicketFlowExecutionLogModal
            ticketId={ticketId}
            renderTrigger={(open) => (
              <Tooltip
                title={i18n.t("messagesList.header.buttons.flowHistory")}
              >
                <IconButton
                  size="small"
                  onClick={open}
                  aria-label={i18n.t("messagesList.header.buttons.flowHistory")}
                >
                  <AccountTreeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          />
        ) : null}

        {typeof onQuickRepliesClick === "function" ? (
          <Tooltip title={i18n.t("messagesList.header.buttons.quickReplies")}>
            <span>
              <IconButton
                size="small"
                onClick={onQuickRepliesClick}
                disabled={loading}
                aria-label={i18n.t("messagesList.header.buttons.quickReplies")}
              >
                <FlashOnIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : null}

        {extraIconActions || null}

        <Tooltip title={i18n.t("ticketOptionsMenu.schedule")}>
          <IconButton
            size="small"
            onClick={onScheduleClick}
            aria-label={i18n.t("ticketOptionsMenu.schedule")}
          >
            <EventIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>

      {/* Bloco 2: Transferir (secundário) + Resolver (principal) */}
      <div className={classes.actionGroup}>
        <Tooltip title={i18n.t("ticketOptionsMenu.transfer")}>
          {compact ? (
            <IconButton
              size="small"
              onClick={onTransferClick}
              className={classes.transferIconCompact}
              aria-label={i18n.t("ticketOptionsMenu.transfer")}
            >
              <SwapHorizIcon fontSize="small" />
            </IconButton>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              className={classes.transferOutlined}
              startIcon={<SwapHorizIcon />}
              onClick={onTransferClick}
            >
              {i18n.t("ticketOptionsMenu.transfer")}
            </Button>
          )}
        </Tooltip>

        <Tooltip title={i18n.t("messagesList.header.buttons.resolve")}>
          <span>
            {compact ? (
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="contained"
                className={clsx(classes.resolveContained, classes.resolveIconOnly)}
                onClick={onResolve}
                aria-label={i18n.t("messagesList.header.buttons.resolve")}
              >
                <CheckCircleIcon fontSize="small" />
              </ButtonWithSpinner>
            ) : (
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="contained"
                className={classes.resolveContained}
                startIcon={<CheckCircleIcon />}
                onClick={onResolve}
              >
                {i18n.t("messagesList.header.buttons.resolve")}
              </ButtonWithSpinner>
            )}
          </span>
        </Tooltip>
      </div>

      {/* Bloco 3: destrutivo */}
      <Can
        role={userProfile}
        perform="ticket-options:deleteTicket"
        yes={() => (
          <div className={classes.destructive}>
            <Tooltip title={i18n.t("ticketOptionsMenu.delete")}>
              <IconButton
                size="small"
                onClick={onDeleteClick}
                aria-label={i18n.t("ticketOptionsMenu.delete")}
                className={classes.deleteIcon}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        )}
      />
    </div>
  );
};

export default TicketConversationActionBar;
