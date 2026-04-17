import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
	Button,
	TableBody,
	TableRow,
	TableCell,
	IconButton,
	Table,
	TableHead,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
	Box,
	Chip,
} from "@material-ui/core";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { AppTableContainer, AppEmptyState } from "../../ui";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},
	guideBox: {
		padding: theme.spacing(2),
		marginBottom: theme.spacing(2),
		backgroundColor: theme.palette.type === "light" ? "#f5f5f5" : "rgba(255,255,255,0.06)",
		borderRadius: theme.shape.borderRadius,
		border: `1px solid ${theme.palette.divider}`,
	},
	guideTitle: {
		fontWeight: 600,
		marginBottom: theme.spacing(1),
	},
	guideStep: {
		marginBottom: theme.spacing(0.5),
		paddingLeft: theme.spacing(1),
	},
	statusCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing(1),
	},
	customTableCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	tooltip: {
		backgroundColor: "#f5f5f9",
		color: "rgba(0, 0, 0, 0.87)",
		fontSize: theme.typography.pxToRem(14),
		border: "1px solid #dadde9",
		maxWidth: 450,
	},
	tooltipPopper: {
		textAlign: "center",
	},
	buttonProgress: {
		color: green[500],
	},
	connectionName: {
		fontWeight: 600,
		textAlign: "left",
	},
	tableHeadCell: {
		fontWeight: 600,
		backgroundColor: "rgba(0,0,0,0.02)",
	},
}));

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<React.Fragment>
					<Typography gutterBottom color="inherit">
						{title}
					</Typography>
					{content && <Typography>{content}</Typography>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

const Connections = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		return (
			<>
				{whatsApp.status === "qrcode" && (
					<Button
						size="small"
						variant="contained"
						color="primary"
						onClick={() => handleOpenQrModal(whatsApp)}
					>
						{i18n.t("connections.buttons.qrcode")}
					</Button>
				)}
				{(whatsApp.status === "DISCONNECTED" ||
					whatsApp.status === "PENDING") && (
					<>
						<Button
							size="small"
							variant="outlined"
							color="primary"
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							{i18n.t("connections.buttons.tryAgain")}
						</Button>{" "}
						<Button
							size="small"
							variant="outlined"
							color="secondary"
							onClick={() => handleRequestNewQrCode(whatsApp.id)}
						>
							{i18n.t("connections.buttons.newQr")}
						</Button>
					</>
				)}
				{(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<Button
						size="small"
						variant="outlined"
						color="secondary"
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
				{whatsApp.status === "OPENING" && (
					<Button size="small" variant="outlined" disabled color="default">
						{i18n.t("connections.buttons.connecting")}
					</Button>
				)}
			</>
		);
	};

	const getStatusLabel = (status) => {
		const key = status === "qrcode" ? "qrcode" : status;
		const label = i18n.t(`connections.statusLabel.${key}`);
		return typeof label === "string" && !label.startsWith("connections.") ? label : status;
	};

	const statusChipProps = status => {
		switch (status) {
			case "CONNECTED":
				return {
					variant: "default",
					style: { backgroundColor: green[100], color: green[900], fontWeight: 600 },
				};
			case "qrcode":
				return { color: "primary", variant: "outlined" };
			case "OPENING":
				return { color: "default", variant: "outlined" };
			case "DISCONNECTED":
			case "PENDING":
				return { color: "default", variant: "outlined" };
			case "TIMEOUT":
			case "PAIRING":
				return { color: "secondary", variant: "outlined" };
			default:
				return { color: "default", variant: "outlined" };
		}
	};

	const statusTooltip = status => {
		switch (status) {
			case "DISCONNECTED":
			case "PENDING":
				return {
					title: i18n.t("connections.toolTips.disconnected.title"),
					content: i18n.t("connections.toolTips.disconnected.content"),
				};
			case "qrcode":
				return {
					title: i18n.t("connections.toolTips.qrcode.title"),
					content: i18n.t("connections.toolTips.qrcode.content"),
				};
			case "CONNECTED":
				return {
					title: i18n.t("connections.toolTips.connected.title"),
					content: null,
				};
			case "TIMEOUT":
			case "PAIRING":
				return {
					title: i18n.t("connections.toolTips.timeout.title"),
					content: i18n.t("connections.toolTips.timeout.content"),
				};
			default:
				return { title: getStatusLabel(status), content: null };
		}
	};

	const renderStatusToolTips = whatsApp => {
		const statusLabel = getStatusLabel(whatsApp.status);
		const chip = statusChipProps(whatsApp.status);
		const tip = statusTooltip(whatsApp.status);
		const iconBefore =
			whatsApp.status === "OPENING" ? (
				<CircularProgress size={20} className={classes.buttonProgress} />
			) : whatsApp.status === "qrcode" ? (
				<CropFree fontSize="small" color="primary" />
			) : whatsApp.status === "CONNECTED" ? (
				<SignalCellular4Bar style={{ color: green[600] }} fontSize="small" />
			) : whatsApp.status === "DISCONNECTED" ||
			  whatsApp.status === "PENDING" ? (
				<SignalCellularConnectedNoInternet0Bar color="secondary" fontSize="small" />
			) : whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING" ? (
				<SignalCellularConnectedNoInternet2Bar color="secondary" fontSize="small" />
			) : null;

		const chipEl = (
			<Chip size="small" label={statusLabel} {...chip} />
		);

		return (
			<div className={classes.statusCell}>
				{iconBefore}
				{tip.content ? (
					<CustomToolTip title={tip.title} content={tip.content}>
						<span>{chipEl}</span>
					</CustomToolTip>
				) : (
					<Tooltip title={tip.title} arrow>
						<span>{chipEl}</span>
					</Tooltip>
				)}
			</div>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>
			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>
			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
			/>
			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Can
						role={user.profile}
						perform="connections-page:addConnection"
						yes={() => (
							<Button
								variant="contained"
								color="primary"
								onClick={handleOpenWhatsAppModal}
							>
								{i18n.t("connections.buttons.add")}
							</Button>
						)}
					/>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={classes.mainPaper} variant="outlined">
				<Box className={classes.guideBox}>
					<Typography className={classes.guideTitle} variant="subtitle1">
						{i18n.t("connections.guide.title")}
					</Typography>
					<Typography variant="body2" color="textSecondary" paragraph>
						{i18n.t("connections.guide.intro")}
					</Typography>
					<Typography className={classes.guideStep} variant="body2">
						1. {i18n.t("connections.guide.step1")}
					</Typography>
					<Typography className={classes.guideStep} variant="body2">
						2. {i18n.t("connections.guide.step2")}
					</Typography>
					<Typography className={classes.guideStep} variant="body2">
						3. {i18n.t("connections.guide.step3")}
					</Typography>
					<Typography className={classes.guideStep} variant="body2">
						4. {i18n.t("connections.guide.step4")}
					</Typography>
				</Box>
				<AppTableContainer nested>
					<Table size="small" stickyHeader>
					<TableHead>
						<TableRow>
							<TableCell align="left" className={classes.tableHeadCell}>
								{i18n.t("connections.table.name")}
							</TableCell>
							<TableCell align="center" className={classes.tableHeadCell}>
								{i18n.t("connections.table.status")}
							</TableCell>
							<Can
								role={user.profile}
								perform="connections-page:actionButtons"
								yes={() => (
									<TableCell align="center" className={classes.tableHeadCell}>
										{i18n.t("connections.table.session")}
									</TableCell>
								)}
							/>
							<TableCell align="center" className={classes.tableHeadCell}>
								{i18n.t("connections.table.lastUpdate")}
							</TableCell>
							<TableCell align="center" className={classes.tableHeadCell}>
								{i18n.t("connections.table.default")}
							</TableCell>
							<Can
								role={user.profile}
								perform="connections-page:editOrDeleteConnection"
								yes={() => (
									<TableCell align="center" className={classes.tableHeadCell}>
										{i18n.t("connections.table.actions")}
									</TableCell>
								)}
							/>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRowSkeleton />
						) : !whatsApps?.length ? (
							<TableRow>
								<TableCell colSpan={6} style={{ border: "none" }}>
									<AppEmptyState
										title={i18n.t("connections.table.emptyTitle")}
										description={i18n.t("connections.table.emptyHint")}
									/>
								</TableCell>
							</TableRow>
						) : (
							<>
								{whatsApps.map(whatsApp => (
										<TableRow key={whatsApp.id} hover>
											<TableCell align="left" className={classes.connectionName}>
												{whatsApp.name}
											</TableCell>
											<TableCell align="center">
												{renderStatusToolTips(whatsApp)}
											</TableCell>
											<Can
												role={user.profile}
												perform="connections-page:actionButtons"
												yes={() => (
													<TableCell align="center">
														{renderActionButtons(whatsApp)}
													</TableCell>
												)}
											/>
											<TableCell align="center">
												{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
											</TableCell>
											<TableCell align="center">
												{whatsApp.isDefault && (
													<div className={classes.customTableCell}>
														<CheckCircle style={{ color: green[500] }} />
													</div>
												)}
											</TableCell>
											<Can
												role={user.profile}
												perform="connections-page:editOrDeleteConnection"
												yes={() => (
													<TableCell align="center">
														<IconButton
															size="small"
															onClick={() => handleEditWhatsApp(whatsApp)}
														>
															<Edit />
														</IconButton>

														<IconButton
															size="small"
															onClick={e => {
																handleOpenConfirmationModal("delete", whatsApp.id);
															}}
														>
															<DeleteOutline />
														</IconButton>
													</TableCell>
												)}
											/>
										</TableRow>
									))}
							</>
						)}
					</TableBody>
					</Table>
				</AppTableContainer>
			</Paper>
		</MainContainer>
	);
};

export default Connections;
