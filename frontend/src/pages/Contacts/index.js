import React, { useState, useEffect, useReducer, useContext, useMemo, useCallback, useRef } from "react";

import { useHistory } from "react-router-dom";
import { Tooltip } from "@material-ui/core";
import { alpha, makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TablePagination from "@material-ui/core/TablePagination";
import Checkbox from "@material-ui/core/Checkbox";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import ScheduleIcon from "@material-ui/icons/Schedule";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

import api from "../../services/api";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";
import {
	AppPageHeader,
	AppSectionCard,
	AppPrimaryButton,
	AppSecondaryButton,
	AppTableContainer,
	AppDangerAction,
	AppEmptyState,
	AppLoadingState,
	AppTableRowSkeleton,
	AppDialog,
	AppDialogTitle,
	AppDialogContent,
	AppDialogActions,
	MobileActionsMenu,
	MobileEntityCard,
	MobileCardList,
} from "../../ui";
import toastError from "../../errors/toastError";
import { showSuccessToast, showWarningToast } from "../../errors/feedbackToasts";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import { SocketContext } from "../../context/Socket/SocketContext";
import ContactLabelChip from "../../components/ContactLabelChip";
import ContactAssigneesChips from "../../components/ContactAssigneesChips";
import ContactAssignmentsModal from "../../components/ContactAssignmentsModal";
import { canManageContactAssignments } from "../../utils/canManageContactAssignments";
import PeopleIcon from "@material-ui/icons/People";
import FilterListIcon from "@material-ui/icons/FilterList";
import GroupIcon from "@material-ui/icons/Group";
import Badge from "@material-ui/core/Badge";
import CircularProgress from "@material-ui/core/CircularProgress";
import { Pagination } from "@material-ui/lab";

import { CSVLink } from "react-csv";
import useIsMobile from "../../hooks/useIsMobile";
import ImportContactsModal from "../../components/ImportContactsModal";
import ScheduleModal from "../../components/ScheduleModal";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const PAGE_SIZE_STORAGE_KEY = "contacts.pageSize";
const DEFAULT_PAGE_SIZE = 25;

function readStoredPageSize() {
	try {
		const n = parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY), 10);
		if (PAGE_SIZE_OPTIONS.includes(n)) return n;
	} catch {
		/* ignore */
	}
	return DEFAULT_PAGE_SIZE;
}

const reducer = (state, action) => {
	if (action.type === "SET_CONTACTS") {
		return action.payload;
	}

	if (action.type === "LOAD_CONTACTS") {
		const contacts = action.payload;
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
		}
		return state;
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
	pageRoot: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(2),
		minHeight: 0,
		flex: 1,
		[theme.breakpoints.up("md")]: {
			gap: theme.spacing(3),
		},
	},
	alertsBox: {
		"& .MuiAlert-message": {
			width: "100%",
		},
	},
	pageContextAlert: {
		width: "100%",
	},
	pageContextAlertBody: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1),
	},
	filterStack: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(2),
	},
	filtersSectionTitle: {
		fontWeight: 600,
		fontSize: "1rem",
		color: theme.palette.text.primary,
		marginBottom: theme.spacing(0.5),
	},
	filterHintsRow: {
		marginTop: theme.spacing(-0.5),
	},
	filterHint: {
		display: "block",
		lineHeight: 1.4,
		color: theme.palette.text.secondary,
	},
	tableCard: {
		flex: 1,
		minHeight: 0,
	},
	tableHeadCell: {
		fontWeight: 600,
		fontSize: "0.8125rem",
		backgroundColor:
			theme.palette.type === "light"
				? "rgba(0,0,0,0.02)"
				: "rgba(255,255,255,0.04)",
		borderBottom: `1px solid ${theme.palette.divider}`,
		paddingTop: theme.spacing(1.5),
		paddingBottom: theme.spacing(1.5),
	},
	dataRow: {
		"&:hover": {
			backgroundColor: alpha(theme.palette.primary.main, 0.045),
		},
		cursor: "default",
		"& td": {
			paddingTop: theme.spacing(1.75),
			paddingBottom: theme.spacing(1.75),
		},
	},
	contactCell: {
		cursor: "pointer",
		minWidth: 0,
		maxWidth: 320,
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-start",
		gap: theme.spacing(0.25),
	},
	contactName: {
		fontWeight: 600,
		lineHeight: 1.3,
		width: "100%",
	},
	contactLine2: {
		fontSize: "0.8125rem",
		lineHeight: 1.35,
		width: "100%",
	},
	contactEmail: {
		opacity: 0.9,
		maxWidth: "100%",
	},
	chipWrap: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		maxWidth: 220,
	},
	tagChip: {
		maxWidth: 140,
		border: `1px solid ${theme.palette.divider}`,
		"& .MuiChip-label": {
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
	},
	tagChipNeutral: {
		backgroundColor: theme.palette.grey[200],
	},
	avatarCell: {
		paddingRight: theme.spacing(1),
		width: 56,
		verticalAlign: "middle",
	},
	lastInteractionBox: {
		display: "inline-flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(0.25),
		maxWidth: 200,
		margin: "0 auto",
		padding: theme.spacing(0.75, 1),
		borderRadius: theme.shape.borderRadius,
		border: `1px solid ${theme.palette.divider}`,
	},
	lastInteractionFresh: {
		borderColor: theme.palette.success.main,
		backgroundColor: alpha(theme.palette.success.main, 0.08),
		"& $interactionIcon": {
			color: theme.palette.success.main,
		},
		"& $interactionPrimary": {
			color: theme.palette.success.dark,
			fontWeight: 600,
		},
	},
	lastInteractionWeek: {
		borderColor: theme.palette.warning.main,
		backgroundColor: alpha(theme.palette.warning.main, 0.08),
		"& $interactionIcon": {
			color: theme.palette.warning.main,
		},
		"& $interactionPrimary": {
			color: theme.palette.warning.dark,
			fontWeight: 600,
		},
	},
	lastInteractionStale: {
		backgroundColor: theme.palette.action.selected,
		"& $interactionIcon": {
			color: theme.palette.action.active,
		},
		"& $interactionPrimary": {
			fontWeight: 600,
		},
	},
	lastInteractionRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(0.5),
	},
	interactionIcon: {},
	interactionPrimary: {},
	actionButtons: {
		display: "inline-flex",
		flexWrap: "nowrap",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(0.25),
		maxWidth: 300,
	},
	actionIconBtn: {
		padding: theme.spacing(0.75),
		color: theme.palette.text.secondary,
		"&:hover": {
			backgroundColor: alpha(theme.palette.primary.main, 0.1),
			color: theme.palette.primary.main,
		},
	},
	searchField: {
		"& .MuiSvgIcon-root": {
			color: "inherit",
		},
	},
	csvLink: {
		textDecoration: "none",
		display: "inline-flex",
	},
	mobileSearchRow: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1.5),
		width: "100%",
	},
	mobileFilterActions: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		flexWrap: "wrap",
	},
	mobileLoadMore: {
		display: "flex",
		justifyContent: "center",
		padding: theme.spacing(2, 0, 1),
	},
	mobileCardChips: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		maxWidth: "100%",
	},
	bulkBar: {
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		gap: theme.spacing(1),
		padding: theme.spacing(1.5),
		marginBottom: theme.spacing(1),
		borderRadius: theme.shape.borderRadius,
		backgroundColor:
			theme.palette.type === "dark"
				? "rgba(144, 202, 249, 0.12)"
				: theme.palette.primary.light,
		border: `1px solid ${theme.palette.divider}`,
	},
	paginationBar: {
		display: "flex",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing(1),
		paddingTop: theme.spacing(1),
		borderTop: `1px solid ${theme.palette.divider}`,
		marginTop: theme.spacing(1),
	},
	paginationPages: {
		display: "flex",
		alignItems: "center",
	},
	mobilePagination: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(1),
		padding: theme.spacing(2, 0, 1),
	},
}));

