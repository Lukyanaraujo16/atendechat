import React, {
	useEffect,
	useReducer,
	useState,
	useContext,
	useCallback,
	useMemo,
} from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
	Button,
	IconButton,
	makeStyles,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Typography,
	TextField,
	InputAdornment,
	Box,
	Chip,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import useIsMobile from "../../hooks/useIsMobile";
import {
	MobileEntityCard,
	MobileCardList,
	MobileActionsMenu,
} from "../../ui";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const chipTextColor = (hex) => {
	if (!hex || typeof hex !== "string") return "#fff";
	const h = hex.replace("#", "").slice(0, 6);
	if (h.length !== 6) return "#fff";
	const r = parseInt(h.substr(0, 2), 16);
	const g = parseInt(h.substr(2, 2), 16);
	const b = parseInt(h.substr(4, 2), 16);
	if (Number.isNaN(r + g + b)) return "#fff";
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq >= 186 ? "#111" : "#fff";
};

const useStyles = makeStyles((theme) => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(2),
		overflowY: "auto",
		...theme.scrollbarStyles,
	},
	swatch: {
		width: 28,
		height: 28,
		borderRadius: 4,
		border: `1px solid ${theme.palette.divider}`,
		margin: "0 auto",
	},
	mobileList: {
		width: "100%",
		maxWidth: "100%",
		overflowX: "hidden",
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD_QUEUES") {
		const queues = action.payload;
		const newQueues = [];

		queues.forEach((queue) => {
			const queueIndex = state.findIndex((q) => q.id === queue.id);
			if (queueIndex !== -1) {
				state[queueIndex] = queue;
			} else {
				newQueues.push(queue);
			}
		});

		return [...state, ...newQueues];
	}

	if (action.type === "UPDATE_QUEUES") {
		const queue = action.payload;
		const queueIndex = state.findIndex((u) => u.id === queue.id);

		if (queueIndex !== -1) {
			const prev = state[queueIndex];
			state[queueIndex] = { ...prev, ...queue };
			return [...state];
		} else {
			return [queue, ...state];
		}
	}

	if (action.type === "DELETE_QUEUE") {
		const queueId = action.payload;
		const queueIndex = state.findIndex((q) => q.id === queueId);
		if (queueIndex !== -1) {
			state.splice(queueIndex, 1);
		}
		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

const Queues = () => {
	const classes = useStyles();
	const isMobile = useIsMobile();
	const { user } = useContext(AuthContext);

	const [queues, dispatch] = useReducer(reducer, []);
	const [loading, setLoading] = useState(false);
	const [searchParam, setSearchParam] = useState("");

	const [queueModalOpen, setQueueModalOpen] = useState(false);
	const [selectedQueue, setSelectedQueue] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);

	const socketManager = useContext(SocketContext);

	const fetchQueues = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await api.get("/queue");
			const list = Array.isArray(data) ? data : [];
			dispatch({ type: "RESET" });
			dispatch({ type: "LOAD_QUEUES", payload: list });
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchQueues();
	}, [fetchQueues]);

	useEffect(() => {
		const companyId = user?.companyId || localStorage.getItem("companyId");
		const socket = socketManager.getSocket(companyId);

		const onQueue = (data) => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
			}
			if (data.action === "delete") {
				dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
			}
		};

		socket.on(`company-${companyId}-queue`, onQueue);

		return () => {
			socket.off(`company-${companyId}-queue`, onQueue);
		};
	}, [socketManager, user]);

	const filteredQueues = useMemo(() => {
		const sp = searchParam.trim().toLowerCase();
		if (!sp) return queues;
		return queues.filter(
			(q) =>
				(q.name && q.name.toLowerCase().includes(sp)) ||
				String(q.id).includes(sp)
		);
	}, [queues, searchParam]);

	const handleOpenQueueModal = () => {
		setQueueModalOpen(true);
		setSelectedQueue(null);
	};

	const handleCloseQueueModal = () => {
		setQueueModalOpen(false);
		setSelectedQueue(null);
	};

	const handleEditQueue = (queue) => {
		setSelectedQueue(queue);
		setQueueModalOpen(true);
	};

	const handleCloseConfirmationModal = () => {
		setConfirmModalOpen(false);
		setSelectedQueue(null);
	};

	const handleDeleteQueue = async (queueId) => {
		try {
			await api.delete(`/queue/${queueId}`);
			toast.success(i18n.t("queues.toasts.success"));
			dispatch({ type: "DELETE_QUEUE", payload: queueId });
		} catch (err) {
			toastError(err);
		}
		setConfirmModalOpen(false);
		setSelectedQueue(null);
	};

	const formatCreated = (d) => {
		if (!d) return "—";
		try {
			return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
		} catch {
			return "—";
		}
	};

	const usageTickets = (q) => q.ticketsCount ?? 0;
	const usageUsers = (q) => q.usersCount ?? 0;

	const renderMobileQueueCard = (queue) => {
		const menuItems = [
			{
				key: "edit",
				label: i18n.t("queueModal.title.edit"),
				icon: <Edit fontSize="small" />,
				onClick: () => handleEditQueue(queue),
			},
			{
				key: "delete",
				label: i18n.t("queues.confirmationModal.deleteTitle"),
				icon: <DeleteOutline fontSize="small" />,
				danger: true,
				onClick: () => {
					setSelectedQueue(queue);
					setConfirmModalOpen(true);
				},
			},
		];

		return (
			<MobileEntityCard
				key={queue.id}
				leading={
					<Box
						className={classes.swatch}
						style={{ backgroundColor: queue.color || "#ccc" }}
					/>
				}
				title={queue.name}
				badges={
					<MobileActionsMenu
						items={menuItems}
						ariaLabel={i18n.t("queues.mobile.flowActions")}
					/>
				}
				onClick={() => handleEditQueue(queue)}
				footer={
					<Chip
						size="small"
						label={queue.name}
						style={{
							backgroundColor: queue.color || "#ccc",
							color: chipTextColor(queue.color),
							fontWeight: 600,
						}}
					/>
				}
			>
				<Typography variant="caption" color="textSecondary" display="block">
					{i18n.t("queues.mobile.tickets")}: {usageTickets(queue)} ·{" "}
					{i18n.t("queues.mobile.users")}: {usageUsers(queue)}
				</Typography>
				<Typography variant="caption" color="textSecondary" display="block">
					{i18n.t("queues.mobile.order")}: {queue.orderQueue ?? "—"}
				</Typography>
				{queue.greetingMessage ? (
					<Typography variant="caption" color="textSecondary" display="block" noWrap>
						{i18n.t("queues.mobile.greeting")}: {queue.greetingMessage}
					</Typography>
				) : null}
			</MobileEntityCard>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={
					selectedQueue &&
					`${i18n.t("queues.confirmationModal.deleteTitle")} ${
						selectedQueue.name
					}?`
				}
				open={confirmModalOpen}
				onClose={handleCloseConfirmationModal}
				onConfirm={() => handleDeleteQueue(selectedQueue.id)}
			>
				{selectedQueue &&
				(usageTickets(selectedQueue) > 0 ||
					usageUsers(selectedQueue) > 0) ? (
					<>
						<Typography variant="body2" paragraph>
							{i18n.t("queues.confirmationModal.deleteWarningInUse", {
								tickets: usageTickets(selectedQueue),
								users: usageUsers(selectedQueue),
							})}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("queues.confirmationModal.deleteMessage")}
						</Typography>
					</>
				) : (
					i18n.t("queues.confirmationModal.deleteMessage")
				)}
			</ConfirmationModal>
			<QueueModal
				open={queueModalOpen}
				onClose={handleCloseQueueModal}
				queueId={selectedQueue?.id}
				reload={fetchQueues}
			/>
			<MainHeader>
				<Title>{i18n.t("queues.title")}</Title>
				<MainHeaderButtonsWrapper>
					<TextField
						placeholder={i18n.t("queues.searchPlaceholder")}
						type="search"
						value={searchParam}
						onChange={(e) => setSearchParam(e.target.value)}
						fullWidth={isMobile}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon fontSize="small" color="inherit" />
								</InputAdornment>
							),
						}}
					/>
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenQueueModal}
					>
						{i18n.t("queues.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={classes.mainPaper} variant="outlined">
				{!loading && filteredQueues.length === 0 ? (
					<Box py={8} textAlign="center">
						<Typography variant="h6" color="textSecondary" gutterBottom>
							{i18n.t("queues.empty.title")}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("queues.empty.subtitle")}
						</Typography>
					</Box>
				) : isMobile ? (
					<Box className={classes.mobileList}>
						<MobileCardList>
							{filteredQueues.map((queue) => renderMobileQueueCard(queue))}
						</MobileCardList>
						{loading ? <TableRowSkeleton columns={1} /> : null}
					</Box>
				) : (
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>{i18n.t("queues.table.name")}</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.color")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.tickets")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.users")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.orderQueue")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.createdAt")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("queues.table.actions")}
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<>
								{filteredQueues.map((queue) => (
									<TableRow key={queue.id} hover>
										<TableCell>
											<Chip
												label={queue.name}
												size="small"
												style={{
													backgroundColor: queue.color || "#ccc",
													color: chipTextColor(queue.color),
													fontWeight: 600,
													border: "none",
												}}
											/>
										</TableCell>
										<TableCell align="center">
											<Box
												className={classes.swatch}
												style={{
													backgroundColor: queue.color || "#ccc",
												}}
												title={queue.color}
											/>
										</TableCell>
										<TableCell align="center">
											{usageTickets(queue)}
										</TableCell>
										<TableCell align="center">
											{usageUsers(queue)}
										</TableCell>
										<TableCell align="center">
											{queue.orderQueue ?? "—"}
										</TableCell>
										<TableCell align="center">
											{formatCreated(queue.createdAt)}
										</TableCell>
										<TableCell align="center">
											<IconButton
												size="small"
												onClick={() => handleEditQueue(queue)}
											>
												<Edit />
											</IconButton>

											<IconButton
												size="small"
												onClick={() => {
													setSelectedQueue(queue);
													setConfirmModalOpen(true);
												}}
											>
												<DeleteOutline />
											</IconButton>
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

export default Queues;
