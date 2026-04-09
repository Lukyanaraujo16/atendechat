/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
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

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid, Box, LinearProgress } from "@material-ui/core";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AppSectionCard, AppPrimaryButton } from "../../ui";

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
  mainPaper: {
    flex: 1,
  },
}));

const Campaigns = () => {
  const classes = useStyles();

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

    socket.on(`company-${companyId}-campaign`, (data) => {
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
    });
    return () => {
      socket.disconnect();
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
      toast.success(i18n.t("campaigns.toasts.deleted"));
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
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const runRestartCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const runRetryFailed = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/retry-failed`);
      toast.success(i18n.t("campaigns.toasts.retryFailed"));
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

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingCampaign &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${
            deletingCampaign.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
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
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} sm={8} item>
            <Title>{i18n.t("campaigns.title")}</Title>
          </Grid>
          <Grid xs={12} sm={4} item>
            <Grid spacing={2} container>
              <Grid xs={6} sm={6} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("campaigns.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={6} sm={6} item>
                <AppPrimaryButton
                  fullWidth
                  onClick={handleOpenCampaignModal}
                >
                  {i18n.t("campaigns.buttons.add")}
                </AppPrimaryButton>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <AppSectionCard
        dense
        scrollable
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
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
                <TableRow key={campaign.id}>
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
                      <IconButton
                        onClick={() => cancelCampaign(campaign)}
                        title={i18n.t("campaigns.table.stopCampaign")}
                        size="small"
                      >
                        <PauseCircleOutlineIcon />
                      </IconButton>
                    )}
                    {campaign.status === "CANCELADA" && (
                      <IconButton
                        onClick={() => {
                          setRestartTarget(campaign);
                          setRestartModalOpen(true);
                        }}
                        title={i18n.t("campaigns.table.stopCampaign")}
                        size="small"
                      >
                        <PlayCircleOutlineIcon />
                      </IconButton>
                    )}
                    {canShowRetryFailed(campaign, prog) && (
                      <IconButton
                        onClick={() => {
                          setRetryFailedTarget(campaign);
                          setRetryFailedModalOpen(true);
                        }}
                        title={i18n.t("campaigns.table.retryFailed")}
                        size="small"
                      >
                        <ReplayIcon />
                      </IconButton>
                    )}
                    <IconButton
                      onClick={() =>
                        history.push(`/campaign/${campaign.id}/report`)
                      }
                      size="small"
                    >
                      <DescriptionIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditCampaign(campaign)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingCampaign(campaign);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
              })}
              {loading && <TableRowSkeleton columns={9} />}
            </>
          </TableBody>
        </Table>
      </AppSectionCard>
    </MainContainer>
  );
};

export default Campaigns;
