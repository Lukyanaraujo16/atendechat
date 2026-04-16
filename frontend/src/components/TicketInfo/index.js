import React, { useState, useEffect } from "react";

import { Avatar, CardHeader } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
	root: {
		flex: 1,
		minWidth: 0,
		padding: theme.spacing(1.25, 2),
		alignItems: "center",
		cursor: "pointer",
		transition: theme.transitions.create("background-color", { duration: 150 }),
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
	},
	avatar: {
		width: 44,
		height: 44,
		border: `1px solid ${theme.palette.divider}`,
		boxShadow: theme.palette.type === "dark" ? "none" : theme.shadows[1],
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
}));

const TicketInfo = ({ contact, ticket, onClick }) => {
	const classes = useStyles();
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<CardHeader
			onClick={onClick}
			classes={{
				root: classes.root,
				avatar: classes.avatar,
				title: classes.title,
				subheader: classes.subheader,
			}}
			titleTypographyProps={{ noWrap: true, variant: "subtitle1", component: "span" }}
			subheaderTypographyProps={{ noWrap: true, component: "span" }}
			avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" />}
			title={`${contactName} #${ticket.id}`}
			subheader={ticket.user && `${userName}`}
		/>
	);
};

export default TicketInfo;
