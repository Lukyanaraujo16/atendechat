import React from "react";

import { Card } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "nowrap",
		backgroundColor: theme.palette.background.paper,
		flex: "none",
		minHeight: 56,
		padding: theme.spacing(0, 0.5, 0, 0),
		borderBottom: `1px solid ${theme.palette.divider}`,
		boxShadow: theme.palette.type === "dark" ? "none" : "0 1px 0 rgba(0,0,0,0.04)",
		[theme.breakpoints.down("sm")]: {
			flexWrap: "wrap",
		},
	},
}));


const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card square className={classes.ticketHeader}>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
