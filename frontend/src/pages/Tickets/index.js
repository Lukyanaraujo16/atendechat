import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManager/";
import Ticket from "../../components/Ticket/";
import { useBranding } from "../../context/Branding/BrandingContext";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		padding: theme.spacing(3),
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
		[theme.breakpoints.down("sm")]: {
			padding: theme.spacing(2),
		},
	},

	chatPapper: {
		// backgroundColor: "red",
		display: "flex",
		height: "100%",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
	},
	messagessWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		backgroundColor: theme.palette.boxticket,
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
		padding: theme.spacing(5, 4),
		borderRadius: theme.spacing(1.5),
		boxShadow: theme.palette.type === "dark" ? theme.shadows[2] : theme.shadows[2],
		border: `1px solid ${theme.palette.divider}`,
	},
	welcomeLogo: {
		maxWidth: 160,
		width: "32%",
		maxHeight: 80,
		objectFit: "contain",
		marginBottom: theme.spacing(2.5),
		opacity: 0.88,
	},
	welcomeTitle: {
		fontWeight: 700,
		fontSize: "1.125rem",
		letterSpacing: "-0.02em",
		color: theme.palette.text.primary,
		marginBottom: theme.spacing(1),
		maxWidth: 380,
		lineHeight: 1.35,
	},
	welcomeSubtitle: {
		color: theme.palette.text.secondary,
		fontSize: "0.9375rem",
		fontWeight: 400,
		maxWidth: 400,
		lineHeight: 1.55,
		opacity: 0.92,
	},
}));

const Chat = () => {
	const classes = useStyles();
	const { ticketId } = useParams();
	const { branding, resolveMenuLogo } = useBranding();

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={4} className={classes.contactsWrapper}>
						<TicketsManager />
					</Grid>
					<Grid item xs={8} className={classes.messagessWrapper}>
						{ticketId ? (
							<>
								<Ticket />
							</>
						) : (
							<Paper square variant="outlined" className={classes.welcomeMsg}>
								<img
									className={classes.welcomeLogo}
									src={resolveMenuLogo()}
									alt={branding.systemName || ""}
								/>
								<Typography component="h2" className={classes.welcomeTitle}>
									{i18n.t("chat.emptyInboxTitle")}
								</Typography>
								<Typography component="p" className={classes.welcomeSubtitle}>
									{i18n.t("chat.emptyInboxSubtitle")}
								</Typography>
							</Paper>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default Chat;
