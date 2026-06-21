import React, { useState, useEffect, useCallback, useContext } from "react";
import useIsMobile from "../../hooks/useIsMobile";
import useInstagramOAuthCallback from "../../hooks/useInstagramOAuthCallback";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green, red } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Table,
  TableHead,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import {
  Edit,
  CheckCircle,
  DeleteOutline,
  Instagram,
  Link,
  LinkOff,
  Sync,
  NotificationsActive,
} from "@material-ui/icons";

import TableRowSkeleton from "../TableRowSkeleton";
import InstagramAccountModal from "../InstagramAccountModal";
import InstagramConnectTokenModal from "../InstagramConnectTokenModal";
import ConfirmationModal from "../ConfirmationModal";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import {
  AppTableContainer,
  AppEmptyState,
  MobileActionsMenu,
  MobileEntityCard,
  MobileCardList,
} from "../../ui";
import { startInstagramOAuth, formatTokenExpiryDays } from "../../utils/instagramOAuth";

const useStyles = makeStyles((theme) => ({
  guideBox: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "light" ? "#f5f5f5" : "rgba(255,255,255,0.06)",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  guideTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  guideStep: {
    marginBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
  },
  statusCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  connectionName: {
    fontWeight: 600,
    textAlign: "left",
  },
  tableHeadCell: {
    fontWeight: 600,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  mobileGuide: {
    [theme.breakpoints.down("md")]: {
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
    },
  },
  mobileCardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    alignItems: "center",
  },
  headerActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    justifyContent: "flex-end",
  },
  queueChip: {
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  metaLine: {
    marginTop: theme.spacing(0.5),
  },
  webhookBox: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "light" ? "#fafafa" : "rgba(255,255,255,0.04)",
  },
  webhookRow: {
    marginBottom: theme.spacing(1),
  },
  webhookLabel: {
    fontWeight: 600,
    marginRight: theme.spacing(1),
  },
  webhookUrl: {
    wordBreak: "break-all",
    fontFamily: "monospace",
    fontSize: "0.85rem",
  },
  accountActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    justifyContent: "center",
    alignItems: "center",
  },
  connectionChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    justifyContent: "center",
  },
  manualTokenHint: {
    marginTop: theme.spacing(1),
  },
  oauthLoading: {
    marginLeft: theme.spacing(1),
  },
}));

const instagramStatusChip = (status) => {
  switch (status) {
    case "CONNECTED":
      return { color: "primary", style: { backgroundColor: green[100], color: green[800] } };
    case "ERROR":
      return { color: "secondary", style: { backgroundColor: red[100], color: red[800] } };
    case "DISCONNECTED":
      return { color: "default", variant: "outlined" };
    case "PENDING":
    default:
      return { color: "default", variant: "outlined" };
  }
};

const formatTokenExpiry = (value) => {
  if (!value) {
    return i18n.t("connections.instagram.table.noExpiry");
  }
  try {
    return format(parseISO(value), "dd/MM/yy HH:mm");
  } catch {
    return i18n.t("connections.instagram.table.noExpiry");
  }
};

const formatEventDate = (value) => {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yy HH:mm");
  } catch {
    return "—";
  }
};

