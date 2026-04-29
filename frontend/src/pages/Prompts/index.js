import React, { useContext, useEffect, useReducer, useState } from "react";

import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";
import AssignmentIcon from "@material-ui/icons/Assignment";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@material-ui/icons";
import PromptModal from "../../components/PromptModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import useFeature from "../../hooks/useFeature";
import { useHistory } from "react-router-dom";
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
  actionIcon: {
    opacity: 0.55,
    transition: theme.transitions.create("opacity", {
      duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
      opacity: 1,
    },
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_PROMPTS") {
    const prompts = Array.isArray(action.payload) ? action.payload : [];
    const newPrompts = [];

    if (prompts.length === 0)
      return [];

    prompts.forEach((prompt) => {
      const promptIndex = state.findIndex((p) => p.id === prompt.id);
      if (promptIndex !== -1) {
        state[promptIndex] = prompt;
      } else {
        newPrompts.push(prompt);
      }
    });

    return [...state, ...newPrompts];
  }

  if (action.type === "UPDATE_PROMPTS") {
    const prompt = action.payload;
    const promptIndex = state.findIndex((p) => p.id === prompt.id);

    if (promptIndex !== -1) {
      state[promptIndex] = prompt;
      return [...state];
    } else {
      return [prompt, ...state];
    }
  }

  if (action.type === "DELETE_PROMPT") {
    const promptId = action.payload;
    const promptIndex = state.findIndex((p) => p.id === promptId);
    if (promptIndex !== -1) {
      state.splice(promptIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Prompts = () => {
  const classes = useStyles();

  const [prompts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const { enabled: openAiEnabled, loaded: openAiFeatureLoaded } = useFeature(
    "automation.openai"
  );
  const history = useHistory();
  const companyId = user.companyId;

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    if (!user?.companyId || !openAiFeatureLoaded) return;
    if (!openAiEnabled) {
      toast.error(
        "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando."
      );
      setTimeout(() => {
        history.push(`/`);
      }, 1000);
    }
  }, [user?.companyId, openAiFeatureLoaded, openAiEnabled, history]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        getPrompts(  );

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = socketManager.getSocket(companyId);
    const eventName = `company-${companyId}-prompt`;

    const onPromptSocket = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_PROMPTS", payload: data.prompt });
      }
      if (data.action === "delete" && data.promptId != null) {
        dispatch({ type: "DELETE_PROMPT", payload: data.promptId });
      }
    };

    socket.on(eventName, onPromptSocket);

    return () => {
      socket.off(eventName, onPromptSocket);
    };
  }, [companyId, socketManager]);

  const getPrompts = async (  ) => {

    const { data } = await api.get("/prompt");
    dispatch({ type: "LOAD_PROMPTS", payload: Array.isArray(data?.prompts) ? data.prompts : [] });
  }

  const handleOpenPromptModal = () => {
    setPromptModalOpen(true);
    setSelectedPrompt(null);
  };

  const handleClosePromptModal = () => {
    setPromptModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleEditPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setPromptModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleDeletePrompt = async (promptId) => {
    try {

      const { data } = await api.delete(`/prompt/${promptId}`);
      dispatch({type: "DELETE_PROMPT", payload: promptId});
      toast.info(i18n.t(data.message));
  
    } catch (err) {
      toastError(err);
    }
    setSelectedPrompt(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedPrompt &&
          `${i18n.t("prompts.confirmationModal.deleteTitle")} ${selectedPrompt.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeletePrompt(selectedPrompt.id)}
      >
        {i18n.t("prompts.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <PromptModal
        open={promptModalOpen}
        onClose={handleClosePromptModal}
        promptId={selectedPrompt?.id}
        refreshPrompts={getPrompts}
      />
      <MainHeader>
        <Title>{i18n.t("prompts.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenPromptModal}
          >
            {i18n.t("prompts.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Box p={1} mb={1} width="100%">
        <Typography variant="body2" color="textSecondary" component="div">
          {i18n.t("prompts.openAiHelp")}
        </Typography>
      </Box>
      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell align="left" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                {i18n.t("prompts.table.name")}
              </TableCell>
              <TableCell align="left" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                {i18n.t("prompts.table.queue")}
              </TableCell>
              <TableCell align="left" style={{ fontWeight: 600, fontSize: "0.8125rem", width: 120 }}>
                {i18n.t("prompts.table.max_tokens")}
              </TableCell>
              <TableCell align="right" style={{ fontWeight: 600, fontSize: "0.8125rem", width: 100 }}>
                {i18n.t("prompts.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {prompts.map((prompt) => (
                <TableRow key={prompt.id} hover>
                  <TableCell
                    align="left"
                    onClick={() => handleEditPrompt(prompt)}
                    style={{ cursor: "pointer", maxWidth: 320 }}
                  >
                    <Box display="flex" alignItems="flex-start" style={{ gap: 10 }}>
                      <AssignmentIcon
                        color="primary"
                        style={{ fontSize: 24, flexShrink: 0, marginTop: 2, opacity: 0.9 }}
                      />
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        {prompt.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="left">
                    <Typography variant="body2" color="textSecondary">
                      {prompt.queue?.name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="left">
                    <Typography variant="body2" component="span">
                      {prompt.maxTokens}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" alignItems="center" style={{ gap: 4 }}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          className={classes.actionIcon}
                          aria-label="Editar prompt"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPrompt(prompt);
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          className={classes.actionIcon}
                          aria-label="Excluir prompt"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPrompt(prompt);
                            setConfirmModalOpen(true);
                          }}
                          style={{ color: "#d32f2f" }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={4} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Prompts;
