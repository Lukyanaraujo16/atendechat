import { makeStyles } from "@material-ui/core/styles";
import React from "react";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
	tag: {
		padding: "1px 5px",
		borderRadius: 3,
		fontSize: "0.8em",
		fontWeight: "bold",
		color: "#FFF",
		marginRight: theme.spacing(0.75),
		whiteSpace: "nowrap",
	},
	tagLite: {
		padding: theme.spacing(0.25, 0.75),
		borderRadius: 6,
		fontSize: "0.65rem",
		fontWeight: 600,
		letterSpacing: "0.02em",
		marginRight: theme.spacing(0.5),
		marginTop: 0,
		opacity: 0.95,
		boxShadow: "0 1px 2px rgba(0,0,0,0.07)",
	},
}));

const ContactTag = ({ tag, variant = "default" }) => {
	const classes = useStyles();

	return (
		<div
			className={clsx(classes.tag, variant === "lite" && classes.tagLite)}
			style={{ backgroundColor: tag.color }}
		>
			{tag.name.toUpperCase()}
		</div>
	);
};

export default ContactTag;