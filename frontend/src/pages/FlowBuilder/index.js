import React, { useState, useEffect, useReducer } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";

import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import api from "../../services/api";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import NewTicketModal from "../../components/NewTicketModal";
import {
  AddCircle,
  PostAdd,
  AccountTree as AccountTreeIcon,
  Edit as EditIcon,
  Tune as TuneIcon,
  ContentCopy as ContentCopyIcon,
  DeleteOutline as DeleteOutlineIcon,
} from "@mui/icons-material";

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import FlowBuilderModal from "../../components/FlowBuilderModal";
import FlowBuilderTemplateModal from "../../components/FlowBuilderTemplateModal";
import FlowBuilderImportFlowModal from "../../components/FlowBuilderImportFlowModal";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = Array.isArray(action.payload) ? action.payload : [];
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
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
    borderRadius: 12,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
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

function formatFlowSubtitle(flow) {
  const ts = flow.updatedAt;
  if (!ts) return null;
  try {
    return `Atualizado ${new Date(ts).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })}`;
  } catch {
    return null;
  }
}

const FlowBuilder = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [webhooks, setWebhooks] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWebhookName, setSelectedWebhookName] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket, setContactTicket] = useState({});
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [reloadData, setReloadData] = useState(false);
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/flowbuilder");
          const flows = Array.isArray(data?.flows) ? data.flows : [];
          setWebhooks(flows);
          dispatch({ type: "LOAD_CONTACTS", payload: flows });
          setHasMore(data.hasMore);
        } catch (err) {
          toastError(err);
        } finally {
          setLoading(false);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, reloadData]);

  // useEffect(() => {
  //   const companyId = user.companyId;

  //   const onContact = (data) => {
  //     if (data.action === "update" || data.action === "create") {
  //       dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
  //     }

  //     if (data.action === "delete") {
  //       dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
  //     }
  //   };

  //   socket.on(`company-${companyId}-contact`, onContact);

  //   return () => {
  //     socket.disconnect();
  //   };
  // }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setSelectedWebhookName(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setSelectedWebhookName(null);
    setContactModalOpen(false);
  };

  const handleOpenRenameModal = (flow) => {
    setSelectedContactId(flow.id);
    setSelectedWebhookName(flow.name || "");
    setContactModalOpen(true);
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    try {
      await api.delete(`/flowbuilder/${webhookId}`).then((res) => {
        setDeletingContact(null);
        setReloadData((old) => !old);
      });
      toast.success("Fluxo excluído com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const handleDuplicateFlow = async (flowId) => {
    try {
      await api
        .post(`/flowbuilder/duplicate`, { flowId: flowId })
        .then((res) => {
          setDeletingContact(null);
          setReloadData((old) => !old);
        });
      toast.success("Fluxo duplicado com sucesso");
    } catch (err) {
      toastError(err);
    }
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

  return (
    <MainContainer>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />

      <FlowBuilderModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        flowId={selectedContactId}
        nameWebhook={selectedWebhookName}
        onSave={() => setReloadData((old) => !old)}
      />

      <FlowBuilderTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
      />

      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) =>
          deletingContact ? handleDeleteWebhook(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja deletar este fluxo? Todas as integrações relacionados serão perdidos.`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `Deseja duplicar o fluxo ${deletingContact.name}?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmDuplicateOpen}
        onClose={setConfirmDuplicateOpen}
        onConfirm={(e) =>
          deletingContact ? handleDuplicateFlow(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja duplicar este fluxo?`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <MainHeader>
        <Title>Fluxos de conversa</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
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
          <FlowBuilderImportFlowModal />
          <Button
            variant="outlined"
            onClick={() => setTemplateModalOpen(true)}
            color="primary"
          >
            <Stack direction={"row"} gap={1}>
              <PostAdd />
              Criar a partir de template
            </Stack>
          </Button>
          <Button
            variant="contained"
            onClick={handleOpenContactModal}
            color="primary"
          >
            <Stack direction={"row"} gap={1}>
              <AddCircle />
              {"Adicionar Fluxo"}
            </Stack>
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        {loading && !(Array.isArray(webhooks) && webhooks.length) ? (
          <Stack
            justifyContent="center"
            alignItems="center"
            minHeight="50vh"
          >
            <CircularProgress />
          </Stack>
        ) : (
          <Table size="medium" sx={{ minWidth: 480 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, py: 2, fontSize: "0.8125rem" }}>
                  {i18n.t("contacts.table.name")}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 600, width: 140, py: 2, fontSize: "0.8125rem" }}
                >
                  Status
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontWeight: 600, width: 216, py: 2, fontSize: "0.8125rem" }}
                >
                  {i18n.t("contacts.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(Array.isArray(webhooks) ? webhooks : []).map((contact) => {
                const subtitle = formatFlowSubtitle(contact);
                return (
                  <TableRow
                    key={contact.id}
                    hover
                    sx={{
                      "& td": {
                        verticalAlign: "middle",
                        py: 2,
                        borderColor: "divider",
                      },
                    }}
                  >
                    <TableCell
                      onClick={() => history.push(`/flowbuilder/${contact.id}`)}
                      sx={{
                        cursor: "pointer",
                        maxWidth: 360,
                        borderRadius: 1,
                        transition: (theme) =>
                          theme.transitions.create("background-color", {
                            duration: theme.transitions.duration.shortest,
                          }),
                        "&:hover": {
                          bgcolor: "action.hover",
                        },
                      }}
                    >
                      <Box display="flex" alignItems="flex-start" gap={1.5}>
                        <AccountTreeIcon
                          sx={{
                            mt: 0.15,
                            color: "primary.main",
                            fontSize: 26,
                            flexShrink: 0,
                            opacity: 0.92,
                          }}
                        />
                        <Box minWidth={0}>
                          <Typography
                            variant="body1"
                            component="div"
                            sx={{
                              fontWeight: 600,
                              lineHeight: 1.35,
                              textDecoration: "none",
                            }}
                          >
                            {contact.name}
                          </Typography>
                          {subtitle ? (
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              component="div"
                              sx={{ display: "block", mt: 0.35 }}
                            >
                              {subtitle}
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {contact.active ? (
                        <Chip label="Ativo" color="success" size="small" />
                      ) : (
                        <Chip
                          label="Inativo"
                          size="small"
                          sx={{
                            bgcolor: "grey.300",
                            color: "grey.800",
                            fontWeight: 500,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.25}
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        <Tooltip title="Editar nome">
                          <IconButton
                            size="small"
                            className={classes.actionIcon}
                            aria-label="Editar nome"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRenameModal(contact);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar fluxo">
                          <IconButton
                            size="small"
                            className={classes.actionIcon}
                            aria-label="Editar fluxo"
                            onClick={(e) => {
                              e.stopPropagation();
                              history.push(`/flowbuilder/${contact.id}`);
                            }}
                          >
                            <TuneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicar">
                          <IconButton
                            size="small"
                            className={classes.actionIcon}
                            aria-label="Duplicar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingContact(contact);
                              setConfirmDuplicateOpen(true);
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            className={classes.actionIcon}
                            aria-label="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingContact(contact);
                              setConfirmOpen(true);
                            }}
                            sx={{
                              color: "error.main",
                              opacity: 0.65,
                              "&:hover": {
                                opacity: 1,
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default FlowBuilder;
