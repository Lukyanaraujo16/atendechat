import React, { useState, useEffect, useReducer, useMemo } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles, useTheme as useMuiV4Theme } from "@material-ui/core/styles";
import { ThemeProvider } from "@mui/material/styles";
import useMuiV5BridgedTheme from "../../hooks/useMuiV5BridgedTheme";

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
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
} from "../../ui";
import { flowNodeCountFromRecord } from "../../utils/flowBuilderNodeLabels";
import FilterListIcon from "@material-ui/icons/FilterList";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";

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
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.primary,
    ...theme.scrollbarStyles,
  },
  mainPaperMobile: {
    overflowX: "hidden",
  },
  mobileActions: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    width: "100%",
  },
  mobileSearchRow: {
    display: "flex",
    gap: theme.spacing(1),
    width: "100%",
    alignItems: "center",
  },
  searchField: {
    "& .MuiOutlinedInput-input": {
      color: theme.palette.text.primary,
    },
    "& .MuiOutlinedInput-input::placeholder": {
      color: theme.palette.text.secondary,
      opacity: 1,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.divider,
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.text.secondary,
    },
    "& .MuiInputLabel-outlined": {
      color: theme.palette.text.secondary,
    },
  },
}));

function formatFlowSubtitle(flow) {
  const ts = flow.updatedAt || flow.createdAt;
  if (!ts) return null;
  try {
    return i18n.t("flowBuilderList.updatedAt", {
      date: new Date(ts).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
    });
  } catch {
    return null;
  }
}

