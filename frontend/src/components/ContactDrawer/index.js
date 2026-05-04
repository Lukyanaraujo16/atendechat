import React, { useEffect, useState, useContext, useMemo } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import CreateIcon from '@material-ui/icons/Create';

import { i18n } from "../../translate/i18n";

import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import { CardHeader } from "@material-ui/core";
import { ContactForm } from "../ContactForm";
import ContactModal from "../ContactModal";
import { ContactNotes } from "../ContactNotes";
import usePlanFlags from "../../hooks/usePlanFlags";
import CrmDealFormDialog from "../Crm/CrmDealFormDialog";
import CrmOpenDealsChoiceDialog from "../Crm/CrmOpenDealsChoiceDialog";
import ContactCrmSection from "../ContactCrmSection";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getCrmTerminology } from "../../utils/crmTerminology";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
	drawer: {
		width: drawerWidth,
		flexShrink: 0,
	},
	drawerPaper: {
		width: drawerWidth,
		display: "flex",
		borderTop: "1px solid rgba(0, 0, 0, 0.12)",
		borderRight: "1px solid rgba(0, 0, 0, 0.12)",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		borderTopRightRadius: 4,
		borderBottomRightRadius: 4,
	},
	header: {
		display: "flex",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		backgroundColor: theme.palette.contactdrawer, //DARK MODE PLW DESIGN//
		alignItems: "center",
		padding: theme.spacing(0, 1),
		minHeight: "73px",
		justifyContent: "flex-start",
	},
	content: {
		display: "flex",
		backgroundColor: theme.palette.contactdrawer, //DARK MODE PLW DESIGN//
		flexDirection: "column",
		padding: "8px 0px 8px 8px",
		height: "100%",
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},

	contactAvatar: {
		margin: 15,
		width: 100,
		height: 100,
	},

	contactHeader: {
		display: "flex",
		padding: 8,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		"& > *": {
			margin: 4,
		},
	},

	contactDetails: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	contactExtraInfo: {
		marginTop: 4,
		padding: 6,
	},
}));

