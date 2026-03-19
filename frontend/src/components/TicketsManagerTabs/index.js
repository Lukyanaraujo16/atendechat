import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import Fab from "@material-ui/core/Fab";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import FlashOnIcon from "@material-ui/icons/FlashOn";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import IconButton from "@material-ui/core/IconButton";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

import FolderOpenIcon from "@material-ui/icons/FolderOpen";
import PersonIcon from "@material-ui/icons/Person";
import AndroidIcon from "@material-ui/icons/Android";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { Can } from "../Can";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { Button, ButtonBase } from "@material-ui/core";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";

import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import GroupIcon from "@material-ui/icons/Group";
import FilterListIcon from "@material-ui/icons/FilterList";

const useStyles = makeStyles(theme => ({
	ticketsWrapper: {
		position: "relative",
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius:0,
	},

	tabsHeader: {
		flex: "none",
		backgroundColor: "#fff",
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
	},

	tabsInternal: {
		flex: "none",
		backgroundColor: theme.palette.tabHeaderBackground
	},

	settingsIcon: {
		alignSelf: "center",
		marginLeft: "auto",
		padding: 8,
	},

	tab: {
		minWidth: 120,
		width: 120,
		color: "rgba(0,0,0,0.45)",
		"&.Mui-selected": {
			color: "rgba(0,0,0,0.87)",
		},
	},

	internalTab: {
		minWidth: 120,
		width: 120,
		padding: 5
	},

	ticketOptionsBox: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: theme.palette.optionsBackground,
		padding: theme.spacing(1),
	},

	ticketSearchLine: {
		padding: theme.spacing(1),
	},

	serachInputWrapper: {
		flex: 1,
		background: theme.palette.total,
		display: "flex",
		borderRadius: 40,
		padding: 4,
		marginRight: theme.spacing(1),
	},

	searchIcon: {
		color: "grey",
		marginLeft: 6,
		marginRight: 6,
		alignSelf: "center",
	},

	searchInput: {
		flex: 1,
		border: "none",
		borderRadius: 30,
	},

	insiderTabPanel: {
		height: '100%',
		marginTop: "-72px",
		paddingTop: "72px"
	},

	insiderDoubleTabPanel: {
		display:"flex",
		flexDirection: "column",
		marginTop: "-72px",
		paddingTop: "72px",
		height: "100%"
	},

	labelContainer: {
		width: "auto",
		padding: 0
	},
	iconLabelWrapper: {
		flexDirection: "row",
		'& > *:first-child': {
			marginBottom: '3px !important',
			marginRight: 16
		}
	},
	insiderTabLabel: {
		[theme.breakpoints.down(1600)]: {
			display:'none'
		}
	},
	smallFormControl: {
		'& .MuiOutlinedInput-input': {
			padding: "12px 10px",
		},
		'& .MuiInputLabel-outlined': {
			marginTop: "-6px"
		}
	},
	// Stream HUB: abas em maiúsculas, pills e busca
	tabLabel: {
		textTransform: "uppercase",
		fontWeight: 600,
		fontSize: "0.8125rem",
	},
	statusPillsRow: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(1),
		padding: theme.spacing(1, 2),
		backgroundColor: theme.palette.background.paper,
		borderBottom: "1px solid rgba(0,0,0,0.08)",
	},
	statusPill: {
		fontSize: "0.75rem",
		fontWeight: 600,
		padding: "6px 12px",
		borderRadius: 8,
	},
	statusPillBtn: {
		cursor: "pointer",
		border: "none",
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	statusPillIcon: {
		fontSize: 16,
	},
	statusCountGreen: {
		width: 20,
		height: 20,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#24c776",
		border: "none",
		color: "#fff",
		fontWeight: 700,
		fontSize: "0.72rem",
	},
	statusCountPink: {
		width: 20,
		height: 20,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#e91e63",
		border: "none",
		color: "#fff",
		fontWeight: 700,
		fontSize: "0.72rem",
	},
	statusPillGreen: {
		backgroundColor: "rgba(36, 199, 118, 0.10)",
		border: "1px solid rgba(36, 199, 118, 0.35)",
		color: "#24c776",
	},
	statusPillGreenActive: {
		boxShadow: "inset 0 0 0 2px rgba(36, 199, 118, 0.18)",
	},
	statusPillPink: {
		backgroundColor: "rgba(233, 30, 99, 0.10)",
		border: "1px solid rgba(233, 30, 99, 0.30)",
		color: "#e91e63",
	},
	statusPillPinkActive: {
		boxShadow: "inset 0 0 0 2px rgba(233, 30, 99, 0.18)",
	},
	searchRow: {
		display: "flex",
		alignItems: "center",
		padding: theme.spacing(1, 1.5),
		borderBottom: "1px solid rgba(0,0,0,0.08)",
		backgroundColor: "#f4f4f4",
	},
	searchInputWrap: {
		flex: 1,
		display: "flex",
		alignItems: "center",
		border: "1px solid rgba(0,0,0,0.12)",
		borderRadius: 4,
		padding: "6px 10px",
		backgroundColor: "#fff",
	},
	searchButton: {
		backgroundColor: "#1a1a1a",
		color: "#fff",
		marginLeft: theme.spacing(1),
		borderRadius: 8,
		width: 34,
		height: 34,
		padding: 0,
		"&:hover": {
			backgroundColor: "#333",
		},
	},
	fabsWrap: {
		position: "absolute",
		bottom: 16,
		left: 16,
		display: "flex",
		flexDirection: "column",
		gap: 10,
		zIndex: 10,
	},
	fabGreen: {
		backgroundColor: "#24c776",
		color: "#fff",
		boxShadow: "0 4px 14px rgba(36, 199, 118, 0.45)",
		animation: "$fabPulse 2s ease-in-out infinite",
		"&:hover": {
			backgroundColor: "#1fb865",
		},
	},
	"@keyframes fabPulse": {
		"0%, 100%": { boxShadow: "0 4px 14px rgba(36, 199, 118, 0.45)" },
		"50%": { boxShadow: "0 4px 20px rgba(36, 199, 118, 0.7)" },
	},
	// Modal Ações em massa
	bulkModalTitle: {
		fontSize: "1.125rem",
		fontWeight: 600,
		padding: theme.spacing(2, 3),
		borderBottom: "1px solid rgba(0,0,0,0.08)",
	},
	bulkSection: {
		padding: theme.spacing(2, 3),
	},
	bulkSectionTitle: {
		fontSize: "0.75rem",
		fontWeight: 700,
		letterSpacing: "0.05em",
		color: theme.palette.text.secondary,
		marginBottom: theme.spacing(1.5),
	},
	bulkButtonsRow: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(1.5),
	},
	bulkButton: {
		textTransform: "none",
		fontWeight: 600,
	},
	bulkAssignRow: {
		marginTop: theme.spacing(2),
	},
	bulkSelect: {
		width: "100%",
		marginBottom: theme.spacing(1.5),
	},
	bulkFooter: {
		padding: theme.spacing(2, 3),
		borderTop: "1px solid rgba(0,0,0,0.08)",
		display: "flex",
		justifyContent: "flex-end",
	},
	groupsPlaceholder: {
		padding: theme.spacing(4, 2),
		textAlign: "center",
		color: theme.palette.text.secondary,
	},
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [bulkActionsModalOpen, setBulkActionsModalOpen] = useState(false);
  const [bulkSelectedConnection, setBulkSelectedConnection] = useState("");
  const [bulkTicketIds, setBulkTicketIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const { profile } = user;

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [chatbotCount, setChatbotCount] = useState(0);

  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  const fetchTicketsWithoutConnection = async () => {
    setBulkLoading(true);
    try {
      const { data } = await api.get("/tickets/without-connection");
      setBulkTicketIds(data.ticketIds || []);
    } catch (err) {
      toastError(err);
      setBulkTicketIds([]);
    }
    setBulkLoading(false);
  };

  const handleOpenBulkModal = () => {
    setBulkActionsModalOpen(true);
    setBulkSelectedConnection("");
    fetchTicketsWithoutConnection();
  };

  const handleBulkAssign = async () => {
    if (!bulkSelectedConnection || bulkTicketIds.length === 0) return;
    setBulkAssigning(true);
    try {
      const { data } = await api.post("/tickets/bulk-assign-connection", {
        whatsappId: Number(bulkSelectedConnection),
        ticketIds: bulkTicketIds
      });
      toast.success(`${data.updated || 0} ticket(s) atribuído(s) à conexão.`);
      setBulkActionsModalOpen(false);
      setBulkSelectedConnection("");
      setBulkTicketIds([]);
    } catch (err) {
      toastError(err);
    }
    setBulkAssigning(false);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper} style={{ position: "relative" }}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => handleCloseOrOpenTicket(ticket)}
      />

      <Dialog
        open={bulkActionsModalOpen}
        onClose={() => setBulkActionsModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ style: { borderRadius: 12 } }}
      >
        <DialogTitle className={classes.bulkModalTitle}>
          Ações em massa - Tickets
        </DialogTitle>
        <DialogContent style={{ padding: 0 }}>
          <div className={classes.bulkSection}>
            <Typography className={classes.bulkSectionTitle}>
              FECHAR TODOS TICKETS:
            </Typography>
            <div className={classes.bulkButtonsRow}>
              <Button
                variant="outlined"
                className={classes.bulkButton}
                startIcon={<FolderOpenIcon />}
                onClick={() => {}}
              >
                Abertos
              </Button>
              <Button
                variant="outlined"
                className={classes.bulkButton}
                startIcon={<PersonIcon />}
                onClick={() => {}}
              >
                Pendentes
              </Button>
              <Button
                variant="outlined"
                className={classes.bulkButton}
                startIcon={<AndroidIcon />}
                onClick={() => {}}
              >
                CHATBOT
              </Button>
            </div>
          </div>
          <div className={`${classes.bulkSection} ${classes.bulkAssignRow}`}>
            <Typography className={classes.bulkSectionTitle}>
              ATRIBUIR TODOS TICKETS SEM CONEXÃO:
            </Typography>
            {bulkLoading ? (
              <Typography variant="body2" color="textSecondary">
                Carregando…
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                  {bulkTicketIds.length} ticket(s) sem conexão
                </Typography>
                <FormControl variant="outlined" size="small" className={classes.bulkSelect}>
                  <InputLabel id="bulk-connection-label">Conexão</InputLabel>
                  <Select
                    labelId="bulk-connection-label"
                    value={bulkSelectedConnection}
                    onChange={(e) => setBulkSelectedConnection(e.target.value)}
                    label="Conexão"
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {(whatsApps || []).map((w) => (
                      <MenuItem key={w.id} value={String(w.id)}>
                        {w.name || `Conexão ${w.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={!bulkSelectedConnection || bulkTicketIds.length === 0 || bulkAssigning}
                  onClick={handleBulkAssign}
                >
                  {bulkAssigning ? "Atribuindo…" : "Atribuir"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
        <div className={classes.bulkFooter}>
          <Button
            onClick={() => setBulkActionsModalOpen(false)}
            color="default"
            className={classes.bulkButton}
          >
            CANCELAR
          </Button>
        </div>
      </Dialog>
      <Paper elevation={0} className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="inherit"
        >
          <Tab
            value={"open"}
            classes={{ root: classes.tab }}
            label={
              <span className={classes.tabLabel}>
                <FolderOpenIcon style={{ fontSize: 16, color: "#24c776", marginRight: 6 }} />
                ABERTAS
              </span>
            }
          />
          <Tab
            value={"closed"}
            classes={{ root: classes.tab }}
            label={
              <span className={classes.tabLabel}>
                <CheckCircleIcon style={{ fontSize: 16, color: "#24c776", marginRight: 6 }} />
                RESOLVIDOS
              </span>
            }
          />
          <Tab
            value={"groups"}
            classes={{ root: classes.tab, label: classes.tabLabel }}
            label={
              <span className={classes.tabLabel}>
                <GroupIcon style={{ fontSize: 16, color: "#24c776", marginRight: 6 }} />
                GRUPOS
              </span>
            }
          />
          <Tab
            value={"search"}
            classes={{ root: classes.tab, label: classes.tabLabel }}
            label={
              <span className={classes.tabLabel}>
                <FilterListIcon style={{ fontSize: 16, color: "#24c776", marginRight: 6 }} />
                FILTROS
              </span>
            }
          />
        </Tabs>
      </Paper>

      {tab === "open" && (
        <div className={classes.statusPillsRow}>
          <ButtonBase
            className={`${classes.statusPill} ${classes.statusPillBtn} ${classes.statusPillGreen} ${
              tabOpen === "open" ? classes.statusPillGreenActive : ""
            }`}
            onClick={() => setTabOpen("open")}
          >
            <span className={classes.statusCountGreen}>{openCount}</span>
            <FolderOpenIcon className={classes.statusPillIcon} />
            ATENDENDO
          </ButtonBase>

          <ButtonBase
            className={`${classes.statusPill} ${classes.statusPillBtn} ${classes.statusPillPink} ${
              tabOpen === "pending" ? classes.statusPillPinkActive : ""
            }`}
            onClick={() => setTabOpen("pending")}
          >
            <span className={classes.statusCountPink}>{pendingCount}</span>
            <PersonIcon className={classes.statusPillIcon} />
            AGUARDANDO
          </ButtonBase>

          <ButtonBase
            className={`${classes.statusPill} ${classes.statusPillBtn} ${classes.statusPillGreen} ${
              tabOpen === "chatbot" ? classes.statusPillGreenActive : ""
            }`}
            onClick={() => setTabOpen("chatbot")}
          >
            <span className={classes.statusCountGreen}>{chatbotCount}</span>
            <AndroidIcon className={classes.statusPillIcon} />
            CHATBOT
          </ButtonBase>
        </div>
      )}

      <div className={classes.searchRow}>
        <div className={classes.searchInputWrap}>
          <InputBase
            className={classes.searchInput}
            inputRef={searchInputRef}
            placeholder="Buscar atendimento e mensagens"
            type="search"
            value={searchParam}
            onChange={(e) => {
              if (e.target.value.trim()) setTab("search");
              handleSearch(e);
            }}
            onFocus={() => tab !== "search" && setTab("search")}
            fullWidth
            style={{ marginLeft: 4 }}
          />
        </div>
        <IconButton
          className={classes.searchButton}
          size="small"
          onClick={() => searchInputRef.current?.focus()}
          aria-label="Buscar"
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </div>

      {tab === "search" && (
        <Paper square elevation={0} className={classes.ticketOptionsBox}>
          <Can
            role={user.profile}
            perform="tickets-manager:showall"
            yes={() =>
              tab === "open" ? (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() => setShowAllTickets((prev) => !prev)}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              ) : null
            }
          />
          <TicketsQueueSelect
            style={{ marginLeft: 6 }}
            selectedQueueIds={selectedQueueIds}
            userQueues={user?.queues}
            onChange={(values) => setSelectedQueueIds(values)}
          />
        </Paper>
      )}

      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Paper className={classes.ticketsWrapper} style={{ position: "relative" }}>
          {tabOpen === "open" && (
            <TicketsList
              status="open"
              showAll={showAllTickets}
              selectedQueueIds={selectedQueueIds}
              updateCount={(val) => setOpenCount(val)}
            />
          )}
          {tabOpen === "pending" && (
            <TicketsList
              status="pending"
              selectedQueueIds={selectedQueueIds}
              updateCount={(val) => setPendingCount(val)}
            />
          )}
          {tabOpen === "chatbot" && (
            <TicketsList
              status="pending"
              selectedQueueIds={selectedQueueIds}
              chatbotOnly
              updateCount={(val) => setChatbotCount(val)}
            />
          )}
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TagsFilter onFiltered={handleSelectedTags} />
        {profile === "admin" && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>

      <TabPanel value={tab} name="groups" className={classes.ticketsWrapper}>
        <div className={classes.groupsPlaceholder}>
          <Typography variant="body2">Em breve.</Typography>
        </div>
      </TabPanel>

      <div className={classes.fabsWrap}>
        <Fab
          size="small"
          className={classes.fabGreen}
          onClick={() => setNewTicketModalOpen(true)}
          aria-label="Novo atendimento"
        >
          <AddIcon />
        </Fab>
        <Fab
          size="small"
          className={classes.fabGreen}
          onClick={handleOpenBulkModal}
          aria-label="Ações em massa"
        >
          <FlashOnIcon />
        </Fab>
      </div>
    </Paper>
  );
};

export default TicketsManagerTabs;
