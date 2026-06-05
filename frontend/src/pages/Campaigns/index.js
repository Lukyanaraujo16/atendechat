/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext } from "react";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import DescriptionIcon from "@material-ui/icons/Description";
import TimerOffIcon from "@material-ui/icons/TimerOff";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import ReplayIcon from "@material-ui/icons/Replay";

import Typography from "@material-ui/core/Typography";
import MainContainer from "../../components/MainContainer";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import { Box, LinearProgress, Tooltip } from "@material-ui/core";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import { SocketContext } from "../../context/Socket/SocketContext";
import {
  AppPageHeader,
  AppSectionCard,
  AppPrimaryButton,
  AppActionBar,
  AppDangerAction,
  AppEmptyState,
  AppLoadingState,
  AppTableRowSkeleton,
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";
import useIsMobile from "../../hooks/useIsMobile";
import Chip from "@material-ui/core/Chip";
import SendIcon from "@material-ui/icons/Send";

const STATUS_STYLES = {
  INATIVA: { backgroundColor: "#9e9e9e", color: "#fff" },
  PROGRAMADA: { backgroundColor: "#1976d2", color: "#fff" },
  EM_ANDAMENTO: { backgroundColor: "#fbc02d", color: "#000" },
  FINALIZADA: { backgroundColor: "#388e3c", color: "#fff" },
  CANCELADA: { backgroundColor: "#d32f2f", color: "#fff" },
};

const reducer = (state, action) => {
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];

    if (isArray(campaigns)) {
      campaigns.forEach((campaign) => {
        const campaignIndex = state.findIndex((u) => u.id === campaign.id);
        if (campaignIndex !== -1) {
          state[campaignIndex] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }

    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGNS") {
    const campaign = action.payload;
    const campaignIndex = state.findIndex((u) => u.id === campaign.id);

    if (campaignIndex !== -1) {
      state[campaignIndex] = campaign;
      return [...state];
    } else {
      return [campaign, ...state];
    }
  }

  if (action.type === "DELETE_CAMPAIGN") {
    const campaignId = action.payload;

    const campaignIndex = state.findIndex((u) => u.id === campaignId);
    if (campaignIndex !== -1) {
      state.splice(campaignIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 0,
    [theme.breakpoints.up("md")]: {
      gap: theme.spacing(3),
    },
  },
  mainPaper: {
    flex: 1,
    minHeight: 0,
  },
  filtersBar: {
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginBottom: theme.spacing(2),
  },
  searchField: {
    flex: "1 1 260px",
    minWidth: 200,
    maxWidth: 420,
  },
  mobileList: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
}));

const Campaigns = () => {
  const classes = useStyles();
  const isMobile = useIsMobile();

  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [campaigns, dispatch] = useReducer(reducer, []);
  const [progressById, setProgressById] = useState({});
  const [restartModalOpen, setRestartModalOpen] = useState(false);
  const [restartTarget, setRestartTarget] = useState(null);
  const [retryFailedModalOpen, setRetryFailedModalOpen] = useState(false);
  const [retryFailedTarget, setRetryFailedTarget] = useState(null);

  const { datetimeToClient } = useDate();

  const socketManager = useContext(SocketContext);

  const fetchProgressForList = async (list) => {
    if (!list || !list.length) return;
    const ids = list.map((c) => c.id);
    try {
      const { data } = await api.post("/campaigns/progress-batch", { ids });
      const progress = data.progress || {};
      setProgressById((prev) => {
        const next = { ...prev };
        Object.keys(progress).forEach((k) => {
          next[+k] = progress[k];
        });
        return next;
      });
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchCampaigns();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handler = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CAMPAIGNS", payload: data.record });
        if (data.record && data.record.id) {
          api
            .post("/campaigns/progress-batch", { ids: [data.record.id] })
            .then(({ data: batch }) => {
              const p = batch.progress && batch.progress[String(data.record.id)];
              if (p) {
                setProgressById((prev) => ({
                  ...prev,
                  [data.record.id]: p,
                }));
              }
            })
            .catch(() => {});
        }
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CAMPAIGN", payload: +data.id });
      }
    };

    socket.on(`company-${companyId}-campaign`, handler);
    return () => {
      socket.off(`company-${companyId}-campaign`, handler);
    };
  }, [socketManager]);

  const campaignFingerprint = campaigns
    .map((c) => `${c.id}:${c.status}`)
    .join("|");

  useEffect(() => {
    if (campaigns.length) {
      fetchProgressForList(campaigns);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignFingerprint]);

  useEffect(() => {
    const timer = setInterval(() => {
      const active = campaigns.filter((c) =>
        ["EM_ANDAMENTO", "PROGRAMADA"].includes(c.status)
      );
      if (active.length) {
        fetchProgressForList(active);
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [campaigns]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await api.get("/campaigns/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CAMPAIGNS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleOpenCampaignModal = () => {
    setSelectedCampaign(null);
    setCampaignModalOpen(true);
  };

  const handleCloseCampaignModal = () => {
    setSelectedCampaign(null);
    setCampaignModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/campaigns/${campaignId}`);
      showSuccessToast("campaigns.toasts.deleted");
    } catch (err) {
      toastError(err);
    }
    setDeletingCampaign(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return i18n.t("campaigns.status.inactive");
      case "PROGRAMADA":
        return i18n.t("campaigns.status.programmed");
      case "EM_ANDAMENTO":
        return i18n.t("campaigns.status.inProgress");
      case "CANCELADA":
        return i18n.t("campaigns.status.canceled");
      case "FINALIZADA":
        return i18n.t("campaigns.status.finished");
      default:
        return val;
    }
  };

  const renderStatusBadge = (status) => {
    const label = formatStatus(status);
    const style = STATUS_STYLES[status] || {
      backgroundColor: "#757575",
      color: "#fff",
    };
    return (
      <Box
        component="span"
        display="inline-block"
        px={1}
        py={0.5}
        borderRadius={4}
        fontSize="0.75rem"
        fontWeight={600}
        style={style}
      >
        {label}
      </Box>
    );
  };

  const cancelCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      showSuccessToast("campaigns.toasts.cancel");
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const runRestartCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      showSuccessToast("campaigns.toasts.restart");
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const runRetryFailed = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/retry-failed`);
      showSuccessToast("campaigns.toasts.retryFailed");
      await fetchProgressForList([campaign]);
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const canShowRetryFailed = (campaign, prog) =>
    prog &&
    prog.failed > 0 &&
    ["EM_ANDAMENTO", "FINALIZADA", "CANCELADA"].includes(campaign.status);

  const renderMobileCampaignCard = (campaign) => {
    const prog = progressById[campaign.id];
    const pct =
      prog && prog.total > 0
        ? Math.min(100, Math.round((prog.sent / prog.total) * 100))
        : 0;

    const menuItems = [
      {
        key: "report",
        label: i18n.t("campaigns.table.report"),
        icon: <DescriptionIcon fontSize="small" />,
        onClick: () => history.push(`/campaign/${campaign.id}/report`),
      },
      {
        key: "edit",
        label: i18n.t("campaigns.table.edit"),
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEditCampaign(campaign),
      },
      campaign.status === "EM_ANDAMENTO"
        ? {
            key: "stop",
            label: i18n.t("campaigns.table.stopCampaign"),
            icon: <PauseCircleOutlineIcon fontSize="small" />,
            onClick: () => cancelCampaign(campaign),
          }
        : null,
      campaign.status === "CANCELADA"
        ? {
            key: "resume",
            label: i18n.t("campaigns.table.resumeCampaign"),
            icon: <PlayCircleOutlineIcon fontSize="small" />,
            onClick: () => {
              setRestartTarget(campaign);
              setRestartModalOpen(true);
            },
          }
        : null,
      canShowRetryFailed(campaign, prog)
        ? {
            key: "retry",
            label: i18n.t("campaigns.table.retryFailed"),
            icon: <ReplayIcon fontSize="small" />,
            onClick: () => {
              setRetryFailedTarget(campaign);
              setRetryFailedModalOpen(true);
            },
          }
        : null,
      {
        key: "delete",
        label: i18n.t("campaigns.table.delete"),
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: () => {
          setConfirmModalOpen(true);
          setDeletingCampaign(campaign);
        },
      },
    ].filter(Boolean);

    const statusStyle = STATUS_STYLES[campaign.status] || {
      backgroundColor: "#757575",
      color: "#fff",
    };

    return (
      <MobileEntityCard
        key={campaign.id}
        leading={<SendIcon color="primary" />}
        title={campaign.name}
        badges={
          <MobileActionsMenu
            items={menuItems}
            ariaLabel={i18n.t("campaigns.mobile.flowActions")}
          />
        }
        onClick={() => handleEditCampaign(campaign)}
        footer={
          <Chip
            size="small"
            label={formatStatus(campaign.status)}
            style={statusStyle}
          />
        }
      >
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("campaigns.mobile.scheduledAt")}:{" "}
          {campaign.scheduledAt
            ? datetimeToClient(campaign.scheduledAt)
            : i18n.t("campaigns.mobile.notScheduled")}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("campaigns.mobile.connection")}:{" "}
          {campaign.whatsappId
            ? campaign.whatsapp?.name
            : i18n.t("campaigns.table.notDefined2")}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("campaigns.mobile.contactList")}:{" "}
          {campaign.contactListId
            ? campaign.contactList?.name
            : i18n.t("campaigns.table.notDefined")}
        </Typography>
        {prog && prog.total > 0 ? (
          <Box mt={0.5}>
            <LinearProgress
              variant="determinate"
              value={pct}
              style={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("campaigns.table.progressLine", {
                pct,
                sent: prog.sent,
                total: prog.total,
              })}
            </Typography>
            {prog.failed > 0 ? (
              <Typography variant="caption" style={{ color: "#c62828" }} display="block">
                {i18n.t("campaigns.table.failedLine", { failed: prog.failed })}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </MobileEntityCard>
    );
  };

  return (
    <MainContainer className={classes.pageRoot}>
      <ConfirmationModal
        title={
          deletingCampaign &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${
            deletingCampaign.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        destructive
        onConfirm={() => handleDeleteCampaign(deletingCampaign.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ConfirmationModal
        title={i18n.t("campaigns.dialog.confirmRetryFailed.title")}
        open={retryFailedModalOpen}
        onClose={() => {
          setRetryFailedModalOpen(false);
          setRetryFailedTarget(null);
        }}
        onConfirm={() => {
          const c = retryFailedTarget;
          setRetryFailedModalOpen(false);
          setRetryFailedTarget(null);
          if (c) {
            runRetryFailed(c);
          }
        }}
        confirmText={i18n.t("campaigns.dialog.confirmRetryFailed.confirm")}
      >
        {i18n.t("campaigns.dialog.confirmRetryFailed.message")}
      </ConfirmationModal>
      <ConfirmationModal
        title={i18n.t("campaigns.dialog.confirmRestart.title")}
        open={restartModalOpen}
        onClose={() => {
          setRestartModalOpen(false);
          setRestartTarget(null);
        }}
        onConfirm={() => {
          const c = restartTarget;
          setRestartModalOpen(false);
          setRestartTarget(null);
          if (c) {
            runRestartCampaign(c);
          }
        }}
        confirmText={i18n.t("campaigns.dialog.confirmRestart.confirm")}
      >
        {i18n.t("campaigns.dialog.confirmRestart.message")}
      </ConfirmationModal>
      <CampaignModal
        resetPagination={() => {
          setPageNumber(1);
          fetchCampaigns();
        }}
        open={campaignModalOpen}
        onClose={handleCloseCampaignModal}
        aria-labelledby="form-dialog-title"
        campaignId={selectedCampaign && selectedCampaign.id}
      />
      <AppPageHeader
        title={
          <Typography variant="h5" color="primary" component="h1">
            {i18n.t("campaigns.title")}
          </Typography>
        }
        subtitle={
          <Typography variant="body2" color="textSecondary" component="p">
            {i18n.t("campaigns.pageSubtitle")}
          </Typography>
        }
        actions={
          <AppPrimaryButton onClick={handleOpenCampaignModal}>
            {i18n.t("campaigns.buttons.add")}
          </AppPrimaryButton>
        }
      />
      <AppSectionCard
        dense
        scrollable
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <AppActionBar className={classes.filtersBar}>
          <TextField
            className={classes.searchField}
            placeholder={i18n.t("campaigns.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            variant="outlined"
            size="small"
            fullWidth={isMobile}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </AppActionBar>
        {loading && campaigns.length === 0 ? (
          <AppLoadingState message={i18n.t("campaigns.loading")} />
        ) : !loading && campaigns.length === 0 ? (
          <AppEmptyState
            title={i18n.t("campaigns.empty.title")}
            description={i18n.t("campaigns.empty.subtitle")}
          >
            <AppPrimaryButton onClick={handleOpenCampaignModal}>
              {i18n.t("campaigns.buttons.add")}
            </AppPrimaryButton>
          </AppEmptyState>
        ) : isMobile ? (
          <Box className={classes.mobileList}>
            <MobileCardList>
              {campaigns.map((campaign) => renderMobileCampaignCard(campaign))}
            </MobileCardList>
            {loading ? <AppLoadingState message={i18n.t("campaigns.loading")} /> : null}
          </Box>
        ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">
                {i18n.t("campaigns.table.name")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.status")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.progress")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.contactList")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.whatsapp")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.scheduledAt")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.completedAt")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("campaigns.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {campaigns.map((campaign) => {
                const prog = progressById[campaign.id];
                const pct =
                  prog && prog.total > 0
                    ? Math.min(
                        100,
                        Math.round((prog.sent / prog.total) * 100)
                      )
                    : 0;
                return (
                <TableRow key={campaign.id} hover>
                  <TableCell align="center">{campaign.name}</TableCell>
                  <TableCell align="center">
                    {renderStatusBadge(campaign.status)}
                  </TableCell>
                  <TableCell align="center" style={{ minWidth: 140 }}>
                    {prog && prog.total > 0 ? (
                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          style={{ height: 8, borderRadius: 4 }}
                        />
                        <Box mt={0.5} fontSize="0.7rem">
                          {i18n.t("campaigns.table.progressLine", {
                            pct,
                            sent: prog.sent,
                            total: prog.total,
                          })}
                        </Box>
                        {prog.failed > 0 && (
                          <Box
                            mt={0.5}
                            fontSize="0.65rem"
                            style={{ color: "#c62828" }}
                          >
                            {i18n.t("campaigns.table.failedLine", {
                              failed: prog.failed,
                            })}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {campaign.contactListId
                      ? campaign.contactList.name
                      : i18n.t("campaigns.table.notDefined")}
                  </TableCell>
                  <TableCell align="center">
                    {campaign.whatsappId
                      ? campaign.whatsapp.name
                      : i18n.t("campaigns.table.notDefined2")}
                  </TableCell>
                  <TableCell align="center">
                    {campaign.scheduledAt
                      ? datetimeToClient(campaign.scheduledAt)
                      : i18n.t("campaigns.table.notScheduled")}
                  </TableCell>
                  <TableCell align="center">
                    {campaign.completedAt
                      ? datetimeToClient(campaign.completedAt)
                      : i18n.t("campaigns.table.notConcluded")}
                  </TableCell>
                  <TableCell align="center">
                    {campaign.status === "EM_ANDAMENTO" && (
                      <Tooltip title={i18n.t("campaigns.table.stopCampaign")}>
                        <IconButton
                          onClick={() => cancelCampaign(campaign)}
                          size="small"
                          aria-label={i18n.t("campaigns.table.stopCampaign")}
                        >
                          <PauseCircleOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {campaign.status === "CANCELADA" && (
                      <Tooltip title={i18n.t("campaigns.table.resumeCampaign")}>
                        <IconButton
                          onClick={() => {
                            setRestartTarget(campaign);
                            setRestartModalOpen(true);
                          }}
                          size="small"
                          aria-label={i18n.t("campaigns.table.resumeCampaign")}
                        >
                          <PlayCircleOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canShowRetryFailed(campaign, prog) && (
                      <Tooltip title={i18n.t("campaigns.table.retryFailed")}>
                        <IconButton
                          onClick={() => {
                            setRetryFailedTarget(campaign);
                            setRetryFailedModalOpen(true);
                          }}
                          size="small"
                          aria-label={i18n.t("campaigns.table.retryFailed")}
                        >
                          <ReplayIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={i18n.t("campaigns.table.report")}>
                      <IconButton
                        onClick={() =>
                          history.push(`/campaign/${campaign.id}/report`)
                        }
                        size="small"
                        aria-label={i18n.t("campaigns.table.report")}
                      >
                        <DescriptionIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("campaigns.table.edit")}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditCampaign(campaign)}
                        aria-label={i18n.t("campaigns.table.edit")}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title={i18n.t("campaigns.table.delete")}>
                      <AppDangerAction
                        size="small"
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingCampaign(campaign);
                        }}
                        aria-label={i18n.t("campaigns.table.delete")}
                      >
                        <DeleteOutlineIcon />
                      </AppDangerAction>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
              })}
              {loading && <AppTableRowSkeleton columns={9} />}
            </>
          </TableBody>
        </Table>
        )}
      </AppSectionCard>
    </MainContainer>
  );
};

export default Campaigns;
