import React from "react";

import Paper from "@material-ui/core/Paper";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Skeleton from "@material-ui/lab/Skeleton";

import { makeStyles } from "@material-ui/core/styles";

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import moment from 'moment';

import Rating from '@material-ui/lab/Rating';
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	on: {
		color: theme.palette.success.main,
		fontSize: '20px'
	},
	off: {
		color: theme.palette.error.main,
		fontSize: '20px'
	},
    pointer: {
        cursor: "pointer"
    },
	tableHeadCell: {
		backgroundColor: theme.palette.background.paper,
		color: theme.palette.text.primary,
		fontWeight: 600,
		fontSize: "0.8125rem",
		borderBottom: `1px solid ${theme.palette.divider}`,
	},
	tableCell: {
		fontSize: "0.8125rem",
		color: theme.palette.text.secondary,
		borderColor: theme.palette.divider,
	},
	ratingStars: {
		color: theme.palette.warning.main,
		"& .MuiRating-iconEmpty .MuiSvgIcon-root": {
			color: theme.palette.action.disabled,
		},
	},
	tableRowHover: {
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
	},
	tableContainer: {
		backgroundColor: theme.palette.background.paper,
		boxShadow: "none",
	},
}));

export function RatingBox ({ rating }) {
    const classes = useStyles();
    const ratingTrunc = rating === null ? 0 : Math.trunc(rating);
    return <Rating
        className={classes.ratingStars}
        defaultValue={ratingTrunc}
        max={3}
        readOnly
    />
}

export default function TableAttendantsStatus(props) {
    const { loading, attendants } = props
	const classes = useStyles();

    function renderList () {
        return attendants.map((a, k) => (
            <TableRow key={k} className={classes.tableRowHover}>
                <TableCell className={classes.tableCell}>{a.name}</TableCell>
                <TableCell align="center" title={i18n.t("dashboard.onlineTable.ratingLabel")} className={`${classes.pointer} ${classes.tableCell}`}>
                    <RatingBox rating={a.rating} />
                </TableCell>
                <TableCell align="center" className={classes.tableCell}>{formatTime(a.avgSupportTime, 2)}</TableCell>
                <TableCell align="center" className={classes.tableCell}>
                    { a.online ?
                        <CheckCircleIcon className={classes.on} />
                        : <ErrorIcon className={classes.off} />
                    }
                </TableCell>
            </TableRow>
        ))
    }

	function formatTime(minutes){
		return moment().startOf('day').add(minutes, 'minutes').format('HH[h] mm[m]');
	}

    return ( !loading ?
        <TableContainer component={Paper} className={classes.tableContainer}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell className={classes.tableHeadCell}>{i18n.t("dashboard.onlineTable.name")}</TableCell>
                        <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("dashboard.onlineTable.ratings")}</TableCell>
                        <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("dashboard.onlineTable.avgSupportTime")}</TableCell>
                        <TableCell align="center" className={classes.tableHeadCell}>{i18n.t("dashboard.onlineTable.status")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    { renderList() }
                </TableBody>
            </Table>
        </TableContainer>
        : <Skeleton variant="rect" height={150} />
    )
}