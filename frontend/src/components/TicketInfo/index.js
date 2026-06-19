import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import { Avatar, CardHeader, IconButton, Box } from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import useIsMobile from "../../hooks/useIsMobile";

import { i18n } from "../../translate/i18n";
import ContactLabelsBar from "../ContactLabelsBar";

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
	},
	title: {
		fontWeight: 600,
		fontSize: "1rem",
		lineHeight: 1.35,
		letterSpacing: "-0.01em",
		color: theme.palette.text.primary,
	},
	subheader: {
		fontSize: "0.8125rem",
		lineHeight: 1.35,
		color: theme.palette.text.secondary,
		marginTop: theme.spacing(0.25),
	},
	backButton: {
		marginRight: theme.spacing(0.5),
		marginLeft: theme.spacing(-0.5),
		flexShrink: 0,
	},
	headerRow: {
		display: "flex",
		alignItems: "center",
		flex: 1,
		minWidth: 0,
		width: "100%",
	},
	headerMain: {
		flex: 1,
		minWidth: 0,
	},
}));

const TicketInfo = ({
	contact,
	ticket,
	onClick,
	onLabelsChange,
}) => {
	const classes = useStyles();
	const theme = useTheme();
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
				<span>
					<span style={{ display: "block" }}>{`${contactName} #${ticket.id}`}</span>
					{contact?.id && onLabelsChange ? (
						<span
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
			}
			subheader={
				<span>
					{String(ticket?.channel || "").toLowerCase() === "instagram" ? (
						<span style={{ display: "block", marginBottom: ticket.user ? 4 : 0 }}>
							Instagram
							{ticket?.instagramAccount?.name
								? ` · ${ticket.instagramAccount.name}`
								: ""}
						</span>
					) : null}
					{ticket.user && `${userName}`}
					{ticket.startedOutsideSystem && (
						<span
							style={{
								display: "block",
								marginTop: 4,
								fontSize: "0.75rem",
								lineHeight: 1.35,
								color: theme.palette.text.secondary,
							}}
						>
							{i18n.t("ticketsList.startedOutsideSystemHint")}
						</span>
					)}
				</span>
			}
			/>
		</Box>
	);
};

export default TicketInfo;
