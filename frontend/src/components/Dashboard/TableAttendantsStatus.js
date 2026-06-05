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
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import PeopleIcon from "@material-ui/icons/People";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { MobileEntityCard, MobileCardList } from "../../ui";

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
	mobileCardChips: {
		display: "flex",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		maxWidth: "100%",
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
	const isMobile = useIsMobile();

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

	if (isMobile) {
		if (loading) {
			return <Skeleton variant="rect" height={150} />;
		}
		if (!attendants?.length) {
			return (
				<Typography color="textSecondary" align="center" style={{ padding: 24 }}>
					{i18n.t("dashboard.mobile.noData")}
				</Typography>
			);
		}
		return (
			<MobileCardList>
				{attendants.map((a, k) => (
					<MobileEntityCard
						key={k}
						leading={<PeopleIcon color="action" />}
						title={a.name}
						subtitle={
							a.online
								? i18n.t("dashboard.mobile.statusOnline")
								: i18n.t("dashboard.mobile.statusOffline")
						}
					>
						<Box className={classes.mobileCardChips}>
							<Chip
								size="small"
								variant="outlined"
								label={i18n.t("dashboard.onlineTable.ratings")}
							/>
							<RatingBox rating={a.rating} />
							<Chip
								size="small"
								variant="outlined"
								label={`${i18n.t("dashboard.onlineTable.avgSupportTime")}: ${formatTime(a.avgSupportTime, 2)}`}
							/>
						</Box>
					</MobileEntityCard>
				))}
			</MobileCardList>
		);
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