const FlowBuilder = () => {
  const classes = useStyles();
  const muiV4Theme = useMuiV4Theme();
  const muiV5Theme = useMuiV5BridgedTheme();
  const history = useHistory();
  const isMobile = useIsMobile();

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
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [editorWarnFlow, setEditorWarnFlow] = useState(null);

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

  const filteredFlows = useMemo(() => {
    const list = Array.isArray(webhooks) ? webhooks : [];
    const q = String(searchParam || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((f) => String(f.name || "").toLowerCase().includes(q));
  }, [webhooks, searchParam]);

  const openFlowSummary = (flow) => {
    history.push(`/flowbuilder/${flow.id}`);
  };

  const openFlowEditor = (flow, force = false) => {
    if (!isMobile || force) {
      history.push(`/flowbuilder/${flow.id}${force ? "?editor=1" : ""}`);
      return;
    }
    setEditorWarnFlow(flow);
  };

  const renderMobileFlowCard = (flow) => {
    const subtitle = formatFlowSubtitle(flow);
    const nodeCount = flowNodeCountFromRecord(flow);
    const nodeLabel =
      nodeCount > 0
        ? i18n.t("flowBuilderList.nodeCount", { count: nodeCount })
        : i18n.t("flowBuilderList.noNodes");

    const menuItems = [
      {
        key: "summary",
        label: i18n.t("flowBuilderList.mobile.viewSummary"),
        icon: <VisibilityOutlinedIcon fontSize="small" />,
        onClick: () => openFlowSummary(flow),
      },
      {
        key: "rename",
        label: i18n.t("flowBuilderList.mobile.editName"),
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleOpenRenameModal(flow),
      },
      {
        key: "editor",
        label: i18n.t("flowBuilderList.mobile.openAdvancedEditor"),
        icon: <TuneIcon fontSize="small" />,
        onClick: () => openFlowEditor(flow),
      },
      {
        key: "duplicate",
        label: i18n.t("flowBuilderList.mobile.duplicate"),
        icon: <ContentCopyIcon fontSize="small" />,
        onClick: () => {
          setDeletingContact(flow);
          setConfirmDuplicateOpen(true);
        },
      },
      {
        key: "delete",
        label: i18n.t("flowBuilderList.mobile.delete"),
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: () => {
          setDeletingContact(flow);
          setConfirmOpen(true);
        },
      },
    ];

    return (
      <MobileEntityCard
        key={flow.id}
        leading={<AccountTreeIcon color="primary" />}
        title={flow.name}
        subtitle={subtitle || undefined}
        badges={
          <MobileActionsMenu
            items={menuItems}
            ariaLabel={i18n.t("flowBuilderList.mobile.flowActions")}
          />
        }
        onClick={() => openFlowSummary(flow)}
        footer={
          <Chip
            size="small"
            label={
              flow.active
                ? i18n.t("flowBuilderList.active")
                : i18n.t("flowBuilderList.inactive")
            }
            color={flow.active ? "success" : "default"}
            variant={flow.active ? "default" : "outlined"}
          />
        }
      >
        <Typography variant="caption" color="textSecondary" display="block">
          {nodeLabel}
        </Typography>
      </MobileEntityCard>
    );
  };

  return (
    <ThemeProvider theme={muiV5Theme}>
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
      {isMobile ? (
        <AppDialog
          open={filtersDialogOpen}
          onClose={() => setFiltersDialogOpen(false)}
          maxWidth="sm"
        >
          <AppDialogTitle>{i18n.t("flowBuilderList.mobile.filters")}</AppDialogTitle>
          <AppDialogContent>
            <Box className={classes.mobileActions}>
              <FlowBuilderImportFlowModal fullWidth />
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setTemplateModalOpen(true);
                  setFiltersDialogOpen(false);
                }}
                color="primary"
              >
                <Stack direction="row" gap={1} alignItems="center" justifyContent="center">
                  <PostAdd />
                  {i18n.t("flowBuilderList.fromTemplate")}
                </Stack>
              </Button>
            </Box>
          </AppDialogContent>
          <AppDialogActions>
            <AppPrimaryButton onClick={() => setFiltersDialogOpen(false)}>
              {i18n.t("flowBuilderList.mobile.filters")}
            </AppPrimaryButton>
          </AppDialogActions>
        </AppDialog>
      ) : null}

      <AppDialog
        open={Boolean(editorWarnFlow)}
        onClose={() => setEditorWarnFlow(null)}
        maxWidth="xs"
      >
        <AppDialogTitle>
          {i18n.t("flowBuilderList.mobile.editorWarningTitle")}
        </AppDialogTitle>
        <AppDialogContent>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("flowBuilderList.mobile.editorWarningBody")}
          </Typography>
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton onClick={() => setEditorWarnFlow(null)}>
            {i18n.t("contactModal.buttons.cancel")}
          </AppSecondaryButton>
          <AppSecondaryButton
            onClick={() => {
              if (editorWarnFlow) openFlowSummary(editorWarnFlow);
              setEditorWarnFlow(null);
            }}
          >
            {i18n.t("flowBuilderList.mobile.viewSummaryAction")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={() => {
              if (editorWarnFlow) openFlowEditor(editorWarnFlow, true);
              setEditorWarnFlow(null);
            }}
          >
            {i18n.t("flowBuilderList.mobile.openAnyway")}
          </AppPrimaryButton>
        </AppDialogActions>
      </AppDialog>

      <MainHeader>
        <Title>{i18n.t("flowBuilderList.title")}</Title>
        {isMobile ? (
          <Box className={classes.mobileActions} mt={1}>
            <Box className={classes.mobileSearchRow}>
              <TextField
                className={classes.searchField}
                placeholder={i18n.t("contacts.searchPlaceholder")}
                type="search"
                variant="outlined"
                size="small"
                fullWidth
                value={searchParam}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon style={{ color: muiV4Theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => setFiltersDialogOpen(true)}
                style={{ minHeight: 40, flexShrink: 0 }}
              >
                <FilterListIcon />
              </Button>
            </Box>
            <Button
              variant="contained"
              onClick={handleOpenContactModal}
              color="primary"
              fullWidth
            >
              <Stack direction="row" gap={1} alignItems="center" justifyContent="center">
                <AddCircle />
                {i18n.t("flowBuilderList.addFlow")}
              </Stack>
            </Button>
          </Box>
        ) : (
          <MainHeaderButtonsWrapper>
            <TextField
              className={classes.searchField}
              placeholder={i18n.t("contacts.searchPlaceholder")}
              type="search"
              variant="outlined"
              size="small"
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: muiV4Theme.palette.text.secondary }} />
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
                {i18n.t("flowBuilderList.fromTemplate")}
              </Stack>
            </Button>
            <Button
              variant="contained"
              onClick={handleOpenContactModal}
              color="primary"
            >
              <Stack direction={"row"} gap={1}>
                <AddCircle />
                {i18n.t("flowBuilderList.addFlow")}
              </Stack>
            </Button>
          </MainHeaderButtonsWrapper>
        )}
      </MainHeader>
      <Paper
        className={isMobile ? `${classes.mainPaper} ${classes.mainPaperMobile}` : classes.mainPaper}
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
        ) : isMobile ? (
          filteredFlows.length === 0 ? (
            <Typography variant="body2" color="textSecondary" align="center" py={4}>
              {i18n.t("contacts.noContacts")}
            </Typography>
          ) : (
            <MobileCardList>
              {filteredFlows.map((flow) => renderMobileFlowCard(flow))}
            </MobileCardList>
          )
        ) : (
          <Table
            size="medium"
            sx={{
              minWidth: 480,
              borderCollapse: "separate",
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    py: 2,
                    fontSize: "0.8125rem",
                    color: "text.secondary",
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  {i18n.t("contacts.table.name")}
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 600,
                    width: 140,
                    py: 2,
                    fontSize: "0.8125rem",
                    color: "text.secondary",
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  Status
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    width: 216,
                    py: 2,
                    fontSize: "0.8125rem",
                    color: "text.secondary",
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  {i18n.t("contacts.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFlows.map((contact) => {
                const subtitle = formatFlowSubtitle(contact);
                return (
                  <TableRow
                    key={contact.id}
                    hover
                    sx={{
                      "& td": {
                        verticalAlign: "middle",
                        py: 2,
                        borderBottom: 1,
                        borderColor: "divider",
                        color: "text.primary",
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
                              color: "text.primary",
                            }}
                          >
                            {contact.name}
                          </Typography>
                          {subtitle ? (
                            <Typography
                              variant="caption"
                              component="div"
                              sx={{ display: "block", mt: 0.35, color: "text.secondary" }}
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
                          variant="outlined"
                          sx={{
                            fontWeight: 500,
                            color: "text.secondary",
                            borderColor: "divider",
                            bgcolor: (t) =>
                              t.palette.mode === "dark"
                                ? "rgba(255,255,255,0.06)"
                                : t.palette.action.hover,
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
                            aria-label="Editar nome"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRenameModal(contact);
                            }}
                            sx={{
                              color: "text.secondary",
                              "&:hover": {
                                color: "primary.main",
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar fluxo">
                          <IconButton
                            size="small"
                            aria-label="Editar fluxo"
                            onClick={(e) => {
                              e.stopPropagation();
                              history.push(`/flowbuilder/${contact.id}`);
                            }}
                            sx={{
                              color: "text.secondary",
                              "&:hover": {
                                color: "primary.main",
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            <TuneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicar">
                          <IconButton
                            size="small"
                            aria-label="Duplicar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingContact(contact);
                              setConfirmDuplicateOpen(true);
                            }}
                            sx={{
                              color: "text.secondary",
                              "&:hover": {
                                color: "primary.main",
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            aria-label="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingContact(contact);
                              setConfirmOpen(true);
                            }}
                            sx={{
                              color: "error.main",
                              opacity: (t) => (t.palette.mode === "dark" ? 0.85 : 0.7),
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
    </ThemeProvider>
  );
};

export default FlowBuilder;
