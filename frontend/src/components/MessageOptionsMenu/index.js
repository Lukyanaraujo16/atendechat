import React, { useState, useContext } from "react";

import MenuItem from "@material-ui/core/MenuItem";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import { Menu } from "@material-ui/core";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import useStickers from "../../hooks/useStickers";

function isStickerMessage(message) {
	if (!message?.mediaUrl) return false;
	if (message.mediaType === "sticker") return true;
	return (
		message.mediaType === "image" &&
		String(message.body || "").toLowerCase() === "sticker"
	);
}

const MessageOptionsMenu = ({ message, menuOpen, handleClose, anchorEl }) => {
	const { setReplyingMessage } = useContext(ReplyMessageContext);
	const { user } = useContext(AuthContext);
	const { saveStickerFromMessage } = useStickers();
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [savingSticker, setSavingSticker] = useState(false);

	const canManageStickers =
		user?.profile === "admin" || user?.profile === "supervisor";
	const showSaveSticker =
		canManageStickers && message && isStickerMessage(message);

	const handleDeleteMessage = async () => {
		try {
			await api.delete(`/messages/${message.id}`);
		} catch (err) {
			toastError(err);
		}
	};

	const hanldeReplyMessage = () => {
		setReplyingMessage(message);
		handleClose();
	};

	const handleOpenConfirmationModal = e => {
		setConfirmationOpen(true);
		handleClose();
	};

	const handleSaveSticker = async () => {
		if (!message?.id || savingSticker) return;
		setSavingSticker(true);
		try {
			const result = await saveStickerFromMessage(message.id);
			if (result?.duplicate) {
				showSuccessToast("messageOptionsMenu.saveStickerDuplicate");
			} else {
				showSuccessToast("messageOptionsMenu.saveStickerSuccess");
			}
			handleClose();
		} catch (err) {
			toastError(err);
		} finally {
			setSavingSticker(false);
		}
	};

	return (
		<>
			<ConfirmationModal
				title={i18n.t("messageOptionsMenu.confirmationModal.title")}
				open={confirmationOpen}
				onClose={setConfirmationOpen}
				onConfirm={handleDeleteMessage}
			>
				{i18n.t("messageOptionsMenu.confirmationModal.message")}
			</ConfirmationModal>
			<Menu
				anchorEl={anchorEl}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuOpen}
				onClose={handleClose}
			>
				{message.fromMe && (
					<MenuItem onClick={handleOpenConfirmationModal}>
						{i18n.t("messageOptionsMenu.delete")}
					</MenuItem>
				)}
				<MenuItem onClick={hanldeReplyMessage}>
					{i18n.t("messageOptionsMenu.reply")}
				</MenuItem>
				{showSaveSticker ? (
					<MenuItem onClick={handleSaveSticker} disabled={savingSticker}>
						{i18n.t("messageOptionsMenu.saveSticker")}
					</MenuItem>
				) : null}
			</Menu>
		</>
	);
};

export default MessageOptionsMenu;