const InstagramConnectionsPanel = () => {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const { user } = useContext(AuthContext);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [connectTokenModalOpen, setConnectTokenModalOpen] = useState(false);
  const [connectTokenAccount, setConnectTokenAccount] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState("delete");
  const [confirmAccountId, setConfirmAccountId] = useState(null);
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [diagnosticsByAccountId, setDiagnosticsByAccountId] = useState({});
  const [oauthStatusByAccountId, setOauthStatusByAccountId] = useState({});
  const [webhookActionLoadingId, setWebhookActionLoadingId] = useState(null);
  const [oauthLoadingId, setOauthLoadingId] = useState(null);

  const loadOAuthStatuses = useCallback(async (accountList) => {
    const targets = (accountList || []).filter((account) => account?.id);
    if (!targets.length) {
      setOauthStatusByAccountId({});
      return;
    }

    const results = await Promise.allSettled(
      targets.map((account) =>
        api.get(`/instagram-accounts/${account.id}/oauth/status`).then((response) => ({
          accountId: account.id,
          data: response.data,
        }))
      )
    );

    const next = {};
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        next[result.value.accountId] = result.value.data;
      }
    });
    setOauthStatusByAccountId(next);
  }, []);

  const loadDiagnostics = useCallback(async (accountId, { silent = false } = {}) => {
    try {
      const { data } = await api.get(`/instagram-accounts/${accountId}/webhook-diagnostics`);
      setDiagnosticsByAccountId((prev) => ({ ...prev, [accountId]: data }));
      if (!silent) {
        toast.success(i18n.t("connections.instagram.webhook.diagnosticsLoaded"));
      }
      return data;
    } catch (err) {
      if (!silent) toastError(err);
      return null;
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/instagram-accounts");
      setAccounts(data);
      await loadOAuthStatuses(data);
      const connected = (data || []).filter(
        (account) => account.status === "CONNECTED" && account.hasToken
      );
      await Promise.allSettled(
        connected.map((account) => loadDiagnostics(account.id, { silent: true }))
      );
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [loadDiagnostics, loadOAuthStatuses]);

  const handleOAuthSuccess = useCallback(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useInstagramOAuthCallback({
    onSuccess: handleOAuthSuccess,
  });

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/instagram-accounts/webhook-info");
        if (!cancelled) setWebhookInfo(data);
      } catch {
        // usuário sem permissão ou endpoint indisponível
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const webhookStatusLabel = (status) => {
    if (status === "available") {
      return i18n.t("connections.instagram.webhook.statusAvailable");
    }
    if (status === "partial_configuration") {
      return i18n.t("connections.instagram.webhook.statusPartial");
    }
    return i18n.t("connections.instagram.webhook.statusAwaiting");
  };

  const handleSubscribeWebhook = async (account) => {
    setWebhookActionLoadingId(account.id);
    try {
      const { data } = await api.post(`/instagram-accounts/${account.id}/subscribe-webhook`);
      if (data?.diagnostics) {
        setDiagnosticsByAccountId((prev) => ({
          ...prev,
          [account.id]: data.diagnostics,
        }));
      }
      toast.success(i18n.t("connections.instagram.webhook.subscribeSuccess"));
    } catch (err) {
      toastError(err);
    } finally {
      setWebhookActionLoadingId(null);
    }
  };

  const renderWebhookAccountStatus = (accountId) => {
    const diagnostics = diagnosticsByAccountId[accountId];
    if (!diagnostics) {
      return (
        <Chip
          size="small"
          variant="outlined"
          label={i18n.t("connections.instagram.webhook.accountStatusUnknown")}
        />
      );
    }

    const status = diagnostics.webhookAccountStatus;
    const color =
      status === "confirmed" ? "primary" : status === "error" ? "secondary" : "default";

    return (
      <Chip
        size="small"
        color={color}
        variant={status === "confirmed" ? "default" : "outlined"}
        label={i18n.t(`connections.instagram.webhook.accountStatus.${status}`)}
      />
    );
  };

  const renderWebhookDiagnosticsMeta = (accountId) => {
    const diagnostics = diagnosticsByAccountId[accountId];
    if (!diagnostics) return null;

    return (
      <Box className={classes.metaLine}>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("connections.instagram.webhook.lastEvent")}:{" "}
          {formatEventDate(diagnostics.lastWebhookEventAt)}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("connections.instagram.webhook.lastMappedEvent")}:{" "}
          {formatEventDate(diagnostics.lastMappedEventAt)}
        </Typography>
      </Box>
    );
  };

  const handleOpenModal = () => {
    setSelectedAccount(null);
    setModalOpen(true);
  };

  const handleEdit = (account) => {
    setSelectedAccount(account);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedAccount(null);
  };

  const handleOpenConnectToken = (account) => {
    setConnectTokenAccount(account);
    setConnectTokenModalOpen(true);
  };

  const handleConnectInstagram = async (account) => {
    setOauthLoadingId(account.id);
    try {
      await startInstagramOAuth(api, account.id);
    } catch (err) {
      setOauthLoadingId(null);
      toastError(err);
    }
  };

  const getOAuthStatus = (account) =>
    oauthStatusByAccountId[account.id] || {
      connectedVia: account.connectedVia || null,
      connectionError: account.connectionError || null,
      tokenExpiresAt: account.tokenExpiresAt || null,
      status: account.status,
      hasToken: account.hasToken,
    };

  const renderConnectionChips = (account) => {
    const oauthStatus = getOAuthStatus(account);
    const chips = [];

    if (account.status === "CONNECTED" && account.hasToken) {
      if (oauthStatus.connectedVia === "instagram_login") {
        chips.push(
          <Chip
            key="oauth"
            size="small"
            color="primary"
            label={i18n.t("connections.instagram.oauth.connectedViaOAuth")}
          />
        );
      } else if (oauthStatus.connectedVia === "manual_token") {
        chips.push(
          <Chip
            key="manual"
            size="small"
            variant="outlined"
            label={i18n.t("connections.instagram.oauth.connectedViaManual")}
          />
        );
      } else {
        chips.push(
          <Chip
            key="connected"
            size="small"
            color="primary"
            label={i18n.t("connections.instagram.statusLabel.CONNECTED")}
          />
        );
      }
    } else if (account.status === "DISCONNECTED") {
      chips.push(
        <Chip
          key="disconnected"
          size="small"
          variant="outlined"
          label={i18n.t("connections.instagram.oauth.disconnected")}
        />
      );
    }

    const expiryLabel = formatTokenExpiryDays(oauthStatus.tokenExpiresAt || account.tokenExpiresAt);
    if (account.hasToken && expiryLabel) {
      chips.push(
        <Chip key="expiry" size="small" variant="outlined" label={expiryLabel} />
      );
    }

    if (oauthStatus.connectionError) {
      chips.push(
        <Chip
          key="error"
          size="small"
          color="secondary"
          label={i18n.t("connections.instagram.oauth.errorChip")}
        />
      );
    }

    return chips;
  };

  const renderManualTokenHint = (account) => {
    const oauthStatus = getOAuthStatus(account);
    if (
      account.status !== "CONNECTED" ||
      oauthStatus.connectedVia !== "manual_token"
    ) {
      return null;
    }

    return (
      <Alert severity="info" className={classes.manualTokenHint}>
        {i18n.t("connections.instagram.oauth.manualTokenHint")}
      </Alert>
    );
  };

  const renderConnectionError = (account) => {
    const oauthStatus = getOAuthStatus(account);
    if (!oauthStatus.connectionError) {
      return null;
    }

    return (
      <Typography variant="caption" color="error" display="block" className={classes.metaLine}>
        {oauthStatus.connectionError}
      </Typography>
    );
  };

  const renderConnectButtons = (account, { compact = false } = {}) => {
    const isConnected = account.status === "CONNECTED" && account.hasToken;
    const isLoading = oauthLoadingId === account.id;
    const primaryLabel = isConnected
      ? i18n.t("connections.instagram.buttons.reconnectInstagram")
      : i18n.t("connections.instagram.buttons.connectInstagram");
    const primaryAction = () => handleConnectInstagram(account);

    if (compact) {
      return null;
    }

    return (
      <Box className={classes.accountActions}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={isLoading}
          onClick={primaryAction}
        >
          {isLoading ? i18n.t("connections.instagram.oauth.connecting") : primaryLabel}
          {isLoading && <CircularProgress size={16} className={classes.oauthLoading} />}
        </Button>
        {!isConnected && (
          <Button
            variant="outlined"
            color="default"
            size="small"
            disabled={isLoading}
            onClick={() => handleOpenConnectToken(account)}
          >
            {i18n.t("connections.instagram.buttons.connectToken")}
          </Button>
        )}
        {isConnected && (
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            onClick={() => openConfirm("disconnect", account.id)}
          >
            {i18n.t("connections.instagram.buttons.disconnect")}
          </Button>
        )}
      </Box>
    );
  };

  const handleCloseConnectToken = () => {
    setConnectTokenModalOpen(false);
    setConnectTokenAccount(null);
  };

  const openConfirm = (action, accountId) => {
    setConfirmAction(action);
    setConfirmAccountId(accountId);
    setConfirmModalOpen(true);
  };

  const handleConfirm = async () => {
    try {
      if (confirmAction === "delete") {
        await api.delete(`/instagram-accounts/${confirmAccountId}`);
        toast.success(i18n.t("connections.instagram.toasts.deleted"));
      } else if (confirmAction === "disconnect") {
        await api.post(`/instagram-accounts/${confirmAccountId}/disconnect`);
        toast.success(i18n.t("connections.instagram.toasts.disconnected"));
      }
      fetchAccounts();
    } catch (err) {
      toastError(err);
    }
    setConfirmModalOpen(false);
    setConfirmAccountId(null);
  };

  const renderQueues = (account) => {
    if (!account.queues?.length) {
      return (
        <Typography variant="body2" color="textSecondary">
          {i18n.t("connections.instagram.table.noQueues")}
        </Typography>
      );
    }
    return account.queues.map((queue) => (
      <Chip
        key={queue.id}
        size="small"
        label={queue.name}
        className={classes.queueChip}
        style={{ backgroundColor: queue.color || undefined }}
      />
    ));
  };

  const renderStatus = (account) => {
    const label = i18n.t(`connections.instagram.statusLabel.${account.status}`, account.status);
    const chipProps = instagramStatusChip(account.status);
    return (
      <div className={classes.statusCell}>
        <Chip size="small" label={label} {...chipProps} />
      </div>
    );
  };

  const renderAccountMeta = (account) => (
    <Box>
      {account.instagramBusinessAccountId && (
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("connections.instagram.table.businessId")}: {account.instagramBusinessAccountId}
        </Typography>
      )}
      <Box className={`${classes.connectionChips} ${classes.metaLine}`}>
        {renderConnectionChips(account)}
      </Box>
      {renderConnectionError(account)}
      {renderManualTokenHint(account)}
    </Box>
  );

  const buildActionItems = (account) => {
    const isConnected = account.status === "CONNECTED" && account.hasToken;
    const items = [
      {
        label: i18n.t("connections.instagram.mobile.edit"),
        icon: <Edit fontSize="small" />,
        onClick: () => handleEdit(account),
      },
    ];

    items.push({
      label: isConnected
        ? i18n.t("connections.instagram.mobile.reconnectInstagram")
        : i18n.t("connections.instagram.mobile.connectInstagram"),
      icon: <Instagram fontSize="small" />,
      onClick: () => handleConnectInstagram(account),
      disabled: oauthLoadingId === account.id,
    });

    if (!isConnected) {
      items.push({
        label: i18n.t("connections.instagram.mobile.connectToken"),
        icon: <Link fontSize="small" />,
        onClick: () => handleOpenConnectToken(account),
      });
    }

    if (isConnected) {
      items.push({
        label: i18n.t("connections.instagram.webhook.verify"),
        icon: <Sync fontSize="small" />,
        onClick: () => loadDiagnostics(account.id),
      });
      items.push({
        label: i18n.t("connections.instagram.webhook.subscribe"),
        icon: <NotificationsActive fontSize="small" />,
        onClick: () => handleSubscribeWebhook(account),
      });
      items.push({
        label: i18n.t("connections.instagram.mobile.disconnect"),
        icon: <LinkOff fontSize="small" />,
        onClick: () => openConfirm("disconnect", account.id),
      });
    }

    items.push({
      label: i18n.t("connections.instagram.mobile.delete"),
      icon: <DeleteOutline fontSize="small" />,
      onClick: () => openConfirm("delete", account.id),
    });

    return items;
  };

  const renderMobileCard = (account) => {
    return (
    <MobileEntityCard
      key={account.id}
      title={
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <Instagram style={{ color: "#e1306c" }} fontSize="small" />
          <span>{account.name}</span>
        </Box>
      }
      subtitle={
        <Box className={classes.mobileCardMeta}>
          {renderStatus(account)}
          {account.isDefault && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={i18n.t("connections.instagram.mobile.defaultAccount")}
            />
          )}
          {renderConnectionChips(account)}
          {account.hasToken && account.status === "CONNECTED" && renderWebhookAccountStatus(account.id)}
        </Box>
      }
      meta={
        <>
          {renderAccountMeta(account)}
          {renderWebhookDiagnosticsMeta(account.id)}
          {renderConnectButtons(account)}
          <Typography variant="caption" color="textSecondary" display="block" className={classes.metaLine}>
            {i18n.t("connections.instagram.mobile.lastUpdate")}:{" "}
            {format(parseISO(account.updatedAt), "dd/MM/yy HH:mm")}
          </Typography>
        </>
      }
      footer={renderQueues(account)}
      actions={
        <Can
          role={user.profile}
          perform="connections-page:editOrDeleteConnection"
          yes={() => (
            <MobileActionsMenu
              label={i18n.t("connections.instagram.mobile.actions")}
              items={buildActionItems(account)}
            />
          )}
        />
      }
    />
    );
  };

  const confirmTitle =
    confirmAction === "disconnect"
      ? i18n.t("connections.instagram.confirmationModal.disconnectTitle")
      : i18n.t("connections.instagram.confirmationModal.deleteTitle");

  const confirmMessage =
    confirmAction === "disconnect"
      ? i18n.t("connections.instagram.confirmationModal.disconnectMessage")
      : i18n.t("connections.instagram.confirmationModal.deleteMessage");

  return (
    <>
      <ConfirmationModal
        title={confirmTitle}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleConfirm}
      >
        {confirmMessage}
      </ConfirmationModal>

      <InstagramAccountModal
        open={modalOpen}
        onClose={handleCloseModal}
        instagramAccountId={selectedAccount?.id}
        onSaved={fetchAccounts}
      />

      <InstagramConnectTokenModal
        open={connectTokenModalOpen}
        onClose={handleCloseConnectToken}
        instagramAccountId={connectTokenAccount?.id}
        accountName={connectTokenAccount?.name}
        onConnected={fetchAccounts}
      />

      <Box className={`${classes.guideBox} ${isMobile ? classes.mobileGuide : ""}`}>
        <Typography className={classes.guideTitle} variant="subtitle1">
          {i18n.t("connections.instagram.guide.title")}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("connections.instagram.guide.intro")}
        </Typography>
        <Typography className={classes.guideStep} variant="body2">
          1. {i18n.t("connections.instagram.guide.step1")}
        </Typography>
        <Typography className={classes.guideStep} variant="body2">
          2. {i18n.t("connections.instagram.guide.step2")}
        </Typography>
        <Typography className={classes.guideTitle} variant="body2" style={{ marginTop: 8 }}>
          {i18n.t("connections.instagram.guide.requirementsTitle")}
        </Typography>
        <Typography className={classes.guideStep} variant="body2">
          • {i18n.t("connections.instagram.guide.requirement1")}
        </Typography>
        <Typography className={classes.guideStep} variant="body2">
          • {i18n.t("connections.instagram.guide.requirement2")}
        </Typography>
        <Typography className={classes.guideStep} variant="body2">
          • {i18n.t("connections.instagram.guide.requirement3")}
        </Typography>
      </Box>

      <Box className={classes.webhookBox}>
        <Typography className={classes.guideTitle} variant="subtitle1">
          {i18n.t("connections.instagram.webhook.title")}
        </Typography>
        <Box className={classes.webhookRow}>
          <Typography component="span" className={classes.webhookLabel} variant="body2">
            {i18n.t("connections.instagram.webhook.callbackUrl")}:
          </Typography>
          <Typography component="span" className={classes.webhookUrl} variant="body2" color="textSecondary">
            {webhookInfo?.callbackUrl || "—"}
          </Typography>
        </Box>
        <Box className={classes.webhookRow}>
          <Typography component="span" className={classes.webhookLabel} variant="body2">
            {i18n.t("connections.instagram.webhook.verifyToken")}:
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("connections.instagram.webhook.verifyTokenHint")}
          </Typography>
        </Box>
        <Box className={classes.webhookRow}>
          <Typography component="span" className={classes.webhookLabel} variant="body2">
            {i18n.t("connections.instagram.webhook.status")}:
          </Typography>
          <Chip
            size="small"
            color={webhookInfo?.endpointStatus === "available" ? "primary" : "default"}
            variant={webhookInfo?.endpointStatus === "available" ? "default" : "outlined"}
            label={webhookStatusLabel(webhookInfo?.endpointStatus)}
          />
        </Box>
      </Box>

      <Box className={classes.headerActions}>
        <Can
          role={user.profile}
          perform="connections-page:addConnection"
          yes={() => (
            <Button variant="contained" color="primary" onClick={handleOpenModal}>
              {i18n.t("connections.instagram.buttons.add")}
            </Button>
          )}
        />
      </Box>

      {isMobile ? (
        loading ? (
          <TableRowSkeleton />
        ) : !accounts?.length ? (
          <AppEmptyState
            title={i18n.t("connections.instagram.table.emptyTitle")}
            description={i18n.t("connections.instagram.table.emptyHint")}
          />
        ) : (
          <MobileCardList>{accounts.map(renderMobileCard)}</MobileCardList>
        )
      ) : (
        <AppTableContainer nested>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="left" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.name")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.status")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.businessId")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.connection")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.webhook.accountWebhook")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.queues")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.lastUpdate")}
                </TableCell>
                <TableCell align="center" className={classes.tableHeadCell}>
                  {i18n.t("connections.instagram.table.default")}
                </TableCell>
                <Can
                  role={user.profile}
                  perform="connections-page:editOrDeleteConnection"
                  yes={() => (
                    <TableCell align="center" className={classes.tableHeadCell}>
                      {i18n.t("connections.instagram.table.actions")}
                    </TableCell>
                  )}
                />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton />
              ) : !accounts?.length ? (
                <TableRow>
                  <TableCell colSpan={9} style={{ border: "none" }}>
                    <AppEmptyState
                      title={i18n.t("connections.instagram.table.emptyTitle")}
                      description={i18n.t("connections.instagram.table.emptyHint")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell align="left" className={classes.connectionName}>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        <Instagram style={{ color: "#e1306c" }} fontSize="small" />
                        <span>{account.name}</span>
                      </Box>
                    </TableCell>
                    <TableCell align="center">{renderStatus(account)}</TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="textSecondary">
                        {account.instagramBusinessAccountId || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box>
                        <Box className={classes.connectionChips}>
                          {renderConnectionChips(account)}
                        </Box>
                        {renderConnectionError(account)}
                        {renderManualTokenHint(account)}
                        {account.hasToken && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            {formatTokenExpiry(account.tokenExpiresAt)}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box>
                        {account.hasToken && account.status === "CONNECTED" ? (
                          <>
                            {renderWebhookAccountStatus(account.id)}
                            {renderWebhookDiagnosticsMeta(account.id)}
                          </>
                        ) : (
                          <Typography variant="body2" color="textSecondary">—</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{renderQueues(account)}</TableCell>
                    <TableCell align="center">
                      {format(parseISO(account.updatedAt), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell align="center">
                      {account.isDefault && (
                        <div className={classes.customTableCell}>
                          <CheckCircle style={{ color: green[500] }} />
                        </div>
                      )}
                    </TableCell>
                    <Can
                      role={user.profile}
                      perform="connections-page:editOrDeleteConnection"
                      yes={() => (
                        <TableCell align="center">
                          {renderConnectButtons(account)}
                          {account.hasToken && account.status === "CONNECTED" && (
                            <>
                              <IconButton
                                size="small"
                                title={i18n.t("connections.instagram.webhook.verify")}
                                disabled={webhookActionLoadingId === account.id}
                                onClick={() => loadDiagnostics(account.id)}
                              >
                                <Sync />
                              </IconButton>
                              <IconButton
                                size="small"
                                title={i18n.t("connections.instagram.webhook.subscribe")}
                                disabled={webhookActionLoadingId === account.id}
                                onClick={() => handleSubscribeWebhook(account)}
                              >
                                <NotificationsActive />
                              </IconButton>
                            </>
                          )}
                          <IconButton size="small" onClick={() => handleEdit(account)}>
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => openConfirm("delete", account.id)}
                          >
                            <DeleteOutline />
                          </IconButton>
                        </TableCell>
                      )}
                    />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </AppTableContainer>
      )}
    </>
  );
};

export default InstagramConnectionsPanel;
