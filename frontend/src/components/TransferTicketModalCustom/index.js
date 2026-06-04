import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { Grid, ListItemText, Typography, makeStyles } from "@material-ui/core";

import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import { canAccessTicket } from "../../utils/canAccessTicket";

const useStyles = makeStyles((theme) => ({
  maxWidth: {
    width: "100%",
  },
  autocomplete: {
    width: "100%",
    maxWidth: "100%",
    marginBottom: theme.spacing(2.5),
  },
}));

const filterOptions = createFilterOptions({
  trim: true,
});

const stopDialogEvent = (e) => e.stopPropagation();

const TransferTicketModalCustom = ({ modalOpen, onClose, ticketid }) => {
  const history = useHistory();
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const classes = useStyles();
  const { findAll: findAllQueues } = useQueues();
  const isMounted = useRef(true);
  const focusBeforeOpenRef = useRef(null);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const { user } = useContext(AuthContext);
  const inbox = useContext(TicketsInboxContext);
  const { companyId, whatsappId } = user;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (modalOpen) {
      focusBeforeOpenRef.current = document.activeElement;
      return undefined;
    }

    setSearchDraft("");
    setSearchQuery("");
    setSelectedUser(null);
    setUsersLoading(false);

    const previous = focusBeforeOpenRef.current;
    focusBeforeOpenRef.current = null;
    if (
      previous &&
      typeof previous.focus === "function" &&
      document.contains(previous)
    ) {
      requestAnimationFrame(() => {
        previous.focus();
      });
    }
    return undefined;
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const t = setTimeout(() => setSearchQuery(searchDraft), 300);
    return () => clearTimeout(t);
  }, [searchDraft, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const fetchContacts = async () => {
      try {
        const { data } = await api.get(`/whatsapp`, { params: { companyId, session: 0 } });
        if (isMounted.current) setWhatsapps(data);
      } catch (err) {
        toastError(err);
      }
    };

    if (whatsappId !== null && whatsappId !== undefined) {
      setSelectedWhatsapp(whatsappId);
    }

    const userQueues = Array.isArray(user?.queues) ? user.queues : [];
    if (userQueues.length === 1) {
      setSelectedQueue(userQueues[0].id);
    }
    fetchContacts();
  }, [modalOpen, companyId, whatsappId, user?.queues]);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      setUsersLoading(false);
      return undefined;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setUsersLoading(false);
      setOptions([]);
      return undefined;
    }

    let cancelled = false;
    setUsersLoading(true);

    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users/transfer-list", {
          params: { searchParam: trimmed },
        });
        if (!cancelled && isMounted.current) {
          setOptions(Array.isArray(data.users) ? data.users : []);
        }
      } catch (err) {
        if (!cancelled) toastError(err);
      } finally {
        if (!cancelled && isMounted.current) {
          setUsersLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, modalOpen]);

  const handleClose = () => {
    onClose();
  };

  const handleSearchInputChange = useCallback(
    (e) => {
      const next = e.target.value;
      setSearchDraft(next);
      if (selectedUser) {
        setSelectedUser(null);
        setQueues(allQueues);
        setSelectedQueue("");
      }
    },
    [selectedUser, allQueues]
  );

  const renderAutocompleteInput = useCallback(
    (params) => (
      <TextField
        {...params}
        label={i18n.t("transferTicketModal.fieldLabel")}
        variant="outlined"
        autoComplete="off"
        onChange={handleSearchInputChange}
        onMouseDown={stopDialogEvent}
        onClick={stopDialogEvent}
        onFocus={stopDialogEvent}
        inputProps={{
          ...params.inputProps,
          autoComplete: "off",
        }}
        InputProps={{
          ...params.InputProps,
          endAdornment: (
            <React.Fragment>
              {usersLoading ? (
                <CircularProgress color="inherit" size={20} />
              ) : null}
              {params.InputProps.endAdornment}
            </React.Fragment>
          ),
        }}
      />
    ),
    [handleSearchInputChange, usersLoading]
  );

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!ticketid) return;
    if (!selectedQueue || selectedQueue === "") return;
    setSaving(true);
    try {
      const data = {
        status: "pending",
        chatbot: false,
        queueOptionId: null,
        useIntegration: false,
        integrationId: null,
        promptId: null,
        userId: selectedUser ? selectedUser.id : null,
        queueId: selectedQueue,
      };

      if (selectedWhatsapp) {
        data.whatsappId = selectedWhatsapp;
      }
      const { data: updatedTicket } = await api.put(`/tickets/${ticketid}`, data);

      if (updatedTicket && typeof inbox?.moveTicketToColumn === "function" && canAccessTicket(user, updatedTicket)) {
        inbox.moveTicketToColumn(updatedTicket);
      } else if (typeof inbox?.removeTicket === "function") {
        inbox.removeTicket(ticketid);
      }
      if (typeof inbox?.refreshTabCounts === "function") {
        inbox.refreshTabCounts();
      }
      if (typeof inbox?.scheduleReloadBothPendingSubsets === "function") {
        inbox.scheduleReloadBothPendingSubsets();
      }
      if (typeof inbox?.scheduleReloadOpenList === "function") {
        inbox.scheduleReloadOpenList();
      }

      onClose();
      history.push(`/tickets`);
    } catch (err) {
      setSaving(false);
      toastError(err);
    }
  };

  return (
    <AppDialog
      open={modalOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      disableEnforceFocus
      disableAutoFocus
      disableRestoreFocus
      keepMounted
    >
      <form onSubmit={handleSaveTicket}>
        <AppDialogTitle id="form-dialog-title">
          {i18n.t("transferTicketModal.title")}
        </AppDialogTitle>
        <AppDialogContent
          onMouseDown={stopDialogEvent}
          onClick={stopDialogEvent}
        >
          <Autocomplete
            className={classes.autocomplete}
            value={selectedUser}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : `${option.name || ""}`
            }
            onChange={(_e, newValue) => {
              if (newValue && typeof newValue === "object") {
                setSelectedUser(newValue);
                setSearchDraft(newValue.name || "");
                if (Array.isArray(newValue.queues)) {
                  setQueues(newValue.queues);
                } else {
                  setQueues(allQueues);
                  setSelectedQueue("");
                }
              } else {
                setSelectedUser(null);
                setQueues(allQueues);
              }
            }}
            options={options}
            filterOptions={filterOptions}
            freeSolo
            autoHighlight
            disablePortal
            blurOnSelect={false}
            clearOnBlur={false}
            handleHomeEndKeys={false}
            noOptionsText={i18n.t("transferTicketModal.noOptions")}
            loading={usersLoading}
            renderInput={renderAutocompleteInput}
          />
          <FormControl variant="outlined" className={classes.maxWidth}>
            <InputLabel>
              {i18n.t("transferTicketModal.fieldQueueLabel")}
            </InputLabel>
            <Select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
            >
              {queues.map((queue) => (
                <MenuItem key={queue.id} value={queue.id}>
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Grid container spacing={2} style={{ marginTop: "15px" }}>
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedWhatsapp}
                onChange={(e) => {
                  setSelectedWhatsapp(e.target.value);
                }}
                MenuProps={{
                  anchorOrigin: {
                    vertical: "bottom",
                    horizontal: "left",
                  },
                  transformOrigin: {
                    vertical: "top",
                    horizontal: "left",
                  },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedWhatsapp === "") {
                    return "Selecione uma Conexão";
                  }
                  const whatsapp = whatsapps.find((w) => w.id === selectedWhatsapp);
                  return whatsapp?.name || "";
                }}
              >
                {whatsapps?.length > 0 &&
                  whatsapps.map((whatsapp, key) => (
                    <MenuItem dense key={key} value={whatsapp.id}>
                      <ListItemText
                        primary={
                          <Typography
                            component="span"
                            style={{
                              fontSize: 14,
                              marginLeft: "10px",
                              display: "inline-flex",
                              alignItems: "center",
                              lineHeight: "2",
                            }}
                          >
                            {whatsapp.name} &nbsp; ({whatsapp.status})
                          </Typography>
                        }
                      />
                    </MenuItem>
                  ))}
              </Select>
            </Grid>
          </Grid>
        </AppDialogContent>
        <AppDialogActions stickyFooter>
          <Button
            onClick={handleClose}
            color="secondary"
            disabled={saving}
            variant="outlined"
          >
            {i18n.t("transferTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="submit"
            color="primary"
            loading={saving}
          >
            {i18n.t("transferTicketModal.buttons.ok")}
          </ButtonWithSpinner>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
};

export default TransferTicketModalCustom;
