import React, { useState, useEffect, useCallback, useContext } from "react";
import useIsMobile from "../../hooks/useIsMobile";
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
  Tooltip,
  Typography,
  Box,
  Chip,
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  DeleteOutline,
  Instagram,
} from "@material-ui/icons";

import TableRowSkeleton from "../TableRowSkeleton";
import InstagramAccountModal from "../InstagramAccountModal";
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

const InstagramConnectionsPanel = () => {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const { user } = useContext(AuthContext);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAccountId, setConfirmAccountId] = useState(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/instagram-accounts");
      setAccounts(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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

  const handleDelete = async () => {
    try {
      await api.delete(`/instagram-accounts/${confirmAccountId}`);
      toast.success(i18n.t("connections.instagram.toasts.deleted"));
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

  const renderMobileCard = (account) => (
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
        </Box>
      }
      meta={
        <Typography variant="caption" color="textSecondary">
          {i18n.t("connections.instagram.mobile.lastUpdate")}:{" "}
          {format(parseISO(account.updatedAt), "dd/MM/yy HH:mm")}
        </Typography>
      }
      footer={renderQueues(account)}
      actions={
        <Can
          role={user.profile}
          perform="connections-page:editOrDeleteConnection"
          yes={() => (
            <MobileActionsMenu
              label={i18n.t("connections.instagram.mobile.actions")}
              items={[
                {
                  label: i18n.t("connections.instagram.mobile.edit"),
                  icon: <Edit fontSize="small" />,
                  onClick: () => handleEdit(account),
                },
                {
                  label: i18n.t("connections.instagram.mobile.delete"),
                  icon: <DeleteOutline fontSize="small" />,
                  onClick: () => {
                    setConfirmAccountId(account.id);
                    setConfirmModalOpen(true);
                  },
                },
              ]}
            />
          )}
        />
      }
    />
  );

  return (
    <>
      <ConfirmationModal
        title={i18n.t("connections.instagram.confirmationModal.deleteTitle")}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        {i18n.t("connections.instagram.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <InstagramAccountModal
        open={modalOpen}
        onClose={handleCloseModal}
        instagramAccountId={selectedAccount?.id}
        onSaved={fetchAccounts}
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
      </Box>

      <Box className={classes.headerActions}>
        <Tooltip title={i18n.t("connections.instagram.buttons.connectMetaTooltip")} arrow>
          <span>
            <Button variant="outlined" color="primary" disabled>
              {i18n.t("connections.instagram.buttons.connectMeta")}
            </Button>
          </span>
        </Tooltip>
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
                  <TableCell colSpan={6} style={{ border: "none" }}>
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
                          <IconButton size="small" onClick={() => handleEdit(account)}>
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setConfirmAccountId(account.id);
                              setConfirmModalOpen(true);
                            }}
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
