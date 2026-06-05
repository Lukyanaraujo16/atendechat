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
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PersonIcon from "@material-ui/icons/Person";

import MainContainer from "../../components/MainContainer";
import useIsMobile from "../../hooks/useIsMobile";
import {
	MobileEntityCard,
	MobileCardList,
	MobileActionsMenu,
} from "../../ui";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";

const chipTextColor = hex => {
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

const reducer = (state, action) => {
	if (action.type === "LOAD_USERS") {
		const users = action.payload;
		const page = action.pageNumber ?? 1;
		if (page === 1) {
			return users.map(u => ({ ...u }));
		}
		const existing = [...state];
		users.forEach(user => {
			const userIndex = existing.findIndex(u => u.id === user.id);
			if (userIndex !== -1) {
				existing[userIndex] = { ...existing[userIndex], ...user };
			} else {
				existing.push(user);
			}
		});
		return existing;
	}

	if (action.type === "UPDATE_USERS") {
		const user = action.payload;
		const userIndex = state.findIndex(u => u.id === user.id);

		if (userIndex !== -1) {
			const prev = state[userIndex];
			state[userIndex] = { ...prev, ...user };
			return [...state];
		}
		return [user, ...state];
	}

	if (action.type === "DELETE_USER") {
		const userId = action.payload;

		const userIndex = state.findIndex(u => u.id === userId);
		if (userIndex !== -1) {
			state.splice(userIndex, 1);
		}
		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(2),
		overflowY: "auto",
		...theme.scrollbarStyles,
	},
	queueChips: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		justifyContent: "center",
		maxWidth: 280,
		margin: "0 auto",
	},
	mobileList: {
		width: "100%",
		maxWidth: "100%",
		overflowX: "hidden",
	},
	mobileChips: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		marginTop: theme.spacing(0.5),
	},
}));

const profileLabel = profile => {
	const key = `users.profileLabels.${profile}`;
	const t = i18n.t(key);
	return t !== key ? t : profile || "—";
};

