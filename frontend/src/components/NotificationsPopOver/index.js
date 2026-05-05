import React, { useState, useRef, useEffect, useContext, useCallback } from "react";

import { useHistory } from "react-router-dom";
import { format } from "date-fns";
import { SocketContext } from "../../context/Socket/SocketContext";

import useSound from "use-sound";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import { makeStyles } from "@material-ui/core/styles";
import ChatIcon from "@material-ui/icons/Chat";

import TicketListItem from "../TicketListItemCustom";
import NotificationPopoverLayout, { PulsingNotificationBadge } from "../NotificationPopoverLayout";
import useTickets from "../../hooks/useTickets";
import alertSound from "../../assets/sound.mp3";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

/** Som / notificação desktop só para tickets “do” usuário: atribuído a ele OU sem responsável na fila dele. */
function shouldNotifyUserAboutTicket(ticket, user) {
	if (!user?.id || !ticket || ticket.isGroup) return false;
	const myId = Number(user.id);
	const rawAssignee = ticket.userId;
	const hasAssignee =
		rawAssignee != null &&
		rawAssignee !== "" &&
		!Number.isNaN(Number(rawAssignee)) &&
		Number(rawAssignee) > 0;
	const assigneeId = hasAssignee ? Number(rawAssignee) : null;

	const queueIds = Array.isArray(user.queues)
		? user.queues.map(q => Number(q.id))
		: [];
	const rawQ = ticket.queueId;
	const qid =
		rawQ != null && rawQ !== "" && !Number.isNaN(Number(rawQ))
			? Number(rawQ)
			: null;

	if (assigneeId != null && assigneeId !== myId) {
		return false;
	}
	if (assigneeId === myId) {
		return true;
	}
	return qid != null && queueIds.includes(qid);
}

