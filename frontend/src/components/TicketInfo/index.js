import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import { Avatar, CardHeader, IconButton, Box } from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles, alpha } from "@material-ui/core/styles";
import useIsMobile from "../../hooks/useIsMobile";

import { i18n } from "../../translate/i18n";
import ContactLabelsBar from "../ContactLabelsBar";
import TicketAiAgentControls from "../TicketAiAgentControls";

const useStyles = makeStyles((theme) => ({
	root: {
		flex: 1,
		minWidth: 0,
		padding: theme.spacing(1.25, 2),
		alignItems: "center",
		cursor: "pointer",
		display: "flex",
		flexDirection: "row",
		transition: theme.transitions.create("background-color", { duration: 150 }),
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
		[theme.breakpoints.down("md")]: {
			padding: theme.spacing(0.75, 0.75, 0.75, 0.25),
		},
	},
	avatar: {
		width: 44,
		height: 44,
		borderRadius: "50%",
		overflow: "hidden",
		border: `2px solid ${alpha(theme.palette.success.main, 0.35)}`,
		boxShadow: theme.palette.type === "dark" ? "none" : theme.shadows[1],
		"& .MuiAvatar-img": {
			borderRadius: "50%",
			objectFit: "cover",
			width: "100%",
			height: "100%",
		},
		[theme.breakpoints.down("md")]: {
			width: 36,
			height: 36,
		},
	},
	title: {
		fontWeight: 600,
		fontSize: "1rem",
		lineHeight: 1.35,
		letterSpacing: "-0.01em",
		color: theme.palette.text.primary,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		[theme.breakpoints.down("md")]: {
			fontSize: "0.9375rem",
		},
	},
	subheader: {
		fontSize: "0.8125rem",
		lineHeight: 1.35,
		color: theme.palette.text.secondary,
		marginTop: theme.spacing(0.25),
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		[theme.breakpoints.down("md")]: {
			fontSize: "0.75rem",
			marginTop: 0,
		},
	},
	backButton: {
		marginRight: theme.spacing(0.5),
		marginLeft: theme.spacing(-0.5),
		flexShrink: 0,
		[theme.breakpoints.down("md")]: {
			marginRight: theme.spacing(0.25),
			marginLeft: 0,
			alignSelf: "center",
		},
	},
	headerRow: {
		display: "flex",
		alignItems: "center",
		flex: 1,
		minWidth: 0,
		width: "100%",
		overflow: "hidden",
	},
	headerMain: {
		flex: 1,
		minWidth: 0,
		overflow: "hidden",
	},
	titleBlock: {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		maxWidth: "100%",
	},
	subheaderBlock: {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		maxWidth: "100%",
	},
	desktopExtras: {
		display: "block",
	},
}));

const TicketInfo = ({
	contact,
	ticket,
	onClick,
	onLabelsChange,
	onTicketUpdate,
}) => {
	const classes = useStyles();
	const history = useHistory();
	const isMobile = useIsMobile();
	const { user } = ticket;
	const [userName, setUserName] = useState("");
	const [contactName, setContactName] = useState("");

	useEffect(() => {
		if (contact) {
			setContactName(contact.name || "");
			if (document.body.offsetWidth < 600) {
				if (contact.name && contact.name.length > 10) {
					const truncadName = contact.name.substring(0, 10) + "...";
					setContactName(truncadName);
				}
			}
		}

		if (user && contact) {
			setUserName(`${i18n.t("messagesList.header.assignedTo")} ${user.name}`);

			if (document.body.offsetWidth < 600) {
				setUserName(`${user.name}`);
			}
		}
	}, [ticket, contact]);

	const handleBack = (e) => {
		e.stopPropagation();
		history.push("/tickets");
	};

	const titleNode = (
		<span className={classes.titleBlock}>{`${contactName} #${ticket.id}`}</span>
	);

	const subheaderParts = [];
	if (String(ticket?.channel || "").toLowerCase() === "instagram") {
		subheaderParts.push(
			`Instagram${
				ticket?.instagramAccount?.name ? ` · ${ticket.instagramAccount.name}` : ""
			}`
		);
	}
	if (ticket.user) {
		subheaderParts.push(userName);
	}
	if (!isMobile && ticket.startedOutsideSystem) {
		subheaderParts.push(i18n.t("ticketsList.startedOutsideSystemHint"));
	}

	const subheaderNode = (
		<span className={classes.subheaderBlock}>
			{subheaderParts.filter(Boolean).join(" · ")}
		</span>
	);

	return (
		<Box className={classes.headerRow}>
			{isMobile ? (
				<IconButton
					className={classes.backButton}
					size="small"
					edge="start"
					onClick={handleBack}
					aria-label={i18n.t("ticketAdvanced.backToList")}
				>
					<ArrowBackIcon />
				</IconButton>
			) : null}
			<CardHeader
				onClick={onClick}
				className={classes.headerMain}
				classes={{
					root: classes.root,
					avatar: classes.avatar,
					title: classes.title,
					subheader: classes.subheader,
				}}
				titleTypographyProps={{ noWrap: true, variant: "subtitle1", component: "span" }}
				subheaderTypographyProps={{ noWrap: true, component: "span" }}
				avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
				title={
					isMobile ? (
						titleNode
					) : (
						<span>
							{titleNode}
							{contact?.id && onLabelsChange ? (
								<span
									className={classes.desktopExtras}
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
									role="presentation"
								>
									<ContactLabelsBar
										contactId={contact.id}
										labels={contact.labels}
										onLabelsChange={onLabelsChange}
										compact
									/>
								</span>
							) : null}
						</span>
					)
				}
				subheader={subheaderNode}
			/>
			{!isMobile ? (
				<TicketAiAgentControls ticket={ticket} onTicketUpdate={onTicketUpdate} />
			) : null}
		</Box>
	);
};

export default TicketInfo;
