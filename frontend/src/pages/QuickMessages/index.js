import React, {
	useState,
	useEffect,
	useReducer,
	useContext,
	useCallback,
} from "react";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import Tooltip from "@material-ui/core/Tooltip";
import Chip from "@material-ui/core/Chip";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import QuickMessageDialog from "../../components/QuickMessageDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const previewText = (text, max = 72) => {
	if (!text || typeof text !== "string") return "—";
	const t = text.replace(/\s+/g, " ").trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max)}…`;
};

const reducer = (state, action) => {
	if (action.type === "LOAD_QUICKMESSAGES") {
		const quickmessages = action.payload;
		const page = action.pageNumber ?? 1;
		if (!isArray(quickmessages)) return state;

		if (page === 1) {
			return quickmessages.map(q => ({ ...q }));
		}

		const existing = [...state];
		quickmessages.forEach(qm => {
			const ix = existing.findIndex(u => u.id === qm.id);
			if (ix !== -1) {
				existing[ix] = { ...existing[ix], ...qm };
			} else {
				existing.push(qm);
			}
		});
		return existing;
	}

	if (action.type === "UPDATE_QUICKMESSAGES") {
		const quickemessage = action.payload;
		const ix = state.findIndex(u => u.id === quickemessage.id);

		if (ix !== -1) {
			const prev = state[ix];
			state[ix] = { ...prev, ...quickemessage };
			return [...state];
		}
		return [quickemessage, ...state];
	}

	if (action.type === "DELETE_QUICKMESSAGE") {
		const quickemessageId = action.payload;
		const ix = state.findIndex(u => u.id === quickemessageId);
		if (ix !== -1) {
			state.splice(ix, 1);
		}
		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
	return state;
};

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(2),
		overflowY: "auto",
		...theme.scrollbarStyles,
	},
	previewCell: {
		maxWidth: 360,
		textAlign: "left",
		"& .MuiTypography-root": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			display: "-webkit-box",
			WebkitLineClamp: 3,
			WebkitBoxOrient: "vertical",
		},
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

const Quickemessages = () => {
	const classes = useStyles();

	const [loading, setLoading] = useState(true);
	const [pageNumber, setPageNumber] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [selectedQuickemessage, setSelectedQuickemessage] = useState(null);
	const [deletingQuickemessage, setDeletingQuickemessage] = useState(null);
	const [quickemessageModalOpen, setQuickMessageDialogOpen] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [listVersion, setListVersion] = useState(0);
	const [quickemessages, dispatch] = useReducer(reducer, []);
	const { user } = useContext(AuthContext);

	const socketManager = useContext(SocketContext);

	const fetchQuickemessages = useCallback(async () => {
		if (!user?.companyId) return;
		setLoading(true);
		try {
			const { data } = await api.get("/quick-messages", {
				params: { searchParam, pageNumber },
			});
			dispatch({
				type: "LOAD_QUICKMESSAGES",
				payload: data.records,
				pageNumber,
			});
			setHasMore(data.hasMore);
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	}, [searchParam, pageNumber, user?.companyId, user?.id]);

	useEffect(() => {
		const t = setTimeout(() => {
			fetchQuickemessages();
		}, 300);
		return () => clearTimeout(t);
	}, [fetchQuickemessages, listVersion]);

	useEffect(() => {
		const companyId = user?.companyId;
		if (!companyId) return;
		const socket = socketManager.getSocket(companyId);

		const onQuickMessage = data => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_QUICKMESSAGES", payload: data.record });
			}
			if (data.action === "delete") {
				dispatch({ type: "DELETE_QUICKMESSAGE", payload: +data.id });
			}
		};

		socket.on(`company-${companyId}-quickmessage`, onQuickMessage);
		return () => {
			socket.off(`company-${companyId}-quickmessage`, onQuickMessage);
		};
	}, [socketManager, user?.companyId]);

	const reloadList = useCallback(() => {
		setPageNumber(1);
		setListVersion(v => v + 1);
	}, []);

	const handleOpenQuickMessageDialog = () => {
		setSelectedQuickemessage(null);
		setQuickMessageDialogOpen(true);
	};

	const handleCloseQuickMessageDialog = () => {
		setSelectedQuickemessage(null);
		setQuickMessageDialogOpen(false);
	};

	const handleSearch = event => {
		const v = event.target.value.toLowerCase();
		setSearchParam(v);
		setPageNumber(1);
		dispatch({ type: "RESET" });
	};

	const handleEditQuickemessage = quickemessage => {
		setSelectedQuickemessage(quickemessage);
		setQuickMessageDialogOpen(true);
	};

	const handleDeleteQuickemessage = async quickemessageId => {
		try {
			await api.delete(`/quick-messages/${quickemessageId}`);
			toast.success(i18n.t("quickMessages.toasts.deleted"));
			dispatch({ type: "DELETE_QUICKMESSAGE", payload: quickemessageId });
		} catch (err) {
			toastError(err);
		}
		setDeletingQuickemessage(null);
		setConfirmModalOpen(false);
	};

	const loadMore = () => {
		setPageNumber(prevState => prevState + 1);
	};

	const handleScroll = e => {
		if (!hasMore || loading) return;
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		if (scrollHeight - (scrollTop + 100) < clientHeight) {
			loadMore();
		}
	};

	const formatDt = d => {
		if (!d) return "—";
		try {
			return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
		} catch {
			return "—";
		}
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={
					deletingQuickemessage &&
					`${i18n.t("quickMessages.confirmationModal.deleteTitle")} /${
						deletingQuickemessage.shortcode
					}?`
				}
				open={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={() => handleDeleteQuickemessage(deletingQuickemessage.id)}
			>
				{i18n.t("quickMessages.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<QuickMessageDialog
				reload={reloadList}
				open={quickemessageModalOpen}
				onClose={handleCloseQuickMessageDialog}
				aria-labelledby="form-dialog-title"
				quickemessageId={selectedQuickemessage && selectedQuickemessage.id}
			/>
			<MainHeader>
				<Title>{i18n.t("quickMessages.title")}</Title>
				<MainHeaderButtonsWrapper>
					<TextField
						placeholder={i18n.t("quickMessages.searchPlaceholder")}
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
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenQuickMessageDialog}
					>
						{i18n.t("quickMessages.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper
				className={classes.mainPaper}
				variant="outlined"
				onScroll={handleScroll}
			>
				{!loading && quickemessages.length === 0 ? (
					<Box py={8} textAlign="center">
						<Typography variant="h6" color="textSecondary" gutterBottom>
							{i18n.t("quickMessages.empty.title")}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("quickMessages.empty.subtitle")}
						</Typography>
					</Box>
				) : (
					<Table size="medium">
						<TableHead>
							<TableRow>
								<TableCell align="center" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.shortcode")}
								</TableCell>
								<TableCell align="center" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.category")}
								</TableCell>
								<TableCell style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.messagePreview")}
								</TableCell>
								<TableCell align="center" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.attachment")}
								</TableCell>
								<TableCell align="center" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.createdAt")}
								</TableCell>
								<TableCell align="center" style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.updatedAt")}
								</TableCell>
								<TableCell align="right" style={{ fontWeight: 600, width: 100, fontSize: "0.8125rem" }}>
									{i18n.t("quickMessages.table.actions")}
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<>
								{quickemessages.map(qm => (
									<TableRow key={qm.id} hover>
										<TableCell
											align="center"
											onClick={() => handleEditQuickemessage(qm)}
											style={{ cursor: "pointer", transition: "background-color 0.15s ease" }}
										>
											<Typography variant="body2" style={{ fontWeight: 600, color: "#1976d2" }}>
												/{qm.shortcode}
											</Typography>
										</TableCell>
										<TableCell align="center">
											{qm.category ? (
												<Chip size="small" label={qm.category} />
											) : (
												<Typography variant="caption" color="textSecondary">
													—
												</Typography>
											)}
										</TableCell>
										<TableCell className={classes.previewCell}>
											<Typography variant="body2" color="textPrimary">
												{previewText(qm.message)}
											</Typography>
										</TableCell>
										<TableCell align="center">
											{qm.mediaName ||
												i18n.t("quickMessages.noAttachment")}
										</TableCell>
										<TableCell align="center">
											{formatDt(qm.createdAt)}
										</TableCell>
										<TableCell align="center">
											{formatDt(qm.updatedAt)}
										</TableCell>
										<TableCell align="right">
											<Box display="flex" justifyContent="flex-end" alignItems="center" style={{ gap: 4 }}>
												<Tooltip title={i18n.t("quickMessages.buttons.edit")}>
													<IconButton
														size="small"
														className={classes.actionIcon}
														onClick={e => {
															e.stopPropagation();
															handleEditQuickemessage(qm);
														}}
														aria-label={i18n.t("quickMessages.buttons.edit")}
													>
														<EditIcon fontSize="small" />
													</IconButton>
												</Tooltip>
												<Tooltip title={i18n.t("quickMessages.buttons.delete")}>
													<IconButton
														size="small"
														className={classes.actionIcon}
														onClick={e => {
															e.stopPropagation();
															setConfirmModalOpen(true);
															setDeletingQuickemessage(qm);
														}}
														aria-label={i18n.t("quickMessages.buttons.delete")}
														style={{ color: "#d32f2f" }}
													>
														<DeleteOutlineIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											</Box>
										</TableCell>
									</TableRow>
								))}
								{loading && <TableRowSkeleton columns={7} />}
							</>
						</TableBody>
					</Table>
				)}
			</Paper>
		</MainContainer>
	);
};

export default Quickemessages;
