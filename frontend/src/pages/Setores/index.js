import React, { useEffect, useReducer, useState, useContext } from "react";

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
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
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
      state[queueIndex] = queue;
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

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersQueue, setMembersQueue] = useState(null);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-queue`, (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    });

    return () => {
      socket.disconnect();
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
      </Paper>
    </MainContainer>
  );
};

export default Setores;
