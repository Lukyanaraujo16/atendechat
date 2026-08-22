import React from "react";
import { useParams } from "react-router-dom";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import { i18n } from "../../translate/i18n";
import {
	PANEL_RADIUS,
	INBOX_LIST_PANEL_RADIUS,
	PANEL_GAP_PX,
	getPanelElevation,
	getPanelDividerBorder,
	getChatPanelBackground,
} from "../../theme/ticketPanelStyles";
import { TICKETS_DESKTOP_SPLIT_COLUMNS } from "../../utils/ticketsCompactDesktopLayout";

import PersonIcon from "@material-ui/icons/Person";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		minHeight: 0,
		width: "100%",
		padding: theme.spacing(1),
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		backgroundColor: theme.palette.background.default,
	},

	chatPapper: {
		display: "flex",
		flex: 1,
		minHeight: 0,
		width: "100%",
	},

	splitLayout: {
		display: "grid",
		flex: 1,
		minHeight: 0,
		width: "100%",
		height: "100%",
		gap: theme.spacing(PANEL_GAP_PX / 8),
		overflow: "hidden",
		gridTemplateColumns: TICKETS_DESKTOP_SPLIT_COLUMNS,
	},

	contactsWrapper: {
		display: "flex",
		minWidth: 0,
		minHeight: 0,
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderRadius: INBOX_LIST_PANEL_RADIUS,
		border: "none",
		borderRight: getPanelDividerBorder(theme),
		backgroundColor: theme.palette.background.paper,
		boxShadow: getPanelElevation(theme),
		clipPath: `inset(0 round ${PANEL_RADIUS}px ${PANEL_RADIUS}px 0 ${PANEL_RADIUS}px)`,
	},
	messagesWrapper: {
		display: "flex",
		minWidth: 0,
		minHeight: 0,
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: PANEL_RADIUS,
		borderBottomRightRadius: PANEL_RADIUS,
		borderTopLeftRadius: PANEL_RADIUS,
		borderBottomLeftRadius: 0,
		border: "none",
		background: getChatPanelBackground(theme),
		boxShadow: getPanelElevation(theme),
	},
	welcomeMsg: {
		backgroundColor: theme.palette.background.default,
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
		padding: theme.spacing(4),
		borderRadius: `${PANEL_RADIUS}px ${PANEL_RADIUS}px ${PANEL_RADIUS}px 0`,
	},
	placeholderIllustration: {
		position: "relative",
		width: "100%",
		maxWidth: 520,
		height: 240,
		marginBottom: theme.spacing(2),
	},
	illustrationCard: {
		position: "absolute",
		right: 0,
		top: 22,
		width: 290,
		height: 160,
		borderRadius: 22,
		backgroundColor: "rgba(210,220,255,0.35)",
	},
	illustrationBubble: {
		position: "absolute",
		right: 12,
		top: 76,
		width: 240,
		height: 92,
		borderRadius: 14,
		backgroundColor: "#fff",
		boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
		border: "1px solid rgba(0,0,0,0.04)",
		display: "flex",
		flexDirection: "column",
		padding: "14px 16px",
	},
	illustrationBubbleLine: {
		height: 10,
		borderRadius: 999,
		backgroundColor: "rgba(36,199,118,0.25)",
		marginBottom: 12,
	},
	illustrationBubbleLine2: {
		height: 10,
		borderRadius: 999,
		backgroundColor: "rgba(0,0,0,0.05)",
		marginBottom: 12,
	},
	illustrationClose: {
		position: "absolute",
		right: 26,
		top: 62,
		width: 30,
		height: 30,
		borderRadius: 10,
		backgroundColor: "#fff",
		border: "1px solid rgba(0,0,0,0.06)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "rgba(0,0,0,0.35)",
		fontWeight: 700,
		fontSize: 16,
	},
	illustrationMan: {
		position: "absolute",
		left: 160,
		top: 8,
		width: 92,
		height: 92,
		borderRadius: "50%",
		backgroundColor: "#3a7bd5",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		boxShadow: "0 12px 26px rgba(0,0,0,0.08)",
		overflow: "hidden",
	},
	manAvatarOverlay: {
		position: "absolute",
		bottom: -10,
		right: -12,
		width: 40,
		height: 40,
		borderRadius: "50%",
		backgroundColor: "#24c776",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: "#fff",
		fontWeight: 700,
	},
	welcomeText: {
		color: theme.palette.text.secondary,
		fontSize: "0.9375rem",
		marginTop: theme.spacing(1),
	},
}));

const TicketsCustom = () => {
	const classes = useStyles();
	const { ticketId } = useParams();

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<div
					className={classes.splitLayout}
					data-tickets-split-layout="desktop"
				>
					<div className={classes.contactsWrapper}>
						<TicketsManager />
					</div>
					<div className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								<Ticket />
							</>
						) : (
							<div className={classes.welcomeMsg}>
								<div className={classes.placeholderIllustration} aria-hidden>
									<div className={classes.illustrationCard} />
									<div className={classes.illustrationMan}>
										<PersonIcon style={{ color: "#fff", fontSize: 52 }} />
										<div className={classes.manAvatarOverlay}>
											W
										</div>
									</div>
									<div className={classes.illustrationClose}>×</div>
									<div className={classes.illustrationBubble}>
										<div className={classes.illustrationBubbleLine} />
										<div className={classes.illustrationBubbleLine2} />
										<div className={classes.illustrationBubbleLine2} />
									</div>
								</div>
								<Typography className={classes.welcomeText}>
									{i18n.t("chat.noTicketMessage")}
								</Typography>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default TicketsCustom;