const Contacts = () => {
	const classes = useStyles();
	const history = useHistory();
	const isMobile = useIsMobile();

	const { user } = useContext(AuthContext);

	const [loading, setLoading] = useState(false);
	const [loadError, setLoadError] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(readStoredPageSize);
	const [totalCount, setTotalCount] = useState(0);
	const [totalPages, setTotalPages] = useState(0);
	const [searchParam, setSearchParam] = useState("");
	const [searchDebounced, setSearchDebounced] = useState("");
	const [tagFilter, setTagFilter] = useState("");
	const [labelFilter, setLabelFilter] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [contacts, dispatch] = useReducer(reducer, []);
	const [selectedMap, setSelectedMap] = useState({});
	const [selectedContactId, setSelectedContactId] = useState(null);
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
	const [contactTicket, setContactTicket] = useState({});
	const [deletingContact, setDeletingContact] = useState(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
	const [bulkDeleting, setBulkDeleting] = useState(false);
	const [openModalImport, setOpenModalImport] = useState(false);
	const [tagOptions, setTagOptions] = useState([]);
	const [labelOptions, setLabelOptions] = useState([]);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [scheduleContactId, setScheduleContactId] = useState(null);
	const [chatbotToggleLoadingId, setChatbotToggleLoadingId] = useState(null);
	const [assignmentsModalOpen, setAssignmentsModalOpen] = useState(false);
	const [assignmentsContact, setAssignmentsContact] = useState(null);
	const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);

	const socketManager = useContext(SocketContext);
	const canManageAssignments = canManageContactAssignments(user);
	const fetchAbortRef = useRef(null);

	useEffect(() => {
		const t = setTimeout(() => setSearchDebounced(searchParam.trim()), 300);
		return () => clearTimeout(t);
	}, [searchParam]);

	useEffect(() => {
		api
			.get("/tags/list")
			.then(({ data }) =>
				setTagOptions(Array.isArray(data) ? data : [])
			)
			.catch(() => {});
		api
			.get("/contact-labels")
			.then(({ data }) =>
				setLabelOptions(Array.isArray(data) ? data : [])
			)
			.catch(() => {});
	}, []);

	useEffect(() => {
		setPage(1);
		setSelectedMap({});
	}, [searchDebounced, tagFilter, labelFilter, dateFrom, dateTo]);

	useEffect(() => {
		setPage(1);
	}, [pageSize]);

	const fetchContacts = useCallback(async () => {
		if (fetchAbortRef.current) {
			fetchAbortRef.current.abort();
		}
		const controller = new AbortController();
		fetchAbortRef.current = controller;

		setLoading(true);
		setLoadError(false);
		try {
			const params = {
				searchParam: searchDebounced,
				pageNumber: page,
				limit: pageSize,
			};
			if (tagFilter) params.tagId = tagFilter;
			if (labelFilter) params.labelId = labelFilter;
			if (dateFrom) params.dateFrom = dateFrom;
			if (dateTo) params.dateTo = dateTo;

			const { data } = await api.get("/contacts/", {
				params,
				signal: controller.signal,
			});

			if (controller.signal.aborted) return;

			dispatch({
				type: "SET_CONTACTS",
				payload: Array.isArray(data.contacts) ? data.contacts : [],
			});
			setTotalCount(Number(data.count) || 0);
			setTotalPages(Number(data.totalPages) || 0);
		} catch (err) {
			if (controller.signal.aborted) return;
			toastError(err);
			setLoadError(true);
			dispatch({ type: "SET_CONTACTS", payload: [] });
			setTotalCount(0);
			setTotalPages(0);
		} finally {
			if (!controller.signal.aborted) {
				setLoading(false);
			}
		}
	}, [searchDebounced, page, pageSize, tagFilter, labelFilter, dateFrom, dateTo]);

	useEffect(() => {
		fetchContacts();
		return () => {
			if (fetchAbortRef.current) {
				fetchAbortRef.current.abort();
			}
		};
	}, [fetchContacts]);

	useEffect(() => {
		const companyId = localStorage.getItem("companyId");
		const socket = socketManager.getSocket(companyId);

		const handler = (data) => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
			}

			if (data.action === "delete") {
				dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
				setTotalCount((prev) => Math.max(0, prev - 1));
				setSelectedMap((prev) => {
					if (!prev[data.contactId]) return prev;
					const next = { ...prev };
					delete next[data.contactId];
					return next;
				});
			}
		};

		socket.on(`company-${companyId}-contact`, handler);

		return () => {
			socket.off(`company-${companyId}-contact`, handler);
		};
	}, [socketManager]);

	const handleSearch = (event) => {
		setSearchParam(event.target.value);
	};

	const handleOpenContactModal = () => {
		setSelectedContactId(null);
		setContactModalOpen(true);
	};

	const handleCloseContactModal = () => {
		setSelectedContactId(null);
		setContactModalOpen(false);
	};

	const handleCloseOrOpenTicket = (ticket) => {
		setNewTicketModalOpen(false);
		if (ticket !== undefined && ticket.uuid !== undefined) {
			history.push(`/tickets/${ticket.uuid}`);
		}
	};

	const handleEditContact = (contactId) => {
		setSelectedContactId(contactId);
		setContactModalOpen(true);
	};

	const handleDeleteContact = async (contactId) => {
		try {
			await api.delete(`/contacts/${contactId}`);
			showSuccessToast("contacts.toasts.deleted");
			setSelectedMap((prev) => {
				if (!prev[contactId]) return prev;
				const next = { ...prev };
				delete next[contactId];
				return next;
			});
			if (contacts.length <= 1 && page > 1) {
				setPage((prev) => prev - 1);
			} else {
				await fetchContacts();
			}
		} catch (err) {
			toastError(err);
		}
		setDeletingContact(null);
		setConfirmOpen(false);
	};

	const handleBulkDeleteContacts = async () => {
		const contactIds = Object.keys(selectedMap).map((id) => Number(id));
		if (!contactIds.length) return;

		setBulkDeleting(true);
		try {
			const { data } = await api.post("/contacts/bulk-delete", { contactIds });
			const deleted = Number(data?.deletedCount) || 0;
			const blocked = Number(data?.blockedCount) || 0;
			const failed = Number(data?.failedCount) || 0;

			if (deleted > 0) {
				showSuccessToast("contacts.bulk.deleteSuccess", { count: deleted });
			}
			if (blocked > 0) {
				showWarningToast("contacts.bulk.deleteBlocked", { count: blocked });
			}
			if (failed > 0 && deleted === 0 && blocked === 0) {
				showWarningToast("contacts.bulk.deleteFailed");
			}

			setSelectedMap({});
			setBulkDeleteOpen(false);

			const remainingOnPage = contacts.length - deleted;
			if (remainingOnPage <= 0 && page > 1) {
				setPage((prev) => prev - 1);
			} else {
				await fetchContacts();
			}
		} catch (err) {
			toastError(err);
		} finally {
			setBulkDeleting(false);
		}
	};

	const handleimportContact = async () => {
		try {
			await api.post("/contacts/import");
			history.go(0);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenImportModal = () => {
		setOpenModalImport(true);
	};

	const handlePageSizeChange = (event) => {
		const next = parseInt(event.target.value, 10);
		if (!PAGE_SIZE_OPTIONS.includes(next)) return;
		setPageSize(next);
		try {
			localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
		} catch {
			/* ignore */
		}
	};

	const handleTablePageChange = (_, newPage) => {
		setPage(newPage + 1);
	};

	const handleNumberedPageChange = (_, value) => {
		setPage(value);
	};

	const selectedCount = useMemo(
		() => Object.keys(selectedMap).length,
		[selectedMap]
	);

	const allPageSelected =
		contacts.length > 0 && contacts.every((contact) => Boolean(selectedMap[contact.id]));
	const somePageSelected =
		contacts.some((contact) => Boolean(selectedMap[contact.id])) && !allPageSelected;

	const toggleRowSelection = (contactId) => {
		setSelectedMap((prev) => {
			const next = { ...prev };
			if (next[contactId]) delete next[contactId];
			else next[contactId] = true;
			return next;
		});
	};

	const handleSelectAllPage = () => {
		if (allPageSelected) {
			setSelectedMap((prev) => {
				const next = { ...prev };
				contacts.forEach((contact) => {
					delete next[contact.id];
				});
				return next;
			});
			return;
		}
		setSelectedMap((prev) => {
			const next = { ...prev };
			contacts.forEach((contact) => {
				next[contact.id] = true;
			});
			return next;
		});
	};

	const rangeLabel = useMemo(() => {
		if (totalCount <= 0 || !contacts.length) {
			return i18n.t("contacts.pagination.empty");
		}
		const from = (page - 1) * pageSize + 1;
		const to = (page - 1) * pageSize + contacts.length;
		return i18n.t("contacts.pagination.range", { from, to, count: totalCount });
	}, [contacts.length, page, pageSize, totalCount]);

	const hasActiveFilters = useMemo(() => {
		return Boolean(
			searchDebounced || tagFilter || labelFilter || dateFrom || dateTo
		);
	}, [searchDebounced, tagFilter, labelFilter, dateFrom, dateTo]);

	const handleCloseModalImport = () => {
		setOpenModalImport(false);
	};

	const handleOpenScheduleModal = (contactId) => {
		setScheduleContactId(contactId);
		setScheduleModalOpen(true);
	};

	const handleToggleChatbotForContact = async (contact) => {
		if (!contact?.id) return;
		setChatbotToggleLoadingId(contact.id);
		try {
			const next = !Boolean(contact.chatbotDisabled);
			const { data } = await api.put(`/contacts/${contact.id}/chatbot`, {
				chatbotDisabled: next,
			});
			dispatch({ type: "UPDATE_CONTACTS", payload: data });
			showSuccessToast(
				next
					? "contacts.toasts.chatbotDisabled"
					: "contacts.toasts.chatbotEnabled"
			);
		} catch (err) {
			toastError(err);
		} finally {
			setChatbotToggleLoadingId(null);
		}
	};

	const handleCloseScheduleModal = () => {
		setScheduleModalOpen(false);
		setScheduleContactId(null);
	};

	const handleCleanScheduleContact = () => {
		setScheduleContactId(null);
	};

	const formatLastInteraction = (iso) => {
		if (!iso) return "—";
		try {
			return formatDistanceToNow(new Date(iso), {
				addSuffix: true,
				locale: ptBR,
			});
		} catch {
			return "—";
		}
	};

	const lastInteractionToneClass = (iso) => {
		if (!iso) return null;
		const diff = Date.now() - new Date(iso).getTime();
		const day = 86400000;
		if (diff < day) return classes.lastInteractionFresh;
		if (diff < 7 * day) return classes.lastInteractionWeek;
		return classes.lastInteractionStale;
	};

	const renderLastInteraction = (iso) => {
		if (!iso) {
			return (
				<Typography variant="body2" color="textSecondary">
					—
				</Typography>
			);
		}
		const toneClass = lastInteractionToneClass(iso);
		let absolute = "";
		try {
			absolute = format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
		} catch {
			absolute = "";
		}
		return (
			<Box
				className={`${classes.lastInteractionBox} ${toneClass || ""}`}
			>
				<Tooltip
					title={
						absolute
							? `${i18n.t("contacts.lastInteractionTooltip")}: ${absolute}`
							: ""
					}
				>
					<Box className={classes.lastInteractionRow}>
						<AccessTimeIcon className={classes.interactionIcon} fontSize="small" />
						<Typography
							variant="body2"
							component="span"
							className={classes.interactionPrimary}
						>
							{formatLastInteraction(iso)}
						</Typography>
					</Box>
				</Tooltip>
				{absolute ? (
					<Typography
						variant="caption"
						color="textSecondary"
						style={{ lineHeight: 1.2 }}
					>
						{absolute}
					</Typography>
				) : null}
			</Box>
		);
	};

	const createdTooltipTitle = (createdAt) => {
		if (!createdAt) return "";
		try {
			return format(new Date(createdAt), "PPpp", { locale: ptBR });
		} catch {
			return "";
		}
	};

	const activeFiltersCount = useMemo(() => {
		let count = 0;
		if (tagFilter) count += 1;
		if (labelFilter) count += 1;
		if (dateFrom) count += 1;
		if (dateTo) count += 1;
		return count;
	}, [tagFilter, labelFilter, dateFrom, dateTo]);

	const clearAdvancedFilters = () => {
		setTagFilter("");
		setLabelFilter("");
		setDateFrom("");
		setDateTo("");
	};

	const renderAdvancedFilterItems = () => (
		<>
			<Grid item xs={12} sm={6} md={2}>
				<FormControl variant="outlined" size="small" fullWidth>
					<InputLabel id="contacts-tag-filter">
						{i18n.t("contacts.filters.tag")}
					</InputLabel>
					<Select
						labelId="contacts-tag-filter"
						value={tagFilter}
						onChange={(e) => setTagFilter(e.target.value)}
						label={i18n.t("contacts.filters.tag")}
					>
						<MenuItem value="">
							<em>{i18n.t("contacts.filters.allTags")}</em>
						</MenuItem>
						{tagOptions.map((t) => (
							<MenuItem key={t.id} value={String(t.id)}>
								{t.name}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Grid>
			<Grid item xs={12} sm={6} md={2}>
				<FormControl variant="outlined" size="small" fullWidth>
					<InputLabel id="contacts-label-filter">
						{i18n.t("contacts.filters.label")}
					</InputLabel>
					<Select
						labelId="contacts-label-filter"
						value={labelFilter}
						onChange={(e) => setLabelFilter(e.target.value)}
						label={i18n.t("contacts.filters.label")}
					>
						<MenuItem value="">
							<em>{i18n.t("contacts.filters.allLabels")}</em>
						</MenuItem>
						{labelOptions.map((l) => (
							<MenuItem key={l.id} value={String(l.id)}>
								{l.name}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Grid>
			<Grid item xs={12} sm={6} md={2}>
				<TextField
					fullWidth
					label={i18n.t("contacts.filters.dateFrom")}
					type="date"
					variant="outlined"
					size="small"
					InputLabelProps={{ shrink: true }}
					value={dateFrom}
					onChange={(e) => setDateFrom(e.target.value)}
				/>
			</Grid>
			<Grid item xs={12} sm={6} md={2}>
				<TextField
					fullWidth
					label={i18n.t("contacts.filters.dateTo")}
					type="date"
					variant="outlined"
					size="small"
					InputLabelProps={{ shrink: true }}
					value={dateTo}
					onChange={(e) => setDateTo(e.target.value)}
				/>
			</Grid>
		</>
	);

	const buildContactActionItems = (contact) => {
		const items = [
			{
				key: "attendance",
				label: i18n.t("contacts.openAttendance"),
				icon: <WhatsAppIcon fontSize="small" />,
				onClick: () => {
					setContactTicket(contact);
					setNewTicketModalOpen(true);
				},
			},
			{
				key: "schedule",
				label: i18n.t("contacts.scheduleMessage"),
				icon: <ScheduleIcon fontSize="small" />,
				onClick: () => handleOpenScheduleModal(contact.id),
			},
			{
				key: "chatbot",
				label: contact.chatbotDisabled
					? i18n.t("contacts.chatbotDisabled")
					: i18n.t("contacts.chatbotEnabled"),
				icon: contact.chatbotDisabled ? (
					<SmartToyOutlinedIcon fontSize="small" />
				) : (
					<SmartToyIcon fontSize="small" />
				),
				disabled: chatbotToggleLoadingId === contact.id,
				onClick: () => handleToggleChatbotForContact(contact),
			},
			{
				key: "edit",
				label: i18n.t("contacts.buttons.edit"),
				icon: <EditIcon fontSize="small" />,
				onClick: () => handleEditContact(contact.id),
			},
		];

		if (canManageAssignments) {
			items.push({
				key: "assignments",
				label: i18n.t("contacts.assignments.manage"),
				icon: <PeopleIcon fontSize="small" />,
				onClick: () => {
					setAssignmentsContact(contact);
					setAssignmentsModalOpen(true);
				},
			});
		}

		if (user?.profile === "admin") {
			items.push({ key: "delete-divider", divider: true });
			items.push({
				key: "delete",
				label: i18n.t("contacts.buttons.deleteRow"),
				icon: <DeleteOutlineIcon fontSize="small" />,
				danger: true,
				onClick: () => {
					setConfirmOpen(true);
					setDeletingContact(contact);
				},
			});
		}

		return items;
	};

	const renderContactMobileCard = (contact) => (
		<MobileEntityCard
			key={contact.id}
			leading={<Avatar src={contact.profilePicUrl} />}
			title={contact.name}
			subtitle={contact.number || "—"}
			badges={
				<MobileActionsMenu
					items={buildContactActionItems(contact)}
					ariaLabel={i18n.t("contacts.mobile.actions")}
				/>
			}
			onClick={() => handleEditContact(contact.id)}
		>
			{contact.email ? (
				<Typography variant="caption" color="textSecondary" display="block" noWrap>
					{contact.email}
				</Typography>
			) : null}
			<Box className={classes.mobileCardChips}>
				{contact.isGroup ? (
					<Chip
						size="small"
						icon={<GroupIcon />}
						label={i18n.t("contacts.mobile.groupBadge")}
						color="primary"
						variant="outlined"
					/>
				) : null}
				{(contact.tags || []).slice(0, 4).map((tag) => (
					<Chip
						key={tag.id}
						label={tag.name}
						size="small"
						className={`${classes.tagChip} ${
							!tag.color ? classes.tagChipNeutral : ""
						}`}
						style={tag.color ? { backgroundColor: tag.color } : undefined}
					/>
				))}
				{(contact.labels || []).slice(0, 3).map((label) => (
					<ContactLabelChip key={label.id} label={label} />
				))}
			</Box>
			<ContactAssigneesChips assignments={contact.assignments} />
			{renderLastInteraction(contact.lastInteractionAt)}
		</MobileEntityCard>
	);

	return (
		<MainContainer className={classes.pageRoot}>
			<ImportContactsModal
				open={openModalImport}
				onClose={handleCloseModalImport}
			/>
			<NewTicketModal
				modalOpen={newTicketModalOpen}
				initialContact={contactTicket}
				onClose={(ticket) => {
					handleCloseOrOpenTicket(ticket);
				}}
			/>
			<ContactModal
				open={contactModalOpen}
				onClose={handleCloseContactModal}
				aria-labelledby="form-dialog-title"
				contactId={selectedContactId}
				onSave={(created) => {
					if (created?.id) {
						dispatch({ type: "UPDATE_CONTACTS", payload: created });
					}
				}}
				onContactSaved={(updated) => {
					dispatch({ type: "UPDATE_CONTACTS", payload: updated });
				}}
				onOpenAttendance={(c) => {
					setContactTicket(c);
					setNewTicketModalOpen(true);
					setContactModalOpen(false);
				}}
			/>
			<ScheduleModal
				open={scheduleModalOpen}
				onClose={handleCloseScheduleModal}
				contactId={scheduleContactId}
				cleanContact={handleCleanScheduleContact}
				redirectToSchedulesAfterContactSave={false}
			/>
			<ContactAssignmentsModal
				open={assignmentsModalOpen}
				onClose={() => {
					setAssignmentsModalOpen(false);
					setAssignmentsContact(null);
				}}
				contactId={assignmentsContact?.id}
				contactName={assignmentsContact?.name}
				onSaved={(assignments) => {
					if (assignmentsContact?.id) {
						dispatch({
							type: "UPDATE_CONTACTS",
							payload: {
								...assignmentsContact,
								assignments,
							},
						});
					}
				}}
			/>
			<ConfirmationModal
				title={
					deletingContact
						? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${
								deletingContact.name
						  }?`
						: `${i18n.t("contacts.confirmationModal.importTitle")}`
				}
				open={confirmOpen}
				onClose={setConfirmOpen}
				destructive={Boolean(deletingContact)}
				onConfirm={(e) =>
					deletingContact
						? handleDeleteContact(deletingContact.id)
						: handleimportContact()
				}
			>
				{deletingContact
					? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
					: `${i18n.t("contacts.confirmationModal.importMessage")}`}
			</ConfirmationModal>

			<ConfirmationModal
				title={i18n.t("contacts.bulk.deleteSelected")}
				open={bulkDeleteOpen}
				onClose={() => setBulkDeleteOpen(false)}
				destructive
				loading={bulkDeleting}
				asyncConfirm
				onConfirm={handleBulkDeleteContacts}
			>
				{i18n.t("contacts.bulk.deleteConfirm", { count: selectedCount })}
			</ConfirmationModal>

			<AppPageHeader
				title={
					<Typography variant="h5" color="primary" component="h1">
						{i18n.t("contacts.title")}
					</Typography>
				}
				subtitle={
					<Typography variant="body2" color="textSecondary" component="p">
						{i18n.t("contacts.subtitle")}
					</Typography>
				}
				actions={
					<>
						<AppSecondaryButton onClick={handleOpenImportModal}>
							{i18n.t("contacts.buttons.import")}
						</AppSecondaryButton>
						<CSVLink
							className={classes.csvLink}
							separator=";"
							filename={"contatos.csv"}
							data={contacts.map((contact) => ({
								name: contact.name,
								number: contact.number,
								email: contact.email,
							}))}
						>
							<AppSecondaryButton component="span">
								{i18n.t("contacts.buttons.export")}
							</AppSecondaryButton>
						</CSVLink>
						<AppPrimaryButton onClick={handleOpenContactModal}>
							{i18n.t("contacts.buttons.add")}
						</AppPrimaryButton>
					</>
				}
			/>

			<Box className={classes.alertsBox}>
				<Alert
					severity="info"
					variant="outlined"
					className={classes.pageContextAlert}
				>
					<Box className={classes.pageContextAlertBody}>
						<Typography variant="body2" component="p">
							{i18n.t("contacts.pageBanner")}
						</Typography>
						<Typography variant="body2" color="textSecondary" component="p">
							{i18n.t("contacts.pageExpectations")}
						</Typography>
					</Box>
				</Alert>
			</Box>

			<AppDialog
				open={filtersDialogOpen}
				onClose={() => setFiltersDialogOpen(false)}
				maxWidth="sm"
			>
				<AppDialogTitle>{i18n.t("contacts.filters.sectionLabel")}</AppDialogTitle>
				<AppDialogContent>
					<Box className={classes.filterStack}>
						<Grid container spacing={2}>
							{renderAdvancedFilterItems()}
						</Grid>
						<Typography variant="caption" className={classes.filterHint}>
							{i18n.t("contacts.filters.tagHint")}
						</Typography>
						<Typography variant="caption" className={classes.filterHint}>
							{i18n.t("contacts.filters.dateHint")}
						</Typography>
					</Box>
				</AppDialogContent>
				<AppDialogActions>
					{activeFiltersCount > 0 ? (
						<AppSecondaryButton onClick={clearAdvancedFilters}>
							{i18n.t("contacts.mobile.clearFilters")}
						</AppSecondaryButton>
					) : null}
					<AppPrimaryButton onClick={() => setFiltersDialogOpen(false)}>
						{i18n.t("contacts.mobile.applyFilters")}
					</AppPrimaryButton>
				</AppDialogActions>
			</AppDialog>

			<AppSectionCard dense variant="outlined">
				<Box className={classes.filterStack}>
					{!isMobile ? (
						<Typography
							component="h2"
							variant="subtitle1"
							className={classes.filtersSectionTitle}
						>
							{i18n.t("contacts.filters.sectionLabel")}
						</Typography>
					) : null}

					{isMobile ? (
						<Box className={classes.mobileSearchRow}>
							<TextField
								fullWidth
								className={classes.searchField}
								placeholder={i18n.t("contacts.searchPlaceholder")}
								type="search"
								value={searchParam}
								onChange={handleSearch}
								variant="outlined"
								size="small"
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<SearchIcon fontSize="small" color="inherit" />
										</InputAdornment>
									),
								}}
							/>
							<Box className={classes.mobileFilterActions}>
								<Badge
									color="primary"
									variant="dot"
									invisible={activeFiltersCount === 0}
								>
									<AppSecondaryButton
										startIcon={<FilterListIcon />}
										onClick={() => setFiltersDialogOpen(true)}
									>
										{i18n.t("contacts.mobile.filtersButton")}
									</AppSecondaryButton>
								</Badge>
								{activeFiltersCount > 0 ? (
									<Typography variant="caption" color="textSecondary">
										{i18n.t("contacts.mobile.activeFilters", {
											count: activeFiltersCount,
										})}
									</Typography>
								) : null}
							</Box>
							<Typography variant="caption" className={classes.filterHint}>
								{i18n.t("contacts.filters.searchHint")}
							</Typography>
						</Box>
					) : (
						<>
							<Grid container spacing={2} alignItems="center">
								<Grid item xs={12} md={5}>
									<TextField
										fullWidth
										className={classes.searchField}
										placeholder={i18n.t("contacts.searchPlaceholder")}
										type="search"
										value={searchParam}
										onChange={handleSearch}
										variant="outlined"
										size="small"
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<SearchIcon fontSize="small" color="inherit" />
												</InputAdornment>
											),
										}}
									/>
								</Grid>
								{renderAdvancedFilterItems()}
							</Grid>

							<Grid container spacing={2} className={classes.filterHintsRow}>
								<Grid item xs={12} md={5}>
									<Typography variant="caption" className={classes.filterHint}>
										{i18n.t("contacts.filters.searchHint")}
									</Typography>
								</Grid>
								<Grid item xs={12} sm={6} md={3}>
									<Typography variant="caption" className={classes.filterHint}>
										{i18n.t("contacts.filters.tagHint")}
									</Typography>
								</Grid>
								<Grid item xs={12} sm={6} md={4}>
									<Typography variant="caption" className={classes.filterHint}>
										{i18n.t("contacts.filters.dateHint")}
									</Typography>
								</Grid>
							</Grid>
						</>
					)}
				</Box>
			</AppSectionCard>

			<AppSectionCard
				scrollable
				className={classes.tableCard}
				variant="outlined"
			>
				{selectedCount > 0 ? (
					<Box className={classes.bulkBar}>
						<Typography variant="body2" style={{ flex: 1, fontWeight: 600 }}>
							{i18n.t("contacts.bulk.selectedCount", { count: selectedCount })}
						</Typography>
						<Can
							role={user.profile}
							perform="contacts-page:deleteContact"
							yes={() => (
								<Button
									color="secondary"
									variant="contained"
									size="small"
									onClick={() => setBulkDeleteOpen(true)}
									disabled={bulkDeleting}
								>
									{i18n.t("contacts.bulk.deleteSelected")}
								</Button>
							)}
						/>
						<Button size="small" onClick={() => setSelectedMap({})}>
							{i18n.t("contacts.bulk.clearSelection")}
						</Button>
					</Box>
				) : null}

				{loading && contacts.length === 0 ? (
					<AppLoadingState message={i18n.t("contacts.loading")} />
				) : loadError ? (
					<AppEmptyState
						title={i18n.t("contacts.bulk.deleteFailed")}
						description={i18n.t("contacts.retry")}
					>
						<AppPrimaryButton onClick={fetchContacts}>
							{i18n.t("contacts.retry")}
						</AppPrimaryButton>
					</AppEmptyState>
				) : !loading && contacts.length === 0 ? (
					<AppEmptyState
						title={
							hasActiveFilters
								? i18n.t("contacts.empty.filtered")
								: i18n.t("contacts.empty.title")
						}
						description={
							hasActiveFilters ? undefined : i18n.t("contacts.empty.subtitle")
						}
					>
						{!hasActiveFilters ? (
							<AppPrimaryButton onClick={handleOpenContactModal}>
								{i18n.t("contacts.buttons.add")}
							</AppPrimaryButton>
						) : null}
					</AppEmptyState>
				) : isMobile ? (
					<>
						<MobileCardList>
							{contacts.map((contact) => (
								<Box key={contact.id} display="flex" alignItems="flex-start" gridGap={8}>
									<Checkbox
										checked={Boolean(selectedMap[contact.id])}
										onChange={() => toggleRowSelection(contact.id)}
										onClick={(e) => e.stopPropagation()}
										inputProps={{
											"aria-label": contact.name,
										}}
										style={{ marginTop: 8 }}
									/>
									<Box flex={1} minWidth={0}>
										{renderContactMobileCard(contact)}
									</Box>
								</Box>
							))}
						</MobileCardList>
						{loading ? (
							<Box className={classes.mobileLoadMore}>
								<CircularProgress size={28} />
							</Box>
						) : null}
						<Box className={classes.mobilePagination}>
							<Typography variant="caption" color="textSecondary">
								{rangeLabel}
							</Typography>
							{totalPages > 1 ? (
								<Pagination
									color="primary"
									size="small"
									count={totalPages}
									page={page}
									onChange={handleNumberedPageChange}
									disabled={loading}
								/>
							) : null}
						</Box>
					</>
				) : (
					<AppTableContainer nested>
						<Table size="medium">
							<TableHead>
								<TableRow>
									<TableCell padding="checkbox" className={classes.tableHeadCell}>
										<Tooltip title={i18n.t("contacts.table.selectAll")}>
											<Checkbox
												indeterminate={somePageSelected}
												checked={allPageSelected}
												onChange={handleSelectAllPage}
												inputProps={{
													"aria-label": i18n.t("contacts.table.selectAll"),
												}}
											/>
										</Tooltip>
									</TableCell>
									<TableCell className={classes.tableHeadCell}>
										{i18n.t("contacts.table.contact")}
									</TableCell>
									<TableCell className={classes.tableHeadCell}>
										<Tooltip title={i18n.t("contacts.tagsColumnHint")}>
											<span>{i18n.t("contacts.table.tags")}</span>
										</Tooltip>
									</TableCell>
									<TableCell className={classes.tableHeadCell}>
										<Tooltip title={i18n.t("contacts.labelsColumnHint")}>
											<span>{i18n.t("contacts.table.labels")}</span>
										</Tooltip>
									</TableCell>
									<TableCell className={classes.tableHeadCell}>
										{i18n.t("contacts.table.assignees")}
									</TableCell>
									<TableCell align="center" className={classes.tableHeadCell}>
										{i18n.t("contacts.table.lastInteraction")}
									</TableCell>
									<TableCell align="center" className={classes.tableHeadCell}>
										{i18n.t("contacts.table.createdAt")}
									</TableCell>
									<TableCell align="center" className={classes.tableHeadCell}>
										{i18n.t("contacts.table.actions")}
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								<>
									{contacts.map((contact) => (
										<TableRow key={contact.id} hover className={classes.dataRow}>
											<TableCell padding="checkbox">
												<Checkbox
													checked={Boolean(selectedMap[contact.id])}
													onChange={() => toggleRowSelection(contact.id)}
													inputProps={{ "aria-label": contact.name }}
												/>
											</TableCell>
											<TableCell align="left">
												<Box display="flex" alignItems="center" gridGap={8}>
													<Avatar src={contact.profilePicUrl} />
													<Box
														className={classes.contactCell}
														onClick={() => handleEditContact(contact.id)}
													>
													<Tooltip title={contact.name} placement="top-start">
														<Typography
															variant="subtitle1"
															component="div"
															className={classes.contactName}
															noWrap
														>
															{contact.name}
														</Typography>
													</Tooltip>
													<Tooltip
														title={contact.number || ""}
														placement="top-start"
														disableHoverListener={!contact.number}
													>
														<Typography
															variant="body2"
															color="textSecondary"
															className={classes.contactLine2}
															noWrap
														>
															{contact.number || "—"}
														</Typography>
													</Tooltip>
													{contact.email ? (
														<Tooltip title={contact.email} placement="top-start">
															<Typography
																variant="caption"
																color="textSecondary"
																className={classes.contactEmail}
																noWrap
																display="block"
															>
																{contact.email}
															</Typography>
														</Tooltip>
													) : null}
												</Box>
												</Box>
											</TableCell>
											<TableCell>
												<div className={classes.chipWrap}>
													{(contact.tags || []).map((tag) => (
														<Chip
															key={tag.id}
															label={tag.name}
															size="small"
															className={`${classes.tagChip} ${
																!tag.color ? classes.tagChipNeutral : ""
															}`}
															style={
																tag.color
																	? { backgroundColor: tag.color }
																	: undefined
															}
														/>
													))}
												</div>
											</TableCell>
											<TableCell>
												<div className={classes.chipWrap}>
													{(contact.labels || []).map((label) => (
														<ContactLabelChip key={label.id} label={label} />
													))}
												</div>
											</TableCell>
											<TableCell>
												<Box display="flex" alignItems="center" gridGap={4}>
													<ContactAssigneesChips
														assignments={contact.assignments}
													/>
													{canManageAssignments && (
														<Tooltip
															title={i18n.t(
																"contacts.assignments.manage"
															)}
														>
															<IconButton
																size="small"
																className={classes.actionIconBtn}
																onClick={() => {
																	setAssignmentsContact(contact);
																	setAssignmentsModalOpen(true);
																}}
															>
																<PeopleIcon fontSize="small" />
															</IconButton>
														</Tooltip>
													)}
												</Box>
											</TableCell>
											<TableCell align="center">
												{renderLastInteraction(contact.lastInteractionAt)}
											</TableCell>
											<TableCell align="center">
												<Tooltip
													title={createdTooltipTitle(contact.createdAt)}
												>
													<span>
														{contact.createdAt
															? format(
																	new Date(contact.createdAt),
																	"dd/MM/yyyy",
																	{
																		locale: ptBR,
																	}
															  )
															: "—"}
													</span>
												</Tooltip>
											</TableCell>
											<TableCell align="center">
												<Box className={classes.actionButtons}>
													<Tooltip title={i18n.t("contacts.openAttendance")}>
														<IconButton
															size="small"
															color="primary"
															className={classes.actionIconBtn}
															aria-label={i18n.t("contacts.openAttendance")}
															onClick={() => {
																setContactTicket(contact);
																setNewTicketModalOpen(true);
															}}
														>
															<WhatsAppIcon fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip title={i18n.t("contacts.scheduleMessage")}>
														<IconButton
															size="small"
															color="primary"
															className={classes.actionIconBtn}
															aria-label={i18n.t("contacts.scheduleMessage")}
															onClick={() => handleOpenScheduleModal(contact.id)}
														>
															<ScheduleIcon fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip
														title={
															contact.chatbotDisabled
																? i18n.t("contacts.chatbotDisabled")
																: i18n.t("contacts.chatbotEnabled")
														}
													>
														<span>
															<IconButton
																size="small"
																color={contact.chatbotDisabled ? "default" : "primary"}
																className={classes.actionIconBtn}
																aria-label={i18n.t("contacts.chatbotToggle")}
																disabled={chatbotToggleLoadingId === contact.id}
																onClick={() => handleToggleChatbotForContact(contact)}
															>
																{contact.chatbotDisabled ? (
																	<SmartToyOutlinedIcon fontSize="small" />
																) : (
																	<SmartToyIcon fontSize="small" />
																)}
															</IconButton>
														</span>
													</Tooltip>
													<Tooltip title={i18n.t("contacts.buttons.edit")}>
														<IconButton
															size="small"
															className={classes.actionIconBtn}
															aria-label={i18n.t("contacts.buttons.edit")}
															onClick={() => handleEditContact(contact.id)}
														>
															<EditIcon fontSize="small" />
														</IconButton>
													</Tooltip>
													<Can
														role={user.profile}
														perform="contacts-page:deleteContact"
														yes={() => (
															<Tooltip title={i18n.t("contacts.buttons.deleteRow")}>
																<AppDangerAction
																	aria-label={i18n.t(
																		"contacts.buttons.deleteRow"
																	)}
																	onClick={() => {
																		setConfirmOpen(true);
																		setDeletingContact(contact);
																	}}
																>
																	<DeleteOutlineIcon fontSize="small" />
																</AppDangerAction>
															</Tooltip>
														)}
													/>
												</Box>
											</TableCell>
										</TableRow>
									))}
									{loading && <AppTableRowSkeleton avatar columns={6} />}
								</>
							</TableBody>
						</Table>
					</AppTableContainer>
				)}

				{!isMobile && contacts.length > 0 ? (
					<Box className={classes.paginationBar}>
						<TablePagination
							component="div"
							count={totalCount}
							page={Math.max(0, page - 1)}
							onChangePage={handleTablePageChange}
							rowsPerPage={pageSize}
							onChangeRowsPerPage={handlePageSizeChange}
							rowsPerPageOptions={PAGE_SIZE_OPTIONS}
							labelRowsPerPage={i18n.t("contacts.pagination.rowsPerPage")}
							labelDisplayedRows={() => rangeLabel}
						/>
						{totalPages > 1 ? (
							<Box className={classes.paginationPages}>
								<Pagination
									color="primary"
									size="small"
									count={totalPages}
									page={page}
									onChange={handleNumberedPageChange}
									showFirstButton
									showLastButton
									disabled={loading}
								/>
							</Box>
						) : null}
					</Box>
				) : null}
			</AppSectionCard>
		</MainContainer>
	);
};

export default Contacts;
