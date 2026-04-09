import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { Tooltip } from "@material-ui/core";
import { alpha, makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
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
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";
import {
	AppPageHeader,
	AppSectionCard,
	AppPrimaryButton,
	AppSecondaryButton,
	AppActionBar,
	AppTableContainer,
	AppDangerAction,
} from "../../ui";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import { SocketContext } from "../../context/Socket/SocketContext";

import { CSVLink } from "react-csv";
import ImportContactsModal from "../../components/ImportContactsModal";

const reducer = (state, action) => {
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
	expectationsBox: {
		padding: theme.spacing(1.5, 2),
		borderRadius: theme.shape.borderRadius,
		backgroundColor: theme.palette.action.hover,
	},
	filtersBar: {
		flexWrap: "wrap",
		alignItems: "flex-end",
	},
	searchField: {
		flex: "1 1 220px",
		minWidth: 180,
		maxWidth: 400,
	},
	tagField: {
		minWidth: 200,
		flex: "0 1 220px",
	},
	dateField: {
		flex: "0 1 160px",
	},
	filterHint: {
		fontSize: "0.75rem",
		color: theme.palette.text.secondary,
		marginTop: theme.spacing(0.25),
	},
	filterStack: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(2),
	},
	tableCard: {
		flex: 1,
		minHeight: 0,
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
	},
	nameCell: {
		cursor: "pointer",
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
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(0.5),
		maxWidth: 280,
	},
	csvLink: {
		textDecoration: "none",
		display: "inline-flex",
	},
}));

