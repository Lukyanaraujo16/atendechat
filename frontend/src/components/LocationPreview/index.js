import React from "react";
import { Button, Divider, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import {
  isAbsoluteHttpUrl,
  isDataImageUri,
} from "../../utils/messages/parseWhatsAppLocationBody";

function isSafeMapsUrl(link) {
  return isAbsoluteHttpUrl(link);
}

function isSafeThumbnail(image) {
  const value = String(image || "").trim();
  if (!value) return false;
  if (isDataImageUri(value)) return true;
  if (!isAbsoluteHttpUrl(value)) return false;
  if (/maps\.google|google\.[^/]+\/maps/i.test(value)) return false;
  return /\.(png|jpe?g|gif|webp|bmp)(\?|#|$)/i.test(value);
}

const LocationPreview = ({ image, link, description }) => {
  const mapsUrl = isSafeMapsUrl(link) ? String(link).trim() : null;
  const thumbnail = isSafeThumbnail(image) ? String(image).trim() : null;
  const descriptionText = String(description || "").trim();

  const handleLocation = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!mapsUrl) return;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      data-testid="chat-location-preview"
      style={{ minWidth: "250px" }}
    >
      {thumbnail ? (
        <div style={{ float: "left" }}>
          <img
            src={thumbnail}
            alt="loc"
            onClick={handleLocation}
            style={{ width: "100px", cursor: mapsUrl ? "pointer" : "default" }}
          />
        </div>
      ) : (
        <Typography
          variant="subtitle1"
          color="primary"
          style={{ padding: "8px 12px 0" }}
        >
          {i18n.t("locationPreview.title")}
        </Typography>
      )}
      {descriptionText ? (
        <Typography
          style={{
            marginTop: "12px",
            marginLeft: "15px",
            marginRight: "15px",
            whiteSpace: "pre-wrap",
          }}
          variant="subtitle1"
          color="primary"
          gutterBottom
        >
          {descriptionText}
        </Typography>
      ) : null}
      <div style={{ display: "block", content: "", clear: "both" }}></div>
      <Divider />
      <Button
        data-testid="chat-location-open"
        fullWidth
        color="primary"
        onClick={handleLocation}
        disabled={!mapsUrl}
      >
        {i18n.t("locationPreview.button")}
      </Button>
    </div>
  );
};

export default LocationPreview;
