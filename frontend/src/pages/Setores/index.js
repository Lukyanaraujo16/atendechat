import React, { useEffect, useReducer, useState, useContext, useCallback } from "react";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
  Chip,
} from "@material-ui/core";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit, People } from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import SetorMembersModal from "../../components/SetorMembersModal";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import {
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
  },
  mobileList: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
}));

const chipTextColor = (hex) => {
  if (!hex || typeof hex !== "string") return "#fff";
  const h = hex.replace("#", "").slice(0, 6);
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  if (Number.isNaN(r + g + b)) return "#fff";
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 186 ? "#111" : "#fff";
};

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = Array.isArray(action.payload) ? action.payload : [];
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      const prev = state[queueIndex];
      state[queueIndex] = { ...prev, ...queue };
      return [...state];
    } else {
      return [queue, ...state];
    }
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Setores = () => {
  const classes = useStyles();
  const isMobile = useIsMobile();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersQueue, setMembersQueue] = useState(null);

  const socketManager = useContext(SocketContext);

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/queue");
      const list = Array.isArray(data) ? data : [];
      dispatch({ type: "RESET" });
      dispatch({ type: "LOAD_QUEUES", payload: list });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const onQueue = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    };

    socket.on(`company-${companyId}-queue`, onQueue);

    return () => {
      socket.off(`company-${companyId}-queue`, onQueue);
    };
  }, [socketManager]);

  const handleOpenQueueModal = () => {
    setSelectedQueue(null);
    setQueueModalOpen(true);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success("Setor removido com sucesso.");
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  const handleOpenMembers = (queue) => {
    setMembersQueue(queue);
    setMembersModalOpen(true);
  };

  const handleCloseMembers = () => {
    setMembersModalOpen(false);
    setMembersQueue(null);
  };

  const renderMobileSetorCard = (queue) => {
    const menuItems = [
      {
        key: "members",
        label: i18n.t("queues.mobile.members"),
        icon: <People fontSize="small" />,
        onClick: () => handleOpenMembers(queue),
      },
      {
        key: "edit",
        label: i18n.t("queueModal.title.edit"),
        icon: <Edit fontSize="small" />,
        onClick: () => handleEditQueue(queue),
      },
      {
        key: "delete",
        label: i18n.t("queues.confirmationModal.deleteTitle"),
        icon: <DeleteOutline fontSize="small" />,
        danger: true,
        onClick: () => {
          setSelectedQueue(queue);
          setConfirmModalOpen(true);
        },
      },
    ];

    return (
      <MobileEntityCard
        key={queue.id}
        leading={
          <Box
            className={classes.swatch}
            style={{ backgroundColor: queue.color || "#ccc" }}
          />
        }
        title={queue.name}
        badges={
          <MobileActionsMenu
            items={menuItems}
            ariaLabel={i18n.t("queues.mobile.flowActions")}
          />
        }
        onClick={() => handleEditQueue(queue)}
        footer={
          <Chip
            size="small"
            label={queue.name}
            style={{
              backgroundColor: queue.color || "#ccc",
              color: chipTextColor(queue.color),
              fontWeight: 600,
            }}
          />
        }
      >
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("queues.mobile.order")}: {queue.orderQueue || "—"}
        </Typography>
        {queue.greetingMessage ? (
          <Typography variant="caption" color="textSecondary" display="block" noWrap>
            {i18n.t("queues.mobile.greeting")}: {queue.greetingMessage}
          </Typography>
        ) : null}
      </MobileEntityCard>
    );
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `Remover o setor "${selectedQueue.name}"?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue?.id)}
      >
        Os usuários serão desvinculados deste setor. Esta ação não pode ser desfeita.
      </ConfirmationModal>

      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
        reload={fetchQueues}
      />

      <SetorMembersModal
        open={membersModalOpen}
        onClose={handleCloseMembers}
        queue={membersQueue}
      />

      <MainHeader>
        <Title>Setores</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenQueueModal}
          >
            Novo setor
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        {isMobile ? (
          <Box className={classes.mobileList}>
            <MobileCardList>
              {queues.map((queue) => renderMobileSetorCard(queue))}
            </MobileCardList>
            {loading ? <TableRowSkeleton columns={1} /> : null}
          </Box>
        ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">Id</TableCell>
              <TableCell align="center">Nome</TableCell>
              <TableCell align="center">Cor</TableCell>
              <TableCell align="center">Ordem</TableCell>
              <TableCell align="center">Mensagem de boas-vindas</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.id}>
                <TableCell align="center">{queue.id}</TableCell>
                <TableCell align="center">{queue.name}</TableCell>
                <TableCell align="center">
                  <div className={classes.customTableCell}>
                    <span
                      style={{
                        backgroundColor: queue.color,
                        width: 60,
                        height: 20,
                        alignSelf: "center",
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" noWrap>
                    {queue.orderQueue || "-"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography
                    variant="body2"
                    noWrap
                    style={{ maxWidth: 200 }}
                  >
                    {queue.greetingMessage || "-"}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenMembers(queue)}
                    title="Gerenciar membros"
                  >
                    <People />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleEditQueue(queue)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedQueue(queue);
                      setConfirmModalOpen(true);
                    }}
                  >
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={6} />}
          </TableBody>
        </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Setores;
