import React, { useState } from "react";

import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles, alpha } from "@material-ui/core/styles";
import clsx from "clsx";

import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import EventIcon from "@material-ui/icons/Event";
import UndoRoundedIcon from "@material-ui/icons/UndoRounded";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AccountTreeIcon from "@material-ui/icons/AccountTree";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import MoreVertIcon from "@material-ui/icons/MoreVert";

import { i18n } from "../../translate/i18n";
import ButtonWithSpinner from "../ButtonWithSpinner";
import TicketFlowExecutionLogModal from "../TicketFlowExecutionLogModal";
import { Can } from "../Can";
import useIsMobile from "../../hooks/useIsMobile";

const MICRO_MS = 180;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    maxWidth: "100%",
    marginLeft: "auto",
    marginRight: theme.spacing(0.5),
    gap: theme.spacing(0.5),
    minWidth: 0,
    [theme.breakpoints.down("xs")]: {
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      paddingBottom: theme.spacing(0.5),
      justifyContent: "flex-start",
    },
  },
  actionGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.25),
    flexShrink: 0,
    "& .MuiIconButton-root": {
      transition: `all ${MICRO_MS}ms ease`,
    },
    "& .MuiIconButton-root:hover:not($deleteIconBtn)": {
      backgroundColor: alpha(theme.palette.success.main, 0.12),
    },
  },
  iconActionBtn: {
    transition: `all ${MICRO_MS}ms ease`,
    "&:hover": {
      backgroundColor: alpha(theme.palette.success.main, 0.12),
    },
  },
  deleteIconBtn: {
    color: theme.palette.error.main,
    transition: `all ${MICRO_MS}ms ease`,
    "&:hover": {
      backgroundColor: alpha(theme.palette.error.main, 0.12),
    },
  },
  moreMenuBtn: {
    transition: `all ${MICRO_MS}ms ease`,
    "&:hover": {
      backgroundColor: alpha(theme.palette.success.main, 0.12),
    },
  },
  resolveContained: {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    borderRadius: 999,
    textTransform: "none",
    fontWeight: 600,
    transition: `all ${MICRO_MS}ms ease`,
    boxShadow: `0 2px 8px ${alpha(theme.palette.success.main, 0.35)}`,
    "&:hover": {
      backgroundColor: theme.palette.success.dark,
      transform: "translateY(-1px)",
      boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.4)}`,
    },
  },
  resolveIconOnly: {
    minWidth: 40,
    padding: theme.spacing(0.75),
  },
  transferOutlined: {
    textTransform: "none",
    borderRadius: 999,
    transition: `all ${MICRO_MS}ms ease`,
    "&:hover": {
      transform: "translateY(-1px)",
    },
  },
  transferIconCompact: {
    border: `1px solid ${theme.palette.primary.main}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.primary.main,
    transition: `all ${MICRO_MS}ms ease`,
    "&:hover": {
      backgroundColor: alpha(theme.palette.success.main, 0.12),
    },
  },
  menuDelete: {
    color: theme.palette.error.main,
  },
  menuPaper: {
    width: 280,
    maxWidth: "calc(100vw - 24px)",
    maxHeight:
      "min(70vh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 96px))",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  menuItem: {
    minHeight: 48,
  },
}));

const ActionIconButton = ({
  title,
  onClick,
  disabled,
  className,
  children,
}) => (
  <Tooltip title={title}>
    <span>
      <IconButton
        size="small"
        onClick={onClick}
        disabled={disabled}
        className={className}
        aria-label={title}
      >
        {children}
      </IconButton>
    </span>
  </Tooltip>
);

