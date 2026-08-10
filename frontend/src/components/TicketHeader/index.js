import React from "react";
import clsx from "clsx";

import { Card } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import { PANEL_RADIUS, getSubtleBorder, getChatHeaderSurface } from "../../theme/ticketPanelStyles";

const useStyles = makeStyles((theme) => {
	return {
		ticketHeader: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "nowrap",
			flexShrink: 0,
			width: "100%",
			maxWidth: "100%",
			minWidth: 0,
			height: "auto",
			backgroundColor: getChatHeaderSurface(theme),
			minHeight: 56,
			padding: theme.spacing(0, 0.5, 0, 0),
			borderBottom: getSubtleBorder(theme),
			borderTop: "none",
			borderTopRightRadius: PANEL_RADIUS,
			borderTopLeftRadius: PANEL_RADIUS,
			boxShadow: "none",
			overflow: "hidden",
			boxSizing: "border-box",
			[theme.breakpoints.down("md")]: {
				// Mobile: uma linha estável — sem wrap que provoca sobreposição
				flexWrap: "nowrap",
				alignItems: "stretch",
				minHeight: 52,
				maxHeight: 64,
				padding: theme.spacing(0.25, 0.25, 0.25, 0),
			},
		},
		ticketHeaderCompact: {
			minHeight: 56,
			[theme.breakpoints.down("md")]: {
				minHeight: 52,
				maxHeight: 56,
			},
		},
	};
});


const TicketHeader = ({ loading, children, compact = false }) => {
	const classes = useStyles();

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card
					elevation={0}
					className={clsx(classes.ticketHeader, {
						[classes.ticketHeaderCompact]: compact,
					})}
					data-ticket-header
				>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
