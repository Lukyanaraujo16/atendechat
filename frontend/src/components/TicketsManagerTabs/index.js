import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tab from "@material-ui/core/Tab";
import { AppTabs } from "../../ui";
import Fab from "@material-ui/core/Fab";
import Typography from "@material-ui/core/Typography";
import AddIcon from "@material-ui/icons/Add";
import FlashOnIcon from "@material-ui/icons/FlashOn";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
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
import ViewCompactOutlined from "@material-ui/icons/ViewCompactOutlined";

import useTicketsKeyboardShortcuts from "../../hooks/useTicketsKeyboardShortcuts";

/**
 * Atendimentos (desktop): abas, busca, filtros e lista.
 * Fluxo oficial: este arquivo + `TicketsListCustom` (importado como `TicketsList` abaixo).
 * Não confundir com `TicketsManager`/`TicketsList` legados.
 */
const useStyles = makeStyles(theme => ({
	ticketsRoot: {
		position: "relative",
		display: "flex",
		flexDirection: "column",
		flex: 1,
		minHeight: 0,
		width: "100%",
		height: "100%",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius: 0,
	},
	ticketsWrapper: {
		position: "relative",
		display: "flex",
		flex: 1,
		minHeight: 0,
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius: 0,
	},

	tabsHeader: {
		flex: "none",
		backgroundColor: theme.palette.background.paper,
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
		borderBottom: `1px solid ${theme.palette.divider}`,
		"& .MuiTabs-indicator": {
			height: 3,
			borderRadius: 2,
			backgroundColor: theme.palette.primary.main,
		},
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
		minWidth: 72,
		[theme.breakpoints.down("sm")]: {
			minWidth: 0,
			paddingLeft: theme.spacing(0.5),
			paddingRight: theme.spacing(0.5),
		},
		color: theme.palette.text.secondary,
		opacity: 0.95,
		transition: theme.transitions.create(["color", "opacity"], { duration: 150 }),
		"&.Mui-selected": {
			color: theme.palette.primary.main,
			opacity: 1,
			fontWeight: 700,
		},
	},
	tabMenuIcon: {
		fontSize: 18,
		marginRight: theme.spacing(0.75),
		verticalAlign: "middle",
		color: theme.palette.success.main,
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
		padding: theme.spacing(1, 1),
		backgroundColor: theme.palette.background.paper,
		justifyContent: "center",
		alignItems: "center",
		width: "100%",
		borderBottom: `1px solid ${theme.palette.divider}`,
	},
	statusPill: {
		fontSize: "0.75rem",
		fontWeight: 600,
		padding: "6px 12px",
		borderRadius: 6,
	},
	statusPillBtn: {
		cursor: "pointer",
		border: "none",
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		justifyContent: "center",
	},
	statusPillIcon: {
		fontSize: 16,
	},
	statusCountGreen: {
		width: 22,
		height: 22,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: theme.palette.success.main,
		border: "none",
		color: theme.palette.success.contrastText,
		fontWeight: 700,
		fontSize: "0.72rem",
	},
	statusCountPink: {
		width: 22,
		height: 22,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: theme.palette.secondary.main,
		border: "none",
		color: theme.palette.getContrastText(theme.palette.secondary.main),
		fontWeight: 700,
		fontSize: "0.72rem",
	},
	statusPillGreen: {
		backgroundColor: theme.palette.background.paper,
		border: `1px solid ${theme.palette.divider}`,
		color: theme.palette.text.secondary,
		borderRadius: theme.shape.borderRadius,
	},
	statusPillGreenActive: {
		borderColor: theme.palette.success.main,
		boxShadow: `inset 0 -2px 0 ${theme.palette.success.main}`,
	},
	statusPillPink: {
		backgroundColor: theme.palette.background.paper,
		border: `1px solid ${theme.palette.divider}`,
		color: theme.palette.text.secondary,
		borderRadius: theme.shape.borderRadius,
	},
	statusPillPinkActive: {
		borderColor: theme.palette.secondary.main,
		boxShadow: `inset 0 -2px 0 ${theme.palette.secondary.main}`,
	},
	statusPillText: {
		color: theme.palette.text.secondary,
	},
	statusPillTextActive: {
		color: theme.palette.text.primary,
	},
	statusIconGreen: {
		fontSize: 16,
		color: theme.palette.success.main,
	},
	statusIconPink: {
		fontSize: 16,
		color: theme.palette.secondary.main,
	},
	searchRow: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1),
		padding: theme.spacing(1, 1.5),
		borderBottom: `1px solid ${theme.palette.divider}`,
		backgroundColor:
			theme.palette.type === "dark" ? theme.palette.background.default : theme.palette.grey[100],
		[theme.breakpoints.down("xs")]: {
			padding: theme.spacing(1),
		},
	},
	searchInputWrap: {
		flex: 1,
		minWidth: 0,
		display: "flex",
		alignItems: "center",
		border: `1px solid ${theme.palette.divider}`,
		borderRadius: theme.shape.borderRadius,
		padding: theme.spacing(0.75, 1.25),
		backgroundColor: theme.palette.background.paper,
	},
	searchButton: {
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.primary.contrastText,
		marginLeft: theme.spacing(1),
		borderRadius: theme.shape.borderRadius,
		width: 36,
		height: 36,
		padding: 0,
		"&:hover": {
			backgroundColor: theme.palette.primary.dark,
		},
	},
	compactToggle: {
		border: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.palette.background.paper,
		width: 36,
		height: 36,
		padding: 0,
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
		backgroundColor: theme.palette.success.main,
		color: theme.palette.success.contrastText,
		boxShadow: theme.shadows[4],
		animation: "$fabPulse 2s ease-in-out infinite",
		"&:hover": {
			backgroundColor: theme.palette.success.dark,
		},
	},
	"@keyframes fabPulse": {
		"0%, 100%": { boxShadow: theme.shadows[4] },
		"50%": { boxShadow: theme.shadows[8] },
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
  const location = useLocation();

  const [searchParam, setSearchParam] = useState("");
  /** Texto exibido no campo (debounce só atualiza `searchParam` para a API) */
  const [searchInputDraft, setSearchInputDraft] = useState("");
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
  const searchDebounceRef = useRef(null);
  const [compactList, setCompactList] = useState(() => localStorage.getItem("ticketsListCompact") === "1");
  const { user } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const { profile } = user;

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [chatbotCount, setChatbotCount] = useState(0);

  const userQueueIds = Array.isArray(user?.queues) ? user.queues.map((q) => q.id) : [];
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("ticketsListCompact", compactList ? "1" : "0");
  }, [compactList]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("inboxTab") !== "groups") return;
    setTab("groups");
    params.delete("inboxTab");
    const qs = params.toString();
    history.replace(`${location.pathname}${qs ? `?${qs}` : ""}`);
  }, [location.search, location.pathname, history]);

  useTicketsKeyboardShortcuts({ searchInputRef, setTab });

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search") {
      const el = searchInputRef.current;
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    }
  }, [tab]);

  const handleSearch = (e) => {
    const raw = e.target.value;
    const searchedTerm = raw.toLowerCase();
    setSearchInputDraft(raw);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchedTerm === "") {
      setSearchParam("");
      setTab("open");
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 350);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = (Array.isArray(selecteds) ? selecteds : []).map((t) => t?.id).filter(Boolean);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = (Array.isArray(selecteds) ? selecteds : []).map((t) => t?.id).filter(Boolean);
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
    <Paper elevation={0} variant="outlined" className={classes.ticketsRoot}>
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
                    {(Array.isArray(whatsApps) ? whatsApps : []).map((w) => (
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
        <AppTabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            value={"open"}
            classes={{ root: classes.tab }}
            label={
              <span className={classes.tabLabel}>
                <FolderOpenIcon className={classes.tabMenuIcon} />
                ABERTAS
              </span>
            }
          />
          <Tab
            value={"closed"}
            classes={{ root: classes.tab }}
            label={
              <span className={classes.tabLabel}>
                <CheckCircleIcon className={classes.tabMenuIcon} />
                RESOLVIDOS
              </span>
            }
          />
          <Tab
            value={"groups"}
            classes={{ root: classes.tab, label: classes.tabLabel }}
            label={
              <span className={classes.tabLabel}>
                <GroupIcon className={classes.tabMenuIcon} />
                GRUPOS
              </span>
            }
          />
          <Tab
            value={"search"}
            classes={{ root: classes.tab, label: classes.tabLabel }}
            label={
              <span className={classes.tabLabel}>
                <FilterListIcon className={classes.tabMenuIcon} />
                FILTROS
              </span>
            }
          />
        </AppTabs>
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
            <FolderOpenIcon className={clsx(classes.statusPillIcon, classes.statusIconGreen)} />
            <span
              className={
                tabOpen === "open" ? classes.statusPillTextActive : classes.statusPillText
              }
            >
              ATENDENDO
            </span>
          </ButtonBase>

          <ButtonBase
            className={`${classes.statusPill} ${classes.statusPillBtn} ${classes.statusPillPink} ${
              tabOpen === "pending" ? classes.statusPillPinkActive : ""
            }`}
            onClick={() => setTabOpen("pending")}
          >
            <span className={classes.statusCountPink}>{pendingCount}</span>
            <PersonIcon className={clsx(classes.statusPillIcon, classes.statusIconPink)} />
            <span
              className={
                tabOpen === "pending" ? classes.statusPillTextActive : classes.statusPillText
              }
            >
              AGUARDANDO
            </span>
          </ButtonBase>

          <ButtonBase
            className={`${classes.statusPill} ${classes.statusPillBtn} ${classes.statusPillGreen} ${
              tabOpen === "chatbot" ? classes.statusPillGreenActive : ""
            }`}
            onClick={() => setTabOpen("chatbot")}
          >
            <span className={classes.statusCountGreen}>{chatbotCount}</span>
            <AndroidIcon className={clsx(classes.statusPillIcon, classes.statusIconGreen)} />
            <span
              className={
                tabOpen === "chatbot" ? classes.statusPillTextActive : classes.statusPillText
              }
            >
              CHATBOT
            </span>
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
            value={searchInputDraft}
            onChange={(e) => {
              if (e.target.value.trim()) setTab("search");
              handleSearch(e);
            }}
            onFocus={() => tab !== "search" && setTab("search")}
            fullWidth
            style={{ marginLeft: 4 }}
            inputProps={{
              "aria-label": i18n.t("ticketsList.searchInputAria"),
              title: i18n.t("ticketsList.keyboardShortcutsHint"),
            }}
          />
        </div>
        <Tooltip title={i18n.t("ticketsList.keyboardShortcutsHint")}>
          <IconButton
            className={classes.searchButton}
            size="small"
            onClick={() => searchInputRef.current?.focus()}
            aria-label={i18n.t("ticketsList.searchInputAria")}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip
          title={
            compactList
              ? i18n.t("ticketsList.compactListOff")
              : i18n.t("ticketsList.compactListOn")
          }
        >
          <IconButton
            className={classes.compactToggle}
            size="small"
            onClick={() => setCompactList((c) => !c)}
            aria-pressed={compactList}
            aria-label={
              compactList
                ? i18n.t("ticketsList.compactListOff")
                : i18n.t("ticketsList.compactListOn")
            }
          >
            <ViewCompactOutlined fontSize="small" color={compactList ? "primary" : "inherit"} />
          </IconButton>
        </Tooltip>
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
          <TicketsList
            status="open"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            socketActive={tabOpen === "open"}
            compact={compactList}
            style={{ display: tabOpen === "open" ? "flex" : "none" }}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            socketActive={tabOpen === "pending"}
            compact={compactList}
            style={{ display: tabOpen === "pending" ? "flex" : "none" }}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            chatbotOnly
            updateCount={(val) => setChatbotCount(val)}
            socketActive={tabOpen === "chatbot"}
            compact={compactList}
            style={{ display: tabOpen === "chatbot" ? "flex" : "none" }}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          compact={compactList}
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
          compact={compactList}
        />
      </TabPanel>

      <TabPanel value={tab} name="groups" className={classes.ticketsWrapper}>
        <Paper className={classes.ticketsWrapper} style={{ position: "relative" }}>
          <TicketsList
            groupsOnly
            showAll
            selectedQueueIds={selectedQueueIds}
            compact={compactList}
            socketActive={tab === "groups"}
          />
        </Paper>
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