/**
 * Barra de ações do ticket (status open).
 * Compact = mesmo predicado mobile do ticket (`useIsMobile` / down("md")).
 * Desktop: IconButtons; mobile: MenuItems rotulados via renderExtraMenuItems.
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
  renderExtraMenuItems,
  showDelete,
}) => {
  const classes = useStyles();
  const compact = useIsMobile();
  const [menuAnchor, setMenuAnchor] = useState(null);

  const openMenu = (event) => setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const runMenuAction = (fn) => (event) => {
    closeMenu();
    if (typeof fn === "function") {
      fn(event);
    }
  };

  const deleteVisible =
    showDelete === true ? (
      <ActionIconButton
        title={i18n.t("ticketOptionsMenu.delete")}
        onClick={onDeleteClick}
        disabled={loading}
        className={clsx(classes.iconActionBtn, classes.deleteIconBtn)}
      >
        <DeleteOutlineIcon fontSize="small" />
      </ActionIconButton>
    ) : showDelete === false ? null : (
      <Can
        role={userProfile}
        perform="ticket-options:deleteTicket"
        yes={() => (
          <ActionIconButton
            title={i18n.t("ticketOptionsMenu.delete")}
            onClick={onDeleteClick}
            disabled={loading}
            className={clsx(classes.iconActionBtn, classes.deleteIconBtn)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </ActionIconButton>
        )}
      />
    );

  const renderReturnIcon = () => (
    <ActionIconButton
      title={i18n.t("messagesList.header.buttons.return")}
      onClick={onReturn}
      disabled={loading}
      className={classes.iconActionBtn}
    >
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        <UndoRoundedIcon fontSize="small" />
      )}
    </ActionIconButton>
  );

  const renderFlowIcon = () =>
    ticketId ? (
      <TicketFlowExecutionLogModal
        ticketId={ticketId}
        renderTrigger={(open) => (
          <ActionIconButton
            title={i18n.t("messagesList.header.buttons.flowHistory")}
            onClick={open}
            disabled={loading}
            className={classes.iconActionBtn}
          >
            <AccountTreeIcon fontSize="small" />
          </ActionIconButton>
        )}
      />
    ) : null;

  const renderQuickRepliesIcon = () =>
    typeof onQuickRepliesClick === "function" ? (
      <ActionIconButton
        title={i18n.t("messagesList.header.buttons.quickReplies")}
        onClick={onQuickRepliesClick}
        disabled={loading}
        className={classes.iconActionBtn}
      >
        <FlashOnIcon fontSize="small" />
      </ActionIconButton>
    ) : null;

  const renderScheduleIcon = () => (
    <ActionIconButton
      title={i18n.t("ticketOptionsMenu.schedule")}
      onClick={onScheduleClick}
      disabled={loading}
      className={classes.iconActionBtn}
    >
      <EventIcon fontSize="small" />
    </ActionIconButton>
  );

  const renderMenuDeleteItem = () =>
    showDelete === true ? (
      <MenuItem
        onClick={runMenuAction(onDeleteClick)}
        className={clsx(classes.menuItem, classes.menuDelete)}
      >
        <ListItemIcon className={classes.menuDelete}>
          <DeleteOutlineIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={i18n.t("ticketOptionsMenu.delete")} />
      </MenuItem>
    ) : showDelete === false ? null : (
      <Can
        role={userProfile}
        perform="ticket-options:deleteTicket"
        yes={() => (
          <MenuItem
            onClick={runMenuAction(onDeleteClick)}
            className={clsx(classes.menuItem, classes.menuDelete)}
          >
            <ListItemIcon className={classes.menuDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={i18n.t("ticketOptionsMenu.delete")} />
          </MenuItem>
        )}
      />
    );

  const extraMenuNodes =
    compact && typeof renderExtraMenuItems === "function"
      ? renderExtraMenuItems({
          closeMenu,
          runMenuAction,
          menuItemClassName: classes.menuItem,
        })
      : null;

  const deleteMenuItem = renderMenuDeleteItem();

  return (
    <div className={classes.root} data-ticket-action-bar data-compact={compact ? "true" : "false"}>
      {!compact ? (
        <div className={classes.actionGroup}>
          {renderReturnIcon()}
          {renderFlowIcon()}
          {renderQuickRepliesIcon()}
          {renderScheduleIcon()}
          {extraIconActions ? (
            <div className={classes.actionGroup}>{extraIconActions}</div>
          ) : null}
        </div>
      ) : null}

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

        {!compact ? deleteVisible : null}

        {compact ? (
          <Tooltip title={i18n.t("ticketOptionsMenu.moreActions")}>
            <IconButton
              size="small"
              className={classes.moreMenuBtn}
              onClick={openMenu}
              aria-label={i18n.t("ticketOptionsMenu.moreActions")}
              aria-haspopup="true"
              aria-controls="ticket-action-menu"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </div>

      {compact ? (
        <Menu
          id="ticket-action-menu"
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={closeMenu}
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          PaperProps={{ className: classes.menuPaper }}
          MenuListProps={{ dense: false }}
        >
          <MenuItem
            onClick={runMenuAction(onReturn)}
            disabled={loading}
            className={classes.menuItem}
          >
            <ListItemIcon>
              {loading ? (
                <CircularProgress size={18} />
              ) : (
                <UndoRoundedIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText primary={i18n.t("messagesList.header.buttons.return")} />
          </MenuItem>

          {ticketId ? (
            <TicketFlowExecutionLogModal
              ticketId={ticketId}
              renderTrigger={(open) => (
                <MenuItem onClick={runMenuAction(open)} className={classes.menuItem}>
                  <ListItemIcon>
                    <AccountTreeIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={i18n.t("messagesList.header.buttons.flowHistory")}
                  />
                </MenuItem>
              )}
            />
          ) : null}

          {typeof onQuickRepliesClick === "function" ? (
            <MenuItem
              onClick={runMenuAction(onQuickRepliesClick)}
              disabled={loading}
              className={classes.menuItem}
            >
              <ListItemIcon>
                <FlashOnIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={i18n.t("messagesList.header.buttons.quickReplies")}
              />
            </MenuItem>
          ) : null}

          <MenuItem
            onClick={runMenuAction(onScheduleClick)}
            className={classes.menuItem}
          >
            <ListItemIcon>
              <EventIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={i18n.t("ticketOptionsMenu.schedule")} />
          </MenuItem>

          {extraMenuNodes ? <Divider /> : null}
          {extraMenuNodes}

          {deleteMenuItem ? <Divider /> : null}
          {deleteMenuItem}
        </Menu>
      ) : null}
    </div>
  );
};

export default TicketConversationActionBar;
