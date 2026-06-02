import React, { useState, useEffect, useRef, useCallback } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
	createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";

const filterOptions = createFilterOptions({
	trim: true,
});

const stopDialogEvent = (e) => e.stopPropagation();

const TransferTicketModal = ({ modalOpen, onClose, ticketid }) => {
	const history = useHistory();
	const [options, setOptions] = useState([]);
	const [usersLoading, setUsersLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchDraft, setSearchDraft] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedUser, setSelectedUser] = useState(null);
	const isMounted = useRef(true);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		if (modalOpen) return undefined;
		setSearchDraft("");
		setSearchQuery("");
		setSelectedUser(null);
		setUsersLoading(false);
		return undefined;
	}, [modalOpen]);

	useEffect(() => {
		if (!modalOpen) return undefined;
		const t = setTimeout(() => setSearchQuery(searchDraft), 300);
		return () => clearTimeout(t);
	}, [searchDraft, modalOpen]);

	useEffect(() => {
		if (!modalOpen) {
			setUsersLoading(false);
			return undefined;
		}

		const trimmed = searchQuery.trim();
		if (trimmed.length < 3) {
			setUsersLoading(false);
			setOptions([]);
			return undefined;
		}

		let cancelled = false;
		setUsersLoading(true);

		const fetchUsers = async () => {
			try {
				const { data } = await api.get("/users/transfer-list", {
					params: { searchParam: trimmed },
				});
				if (!cancelled) {
					setOptions(Array.isArray(data.users) ? data.users : []);
				}
			} catch (err) {
				if (!cancelled) toastError(err);
			} finally {
				if (!cancelled) setUsersLoading(false);
			}
		};

		fetchUsers();

		return () => {
			cancelled = true;
		};
	}, [searchQuery, modalOpen]);

	const handleClose = () => {
		onClose();
	};

	const handleSearchInputChange = useCallback((e) => {
		setSearchDraft(e.target.value);
		if (selectedUser) {
			setSelectedUser(null);
		}
	}, [selectedUser]);

	const renderAutocompleteInput = useCallback(
		(params) => (
			<TextField
				{...params}
				label={i18n.t("transferTicketModal.fieldLabel")}
				variant="outlined"
				required
				autoComplete="off"
				onChange={handleSearchInputChange}
				onMouseDown={stopDialogEvent}
				onClick={stopDialogEvent}
				onFocus={stopDialogEvent}
				inputProps={{
					...params.inputProps,
					autoComplete: "off",
				}}
				InputProps={{
					...params.InputProps,
					endAdornment: (
						<React.Fragment>
							{usersLoading ? (
								<CircularProgress color="inherit" size={20} />
							) : null}
							{params.InputProps.endAdornment}
						</React.Fragment>
					),
				}}
			/>
		),
		[handleSearchInputChange, usersLoading]
	);

	const handleSaveTicket = async e => {
		e.preventDefault();
		if (!ticketid || !selectedUser) return;
		setSaving(true);
		try {
			await api.put(`/tickets/${ticketid}`, {
				userId: selectedUser.id,
				queueId: null,
				status: "pending",
				chatbot: false,
				queueOptionId: null,
				useIntegration: false,
				integrationId: null,
				promptId: null,
			});
			setSaving(false);
			history.push(`/tickets`);
		} catch (err) {
			setSaving(false);
			toastError(err);
		}
	};

	return (
		<Dialog
			open={modalOpen}
			onClose={handleClose}
			maxWidth="lg"
			scroll="paper"
			disableEnforceFocus
			disableAutoFocus
			disableRestoreFocus
			keepMounted
		>
			<form onSubmit={handleSaveTicket}>
				<DialogTitle id="form-dialog-title">
					{i18n.t("transferTicketModal.title")}
				</DialogTitle>
				<DialogContent
					dividers
					onMouseDown={stopDialogEvent}
					onClick={stopDialogEvent}
				>
					<Autocomplete
						style={{ width: 300 }}
						value={selectedUser}
						getOptionLabel={option =>
							typeof option === "string" ? option : `${option.name || ""}`
						}
						onChange={(_e, newValue) => {
							if (newValue && typeof newValue === "object") {
								setSelectedUser(newValue);
								setSearchDraft(newValue.name || "");
							} else {
								setSelectedUser(null);
							}
						}}
						options={options}
						filterOptions={filterOptions}
						freeSolo
						autoHighlight
						disablePortal
						blurOnSelect={false}
						clearOnBlur={false}
						handleHomeEndKeys={false}
						noOptionsText={i18n.t("transferTicketModal.noOptions")}
						loading={usersLoading}
						renderInput={renderAutocompleteInput}
					/>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={handleClose}
						color="secondary"
						disabled={saving}
						variant="outlined"
					>
						{i18n.t("transferTicketModal.buttons.cancel")}
					</Button>
					<ButtonWithSpinner
						variant="contained"
						type="submit"
						color="primary"
						loading={saving}
					>
						{i18n.t("transferTicketModal.buttons.ok")}
					</ButtonWithSpinner>
				</DialogActions>
			</form>
		</Dialog>
	);
};

export default TransferTicketModal;