const ContactDrawer = ({
	open,
	handleDrawerClose,
	contact,
	ticket,
	loading,
	crmPanelRefreshKey = 0,
	onCrmPanelDataChanged,
}) => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	const crmTerms = useMemo(
		() => getCrmTerminology(user?.company?.businessSegment),
		[user?.company?.businessSegment]
	);
	const planFlags = usePlanFlags();
	const fx = planFlags.effectiveFeatures || {};

	const [modalOpen, setModalOpen] = useState(false);
	const [openForm, setOpenForm] = useState(false);
	const [crmDialogOpen, setCrmDialogOpen] = useState(false);
	const [crmDialogDealId, setCrmDialogDealId] = useState(null);
	const [crmDupOpen, setCrmDupOpen] = useState(false);
	const [crmDupDeals, setCrmDupDeals] = useState([]);

	const handleRequestAddCrm = async () => {
		if (!contact?.id) return;
		try {
			const { data } = await api.get(`/crm/deals/by-contact/${contact.id}`);
			const openList = (Array.isArray(data) ? data : []).filter((d) => d.status === "open");
			if (openList.length > 0) {
				setCrmDupDeals(openList);
				setCrmDupOpen(true);
				return;
			}
		} catch (e) {
			toastError(e);
			return;
		}
		setCrmDialogDealId(null);
		setCrmDialogOpen(true);
	};

	const handleCrmSaved = () => {
		setCrmDialogOpen(false);
		setCrmDialogDealId(null);
		if (typeof onCrmPanelDataChanged === "function") {
			onCrmPanelDataChanged();
		}
	};

	useEffect(() => {
		setOpenForm(false);
	}, [open, contact]);

	return (
		<>
			<Drawer
				className={classes.drawer}
				variant="persistent"
				anchor="right"
				open={open}
				PaperProps={{ style: { position: "absolute" } }}
				BackdropProps={{ style: { position: "absolute" } }}
				ModalProps={{
					container: document.getElementById("drawer-container"),
					style: { position: "absolute" },
				}}
				classes={{
					paper: classes.drawerPaper,
				}}
			>
				<div className={classes.header}>
					<IconButton onClick={handleDrawerClose}>
						<CloseIcon />
					</IconButton>
					<Typography style={{ justifySelf: "center" }}>
						{i18n.t("contactDrawer.header")}
					</Typography>
				</div>
				{loading ? (
					<ContactDrawerSkeleton classes={classes} />
				) : (
					<div className={classes.content}>
						<Paper square variant="outlined" className={classes.contactHeader}>
							<CardHeader
								onClick={() => {}}
								style={{ cursor: "pointer", width: '100%' }}
								titleTypographyProps={{ noWrap: true }}
								subheaderTypographyProps={{ noWrap: true }}
								avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" style={{ width: 60, height: 60 }} />}
								title={
									<>
										<Typography onClick={() => setOpenForm(true)}>
											{contact.name}
											<CreateIcon style={{fontSize: 16, marginLeft: 5}} />
										</Typography>
									</>
								}
								subheader={
									<>
										<Typography style={{fontSize: 12}}>
											{contact.number === "LID" ? (
												i18n.t("contactDrawer.hiddenNumber")
											) : (
												<Link href={`tel:${contact.number}`}>{contact.number}</Link>
											)}
										</Typography>
										<Typography style={{fontSize: 12}}>
											<Link href={`mailto:${contact.email}`}>{contact.email}</Link>
										</Typography>
									</>
								}
							/>
							<Button
								variant="outlined"
								color="primary"
								onClick={() => setModalOpen(!openForm)}
								style={{fontSize: 12}}
							>
								{i18n.t("contactDrawer.buttons.edit")}
							</Button>
							{contact?.id && fx["crm.pipeline"] === true ? (
								<Button
									variant="outlined"
									color="primary"
									onClick={handleRequestAddCrm}
									style={{ fontSize: 12, marginTop: 8 }}
								>
									{i18n.t("crm.contact.createOpportunity")}
								</Button>
							) : null}
							{(contact.id && openForm) && <ContactForm initialContact={contact} onCancel={() => setOpenForm(false)} />}
						</Paper>
						{contact?.id && fx["crm.pipeline"] === true ? (
							<Paper square variant="outlined" className={classes.contactDetails}>
								<ContactCrmSection
									contactId={contact.id}
									refreshKey={crmPanelRefreshKey}
									terminology={crmTerms}
									onOpenDealEdit={(id) => {
										setCrmDialogDealId(id);
										setCrmDialogOpen(true);
									}}
									onCreateCrm={handleRequestAddCrm}
								/>
							</Paper>
						) : null}
						<Paper square variant="outlined" className={classes.contactDetails}>
							<Typography variant="subtitle1" style={{marginBottom: 10}}>
								{i18n.t("ticketOptionsMenu.appointmentsModal.title")}
							</Typography>
							<ContactNotes ticket={ticket} />
						</Paper>
						<Paper square variant="outlined" className={classes.contactDetails}>
							<ContactModal
								open={modalOpen}
								onClose={() => setModalOpen(false)}
								contactId={contact.id}
							></ContactModal>
							<Typography variant="subtitle1">
								{i18n.t("contactDrawer.extraInfo")}
							</Typography>
							{(Array.isArray(contact?.extraInfo) ? contact.extraInfo : []).map(info => (
								<Paper
									key={info.id}
									square
									variant="outlined"
									className={classes.contactExtraInfo}
								>
									<InputLabel>{info.name}</InputLabel>
									<Typography component="div" noWrap style={{ paddingTop: 2 }}>
										<MarkdownWrapper>{info.value}</MarkdownWrapper>
									</Typography>
								</Paper>
							))}
						</Paper>
					</div>
				)}
			</Drawer>
			<CrmDealFormDialog
				open={crmDialogOpen}
				onClose={() => {
					setCrmDialogOpen(false);
					setCrmDialogDealId(null);
				}}
				dealId={crmDialogDealId}
				terminology={crmTerms}
				defaults={
					crmDialogDealId
						? {}
						: {
								title: contact?.name || "",
								contactId: contact?.id,
								ticketId: ticket?.id,
								source: "whatsapp",
						  }
				}
				onSaved={handleCrmSaved}
			/>
			<CrmOpenDealsChoiceDialog
				open={crmDupOpen}
				onClose={() => setCrmDupOpen(false)}
				deals={crmDupDeals}
				onSelectDeal={(id) => {
					setCrmDupOpen(false);
					setCrmDialogDealId(id);
					setCrmDialogOpen(true);
				}}
				onCreateNew={() => {
					setCrmDupOpen(false);
					setCrmDialogDealId(null);
					setCrmDialogOpen(true);
				}}
			/>
		</>
	);
};

export default ContactDrawer;