const Contacts = () => {
	const classes = useStyles();
	const history = useHistory();

	const { user } = useContext(AuthContext);

	const [loading, setLoading] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [searchParam, setSearchParam] = useState("");
	const [tagFilter, setTagFilter] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [contacts, dispatch] = useReducer(reducer, []);
	const [selectedContactId, setSelectedContactId] = useState(null);
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
	const [contactTicket, setContactTicket] = useState({});
	const [deletingContact, setDeletingContact] = useState(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [openModalImport, setOpenModalImport] = useState(false);
	const [tagOptions, setTagOptions] = useState([]);

	const socketManager = useContext(SocketContext);

	useEffect(() => {
		api
			.get("/tags/list")
			.then(({ data }) =>
				setTagOptions(Array.isArray(data) ? data : [])
			)
			.catch(() => {});
	}, []);

	useEffect(() => {
		dispatch({ type: "RESET" });
		setPageNumber(1);
	}, [searchParam, tagFilter, dateFrom, dateTo]);

	useEffect(() => {
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchContacts = async () => {
				try {
					const params = {
						searchParam,
						pageNumber,
					};
					if (tagFilter) params.tagId = tagFilter;
					if (dateFrom) params.dateFrom = dateFrom;
					if (dateTo) params.dateTo = dateTo;

					const { data } = await api.get("/contacts/", {
						params,
					});
					dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
					setHasMore(data.hasMore);
					setLoading(false);
				} catch (err) {
					toastError(err);
					setLoading(false);
				}
			};
			fetchContacts();
		}, 300);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, pageNumber, tagFilter, dateFrom, dateTo]);

	useEffect(() => {
		const companyId = localStorage.getItem("companyId");
		const socket = socketManager.getSocket(companyId);

		const handler = (data) => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
			}

			if (data.action === "delete") {
				dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
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

	const hadleEditContact = (contactId) => {
		setSelectedContactId(contactId);
		setContactModalOpen(true);
	};

	const handleDeleteContact = async (contactId) => {
		try {
			await api.delete(`/contacts/${contactId}`);
			toast.success(i18n.t("contacts.toasts.deleted"));
		} catch (err) {
			toastError(err);
		}
		setDeletingContact(null);
		setSearchParam("");
		setPageNumber(1);
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

	const handleCloseModalImport = () => {
		setOpenModalImport(false);
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
				onContactSaved={(updated) => {
					dispatch({ type: "UPDATE_CONTACTS", payload: updated });
				}}
				onOpenAttendance={(c) => {
					setContactTicket(c);
					setNewTicketModalOpen(true);
					setContactModalOpen(false);
				}}
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
					deletingContact
						? handleDeleteContact(deletingContact.id)
						: handleimportContact()
				}
			>
				{deletingContact
					? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
					: `${i18n.t("contacts.confirmationModal.importMessage")}`}
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
				<Alert severity="info" variant="outlined">
					{i18n.t("contacts.pageBanner")}
				</Alert>
				<Box mt={1.5} className={classes.expectationsBox}>
					<Typography variant="body2" color="textSecondary">
						{i18n.t("contacts.pageExpectations")}
					</Typography>
				</Box>
			</Box>

			<AppSectionCard dense variant="outlined">
				<Box className={classes.filterStack}>
					<AppActionBar className={classes.filtersBar}>
						<TextField
							className={classes.searchField}
							placeholder={i18n.t("contacts.searchPlaceholder")}
							type="search"
							value={searchParam}
							onChange={handleSearch}
							helperText={i18n.t("contacts.searchHelper")}
							variant="outlined"
							size="small"
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon color="action" fontSize="small" />
									</InputAdornment>
								),
							}}
						/>
						<Box display="flex" flexDirection="column" className={classes.tagField}>
							<FormControl variant="outlined" margin="dense" fullWidth>
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
							<Typography className={classes.filterHint} component="span">
								{i18n.t("contacts.tagFilterHelp")}
							</Typography>
						</Box>
						<TextField
							className={classes.dateField}
							label={i18n.t("contacts.filters.dateFrom")}
							type="date"
							variant="outlined"
							margin="dense"
							size="small"
							InputLabelProps={{ shrink: true }}
							value={dateFrom}
							onChange={(e) => setDateFrom(e.target.value)}
						/>
						<TextField
							className={classes.dateField}
							label={i18n.t("contacts.filters.dateTo")}
							type="date"
							variant="outlined"
							margin="dense"
							size="small"
							InputLabelProps={{ shrink: true }}
							value={dateTo}
							onChange={(e) => setDateTo(e.target.value)}
						/>
					</AppActionBar>
				</Box>
			</AppSectionCard>

			<AppSectionCard
				scrollable
				className={classes.tableCard}
				variant="outlined"
				onScroll={handleScroll}
			>
				{!loading && contacts.length === 0 ? (
					<Box py={6} textAlign="center">
						<Typography variant="h6" color="textSecondary" gutterBottom>
							{i18n.t("contacts.empty.title")}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("contacts.empty.subtitle")}
						</Typography>
					</Box>
				) : (
					<AppTableContainer nested>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell padding="checkbox" />
									<TableCell>{i18n.t("contacts.table.name")}</TableCell>
									<TableCell>{i18n.t("contacts.table.number")}</TableCell>
									<TableCell>
										<Tooltip title={i18n.t("contacts.tagsColumnHint")}>
											<span>{i18n.t("contacts.table.tags")}</span>
										</Tooltip>
									</TableCell>
									<TableCell align="center">
										{i18n.t("contacts.table.lastInteraction")}
									</TableCell>
									<TableCell align="center">
										{i18n.t("contacts.table.createdAt")}
									</TableCell>
									<TableCell align="center">
										{i18n.t("contacts.table.actions")}
									</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								<>
									{contacts.map((contact) => (
										<TableRow key={contact.id} hover>
											<TableCell className={classes.avatarCell}>
												<Avatar src={contact.profilePicUrl} />
											</TableCell>
											<TableCell
												className={classes.nameCell}
												onClick={() => hadleEditContact(contact.id)}
											>
												<Typography variant="subtitle1" component="span">
													<strong>{contact.name}</strong>
												</Typography>
											</TableCell>
											<TableCell>
												<Typography variant="caption" color="textSecondary">
													{contact.number}
												</Typography>
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
															aria-label={i18n.t("contacts.openAttendance")}
															onClick={() => {
																setContactTicket(contact);
																setNewTicketModalOpen(true);
															}}
														>
															<WhatsAppIcon fontSize="small" />
														</IconButton>
													</Tooltip>
													<Tooltip title={i18n.t("contacts.buttons.edit")}>
														<IconButton
															size="small"
															aria-label={i18n.t("contacts.buttons.edit")}
															onClick={() => hadleEditContact(contact.id)}
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
									{loading && <TableRowSkeleton avatar columns={5} />}
								</>
							</TableBody>
						</Table>
					</AppTableContainer>
				)}
			</AppSectionCard>
		</MainContainer>
	);
};

export default Contacts;