const Users = () => {
	const classes = useStyles();
	const isMobile = useIsMobile();

	const [loading, setLoading] = useState(false);
	const [pageNumber, setPageNumber] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
	const [deletingUser, setDeletingUser] = useState(null);
	const [userModalOpen, setUserModalOpen] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [listVersion, setListVersion] = useState(0);
	const [users, dispatch] = useReducer(reducer, []);

	const socketManager = useContext(SocketContext);

	const reloadList = useCallback(() => {
		setPageNumber(1);
		setListVersion(v => v + 1);
	}, []);

	useEffect(() => {
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchUsers = async () => {
				try {
					const { data } = await api.get("/users/", {
						params: { searchParam, pageNumber },
					});
					dispatch({
						type: "LOAD_USERS",
						payload: data.users,
						pageNumber,
					});
					setHasMore(data.hasMore);
				} catch (err) {
					toastError(err);
				} finally {
					setLoading(false);
				}
			};
			fetchUsers();
		}, 300);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, pageNumber, listVersion]);

	useEffect(() => {
		const companyId = localStorage.getItem("companyId");
		const socket = socketManager.getSocket(companyId);

		const onUserEvent = data => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_USERS", payload: data.user });
			}

			if (data.action === "delete") {
				dispatch({ type: "DELETE_USER", payload: +data.userId });
			}
		};

		socket.on(`company-${companyId}-user`, onUserEvent);

		return () => {
			socket.off(`company-${companyId}-user`, onUserEvent);
		};
	}, [socketManager]);

	const handleOpenUserModal = () => {
		setSelectedUser(null);
		setUserModalOpen(true);
	};

	const handleCloseUserModal = () => {
		setSelectedUser(null);
		setUserModalOpen(false);
	};

	const handleSearch = event => {
		const v = event.target.value.toLowerCase();
		setSearchParam(v);
		setPageNumber(1);
		dispatch({ type: "RESET" });
	};

	const handleEditUser = user => {
		setSelectedUser(user);
		setUserModalOpen(true);
	};

	const handleDeleteUser = async userId => {
		try {
			await api.delete(`/users/${userId}`);
			toast.success(i18n.t("users.toasts.deleted"));
		} catch (err) {
			toastError(err);
		}
		setDeletingUser(null);
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

	const formatCreated = d => {
		if (!d) return "—";
		try {
			return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
		} catch {
			return "—";
		}
	};

	const ticketCount = u => u.ticketsAssignedCount ?? 0;

	const renderMobileUserCard = user => {
		const menuItems = [
			{
				key: "edit",
				label: i18n.t("users.buttons.edit"),
				icon: <EditIcon fontSize="small" />,
				onClick: () => handleEditUser(user),
			},
			{
				key: "delete",
				label: i18n.t("users.buttons.delete"),
				icon: <DeleteOutlineIcon fontSize="small" />,
				danger: true,
				onClick: () => {
					setConfirmModalOpen(true);
					setDeletingUser(user);
				},
			},
		];

		return (
			<MobileEntityCard
				key={user.id}
				leading={<PersonIcon color="primary" />}
				title={user.name}
				subtitle={user.email}
				badges={
					<MobileActionsMenu
						items={menuItems}
						ariaLabel={i18n.t("users.mobile.flowActions")}
					/>
				}
				onClick={() => handleEditUser(user)}
				footer={
					<Chip
						size="small"
						label={
							user.online
								? i18n.t("users.online.yes")
								: i18n.t("users.online.no")
						}
						color={user.online ? "primary" : "default"}
						variant={user.online ? "default" : "outlined"}
					/>
				}
			>
				<Typography variant="caption" color="textSecondary" display="block">
					{i18n.t("users.table.profile")}: {profileLabel(user.profile)}
				</Typography>
				<Typography variant="caption" color="textSecondary" display="block">
					{i18n.t("users.mobile.tickets")}: {ticketCount(user)}
				</Typography>
				<Typography variant="caption" color="textSecondary" display="block">
					{i18n.t("users.mobile.registeredAt")}: {formatCreated(user.createdAt)}
				</Typography>
				{user.queues && user.queues.length > 0 ? (
					<Box className={classes.mobileChips}>
						{user.queues.map(q => (
							<Chip
								key={q.id}
								size="small"
								variant="outlined"
								label={q.name}
								style={{
									borderColor: q.color || "#eee",
									color: chipTextColor(q.color),
								}}
							/>
						))}
					</Box>
				) : null}
			</MobileEntityCard>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={
					deletingUser &&
					`${i18n.t("users.confirmationModal.deleteTitle")} ${
						deletingUser.name
					}?`
				}
				open={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={() => handleDeleteUser(deletingUser.id)}
			>
				{deletingUser && ticketCount(deletingUser) > 0 ? (
					<>
						<Typography variant="body2" paragraph>
							{i18n.t("users.confirmationModal.deleteWarningTickets", {
								count: ticketCount(deletingUser),
							})}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("users.confirmationModal.deleteMessage")}
						</Typography>
					</>
				) : (
					i18n.t("users.confirmationModal.deleteMessage")
				)}
			</ConfirmationModal>
			<UserModal
				open={userModalOpen}
				onClose={handleCloseUserModal}
				aria-labelledby="form-dialog-title"
				userId={selectedUser && selectedUser.id}
				reload={reloadList}
			/>
			<MainHeader>
				<Title>{i18n.t("users.title")}</Title>
				<MainHeaderButtonsWrapper>
					<TextField
						placeholder={i18n.t("users.searchPlaceholder")}
						type="search"
						value={searchParam}
						onChange={handleSearch}
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
						onClick={handleOpenUserModal}
					>
						{i18n.t("users.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper
				className={classes.mainPaper}
				variant="outlined"
				onScroll={handleScroll}
			>
				{!loading && users.length === 0 ? (
					<Box py={8} textAlign="center">
						<Typography variant="h6" color="textSecondary" gutterBottom>
							{i18n.t("users.empty.title")}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("users.empty.subtitle")}
						</Typography>
					</Box>
				) : isMobile ? (
					<Box className={classes.mobileList}>
						<MobileCardList>
							{users.map(user => renderMobileUserCard(user))}
						</MobileCardList>
						{loading ? <TableRowSkeleton columns={1} /> : null}
					</Box>
				) : (
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell align="center">
									{i18n.t("users.table.id")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.name")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.email")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.profile")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.queues")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.online")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.tickets")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.createdAt")}
								</TableCell>
								<TableCell align="center">
									{i18n.t("users.table.actions")}
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<>
								{users.map(user => (
									<TableRow key={user.id}>
										<TableCell align="center">{user.id}</TableCell>
										<TableCell align="center">{user.name}</TableCell>
										<TableCell align="center">{user.email}</TableCell>
										<TableCell align="center">
											{profileLabel(user.profile)}
										</TableCell>
										<TableCell align="center">
											<div className={classes.queueChips}>
												{user.queues && user.queues.length > 0 ? (
													user.queues.map(q => (
														<Chip
															key={q.id}
															size="small"
															label={q.name}
															style={{
																backgroundColor: q.color || "#eee",
																color: chipTextColor(q.color),
															}}
														/>
													))
												) : (
													<Typography variant="caption" color="textSecondary">
														—
													</Typography>
												)}
											</div>
										</TableCell>
										<TableCell align="center">
											<Chip
												size="small"
												label={
													user.online
														? i18n.t("users.online.yes")
														: i18n.t("users.online.no")
												}
												color={user.online ? "primary" : "default"}
												variant={user.online ? "default" : "outlined"}
											/>
										</TableCell>
										<TableCell align="center">
											{ticketCount(user)}
										</TableCell>
										<TableCell align="center">
											{formatCreated(user.createdAt)}
										</TableCell>
										<TableCell align="center">
											<Tooltip title={i18n.t("users.buttons.edit")}>
												<IconButton
													size="small"
													onClick={() => handleEditUser(user)}
													aria-label={i18n.t("users.buttons.edit")}
												>
													<EditIcon />
												</IconButton>
											</Tooltip>

											<Tooltip title={i18n.t("users.buttons.delete")}>
												<IconButton
													size="small"
													onClick={() => {
														setConfirmModalOpen(true);
														setDeletingUser(user);
													}}
													aria-label={i18n.t("users.buttons.delete")}
												>
													<DeleteOutlineIcon />
												</IconButton>
											</Tooltip>
										</TableCell>
									</TableRow>
								))}
								{loading && <TableRowSkeleton columns={9} />}
							</>
						</TableBody>
					</Table>
				)}
			</Paper>
		</MainContainer>
	);
};

export default Users;
