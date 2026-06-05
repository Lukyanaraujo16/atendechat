import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
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
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import DownloadIcon from "@material-ui/icons/GetApp";
import ListAltIcon from "@material-ui/icons/ListAlt";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListDialog from "../../components/ContactListDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid } from "@material-ui/core";

import planilhaExemplo from "../../assets/planilha.xlsx";
import { SocketContext } from "../../context/Socket/SocketContext";
import useIsMobile from "../../hooks/useIsMobile";
import {
  MobileEntityCard,
  MobileCardList,
  MobileActionsMenu,
  AppSecondaryButton,
} from "../../ui";
import CircularProgress from "@material-ui/core/CircularProgress";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTLISTS") {
    const contactLists = Array.isArray(action.payload) ? action.payload : [];
    const newContactLists = [];

    contactLists.forEach((contactList) => {
      const contactListIndex = state.findIndex((u) => u.id === contactList.id);
      if (contactListIndex !== -1) {
        state[contactListIndex] = contactList;
      } else {
        newContactLists.push(contactList);
      }
    });

    return [...state, ...newContactLists];
  }

  if (action.type === "UPDATE_CONTACTLIST") {
    const contactList = action.payload;
    const contactListIndex = state.findIndex((u) => u.id === contactList.id);

    if (contactListIndex !== -1) {
      state[contactListIndex] = contactList;
      return [...state];
    } else {
      return [contactList, ...state];
    }
  }

  if (action.type === "DELETE_CONTACTLIST") {
    const contactListId = action.payload;

    const contactListIndex = state.findIndex((u) => u.id === contactListId);
    if (contactListIndex !== -1) {
      state.splice(contactListIndex, 1);
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
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  mobileList: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  mobileLoadMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2, 0, 1),
  },
}));

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedContactList, setSelectedContactList] = useState(null);
  const [deletingContactList, setDeletingContactList] = useState(null);
  const [contactListModalOpen, setContactListModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactLists, dispatch] = useReducer(reducer, []);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContactLists = async () => {
        try {
          const { data } = await api.get("/contact-lists/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTLISTS", payload: Array.isArray(data?.records) ? data.records : [] });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContactLists();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handler = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTLIST", payload: data.record });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACTLIST", payload: +data.id });
      }
    };

    socket.on(`company-${companyId}-ContactList`, handler);

    return () => {
      socket.off(`company-${companyId}-ContactList`, handler);
    };
  }, [socketManager]);

  const handleOpenContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(true);
  };

  const handleCloseContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditContactList = (contactList) => {
    setSelectedContactList(contactList);
    setContactListModalOpen(true);
  };

  const handleDeleteContactList = async (contactListId) => {
    try {
      await api.delete(`/contact-lists/${contactListId}`);
      toast.success(i18n.t("contactLists.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContactList(null);
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

  const goToContacts = (id) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  const renderMobileContactListCard = (contactList) => {
    const menuItems = [
      {
        key: "contacts",
        label: i18n.t("contactLists.mobile.viewContacts"),
        icon: <PeopleIcon fontSize="small" />,
        onClick: () => goToContacts(contactList.id),
      },
      {
        key: "download",
        label: i18n.t("contactLists.mobile.downloadTemplate"),
        icon: <DownloadIcon fontSize="small" />,
        onClick: () => {
          const link = document.createElement("a");
          link.href = planilhaExemplo;
          link.download = "planilha.xlsx";
          link.click();
        },
      },
      {
        key: "edit",
        label: i18n.t("contactLists.dialog.edit"),
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEditContactList(contactList),
      },
      {
        key: "delete",
        label: i18n.t("contactLists.confirmationModal.deleteTitle"),
        icon: <DeleteOutlineIcon fontSize="small" />,
        danger: true,
        onClick: () => {
          setConfirmModalOpen(true);
          setDeletingContactList(contactList);
        },
      },
    ];

    return (
      <MobileEntityCard
        key={contactList.id}
        leading={<ListAltIcon color="primary" />}
        title={contactList.name}
        badges={
          <MobileActionsMenu
            items={menuItems}
            ariaLabel={i18n.t("contactLists.mobile.flowActions")}
          />
        }
        onClick={() => goToContacts(contactList.id)}
        footer={
          <Chip
            size="small"
            variant="outlined"
            label={`${contactList.contactsCount || 0} ${i18n.t("contactLists.table.contacts").toLowerCase()}`}
          />
        }
      />
    );
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingContactList &&
          `${i18n.t("contactLists.confirmationModal.deleteTitle")} ${
            deletingContactList.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteContactList(deletingContactList.id)}
      >
        {i18n.t("contactLists.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ContactListDialog
        open={contactListModalOpen}
        onClose={handleCloseContactListModal}
        aria-labelledby="form-dialog-title"
        contactListId={selectedContactList && selectedContactList.id}
      />
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} sm={8} item>
            <Title>{i18n.t("contactLists.title")}</Title>
          </Grid>
          <Grid xs={12} sm={4} item>
            <Grid spacing={2} container>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("contacts.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="inherit" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={12} sm={6} item>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleOpenContactListModal}
                >
                  {i18n.t("contactLists.buttons.add")}
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={isMobile ? undefined : handleScroll}
      >
        {isMobile ? (
          <Box className={classes.mobileList}>
            {contactLists.length === 0 && !loading ? (
              <Typography variant="body2" color="textSecondary" align="center" style={{ padding: 24 }}>
                {i18n.t("contacts.searchPlaceholder")}
              </Typography>
            ) : (
              <MobileCardList>
                {contactLists.map((contactList) =>
                  renderMobileContactListCard(contactList)
                )}
              </MobileCardList>
            )}
            {loading && contactLists.length > 0 ? (
              <Box className={classes.mobileLoadMore}>
                <CircularProgress size={28} />
              </Box>
            ) : null}
            {hasMore && !loading ? (
              <Box className={classes.mobileLoadMore}>
                <AppSecondaryButton onClick={loadMore}>
                  {i18n.t("contactLists.mobile.loadMore")}
                </AppSecondaryButton>
              </Box>
            ) : null}
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center">
                  {i18n.t("contactLists.table.name")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("contactLists.table.contacts")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("contactLists.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <>
                {contactLists.map((contactList) => (
                  <TableRow key={contactList.id}>
                    <TableCell align="center">{contactList.name}</TableCell>
                    <TableCell align="center">
                      {contactList.contactsCount || 0}
                    </TableCell>
                    <TableCell align="center">
                      <a href={planilhaExemplo} download="planilha.xlsx">
                        <IconButton size="small" title="Baixar Planilha Exemplo">
                          <DownloadIcon />
                        </IconButton>
                      </a>

                      <IconButton
                        size="small"
                        onClick={() => goToContacts(contactList.id)}
                      >
                        <PeopleIcon />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => handleEditContactList(contactList)}
                      >
                        <EditIcon />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingContactList(contactList);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {loading && <TableRowSkeleton columns={3} />}
              </>
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default ContactLists;
