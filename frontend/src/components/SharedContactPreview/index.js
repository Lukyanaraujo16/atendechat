import React from "react";
import { Typography } from "@material-ui/core";
import { Person } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import { parseSharedContact } from "../../utils/messages/parseSharedContact";

const SharedContactPreview = ({ body }) => {
  const contact = parseSharedContact(body);

  return (
    <div
      data-testid="chat-shared-contact"
      style={{
        minWidth: 220,
        maxWidth: 280,
        padding: "10px 12px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Person color="primary" data-testid="chat-shared-contact-icon" />
      <div>
        <Typography variant="subtitle1" color="primary">
          {contact.displayName}
        </Typography>
        {contact.phone ? (
          <Typography variant="body2" data-testid="chat-shared-contact-phone">
            {contact.phone}
          </Typography>
        ) : (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("sharedContactPreview.noPhone")}
          </Typography>
        )}
      </div>
    </div>
  );
};

export default SharedContactPreview;