function isTicketOpenInRoute(ticket, history) {
	if (!ticket || !history?.location?.pathname) return false;
	const m = history.location.pathname.match(/^\/tickets\/([^/?#]+)/);
	const seg = m?.[1];
	if (!seg) return false;
	return seg === String(ticket.uuid) || seg === String(ticket.id);
}

const useStyles = makeStyles(theme => ({
	popoverPaper: {
		marginLeft: theme.spacing(2),
		marginRight: theme.spacing(1),
		"& > div": {
			boxShadow: "none",
		},
	},
}));

const NotificationsPopOver = ({ volume }) => {
	const classes = useStyles();

	const history = useHistory();
	const { user } = useContext(AuthContext);
	const lastSoundAtRef = useRef(0);
	const SOUND_DEBOUNCE_MS = 1000;
	const anchorEl = useRef();
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);

	const [showPendingTickets, setShowPendingTickets] = useState(false);

	const [, setDesktopNotifications] = useState([]);

	const { tickets } = useTickets({
		withUnreadMessages: "true",
		enabled: Boolean(user?.companyId),
	});

	const [play] = useSound(alertSound, { volume: volume ?? 1 });
	const soundAlertRef = useRef();

	const historyRef = useRef(history);

  const socketManager = useContext(SocketContext);

	useEffect(() => {
		const fetchSettings = async () => {
			try {

				if (user?.allTicket === "enabled") {
					setShowPendingTickets(true);
				}
			} catch (err) {
			  	toastError(err);
			}
		}
	  
		fetchSettings();
	}, [user?.id, user?.allTicket]);

	useEffect(() => {
		soundAlertRef.current = play;

		if (!("Notification" in window)) {
			console.log("This browser doesn't support notifications");
		} else {
			/* Pedido imediato ao montar: pode ser agressivo (prompt sem contexto). Fase posterior: UX explícita. */
			Notification.requestPermission();
		}
	}, [play]);

	useEffect(() => {
		const processNotifications = () => {
			if (showPendingTickets) {
				setNotifications(tickets);
			} else {
				const newNotifications = tickets.filter(ticket => ticket.status !== "pending");

				setNotifications(newNotifications);
			}
		}

		processNotifications();
	}, [tickets, showPendingTickets]);

	useEffect(() => {
		historyRef.current = history;
	}, [history]);

	const handleNotifications = useCallback(data => {
		const { message, contact, ticket } = data;

		const options = {
			body: `${message.body} - ${format(new Date(), "HH:mm")}`,
			icon: contact.urlPicture,
			tag: ticket.id,
			renotify: true,
		};

		const notification = new Notification(
			`${i18n.t("tickets.notification.message")} ${contact.name}`,
			options
		);

		notification.onclick = e => {
			e.preventDefault();
			window.focus();
			historyRef.current.push(`/tickets/${ticket.uuid}`);
		};

		setDesktopNotifications(prevState => {
			const notfiticationIndex = prevState.findIndex(
				n => n.tag === notification.tag
			);
			if (notfiticationIndex !== -1) {
				prevState[notfiticationIndex] = notification;
				return [...prevState];
			}
			return [notification, ...prevState];
		});

		soundAlertRef.current();
	}, []);

	useEffect(() => {
		if (!user?.companyId) {
			return undefined;
		}

    const socket = socketManager.getSocket(user.companyId);
		const companyId = user.companyId;

		const onReadyJoin = () => socket.emit("joinNotification");

		const onTicket = data => {
			if (data.action === "updateUnread" || data.action === "delete") {
				setNotifications(prevState => {
					const ticketIndex = prevState.findIndex(t => t.id === data.ticketId);
					if (ticketIndex !== -1) {
						prevState.splice(ticketIndex, 1);
						return [...prevState];
					}
					return prevState;
				});

				setDesktopNotifications(prevState => {
					const notfiticationIndex = prevState.findIndex(
						n => n.tag === String(data.ticketId)
					);
					if (notfiticationIndex !== -1) {
						prevState[notfiticationIndex].close();
						prevState.splice(notfiticationIndex, 1);
						return [...prevState];
					}
					return prevState;
				});
			}
		};

		const onAppMessage = data => {
			if (data.action !== "create" || data.message.fromMe) {
				return;
			}
			if (
				!(data.ticket.status !== "pending") ||
				!(!data.message.read || data.ticket.status === "pending")
			) {
				return;
			}
			if (!shouldNotifyUserAboutTicket(data.ticket, user)) {
				return;
			}

			setNotifications(prevState => {
				const ticketIndex = prevState.findIndex(t => t.id === data.ticket.id);
				if (ticketIndex !== -1) {
					prevState[ticketIndex] = data.ticket;
					return [...prevState];
				}
				return [data.ticket, ...prevState];
			});

			if (isTicketOpenInRoute(data.ticket, historyRef.current)) {
				return;
			}

			const now = Date.now();
			if (now - lastSoundAtRef.current < SOUND_DEBOUNCE_MS) {
				return;
			}
			lastSoundAtRef.current = now;

			handleNotifications(data);
		};

		socket.on("ready", onReadyJoin);
		socket.on(`company-${companyId}-ticket`, onTicket);
		socket.on(`company-${companyId}-appMessage`, onAppMessage);

		return () => {
			socket.off("ready", onReadyJoin);
			socket.off(`company-${companyId}-ticket`, onTicket);
			socket.off(`company-${companyId}-appMessage`, onAppMessage);
		};
	}, [user?.companyId, user?.id, user?.queues, socketManager, handleNotifications]);

	const handleClick = () => {
		setIsOpen(prevState => !prevState);
	};

	const handleClickAway = () => {
		setIsOpen(false);
	};

	const NotificationTicket = ({ children }) => {
		return <div onClick={handleClickAway}>{children}</div>;
	};

	return (
		<>
			<IconButton
				onClick={handleClick}
				ref={anchorEl}
				aria-label="Open Notifications"
				color="inherit"
				style={{ color: "rgba(0, 0, 0, 0.54)" }}
			>
				<PulsingNotificationBadge hasNotification={notifications.length > 0}>
					<ChatIcon />
				</PulsingNotificationBadge>
			</IconButton>
			<Popover
				disableScrollLock
				open={isOpen}
				anchorEl={anchorEl.current}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				classes={{ paper: classes.popoverPaper }}
				onClose={handleClickAway}
			>
				<NotificationPopoverLayout
					title={i18n.t("notifications.title")}
					emptyText={i18n.t("notifications.noTickets")}
					hasItems={notifications.length}
				>
					<List dense>
						{notifications.map(ticket => (
							<NotificationTicket key={ticket.id}>
								<TicketListItem ticket={ticket} />
							</NotificationTicket>
						))}
					</List>
				</NotificationPopoverLayout>
			</Popover>
		</>
	);
};

export default NotificationsPopOver;
