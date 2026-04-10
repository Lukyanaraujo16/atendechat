import React, { useEffect, useRef, useState } from "react";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { useBranding } from "../../context/Branding/BrandingContext";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import PlatformPageHeader from "./PlatformPageHeader";

const ACCEPT_IMAGES = "image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,.svg";

export default function PlatformBranding() {
  const { branding, refreshBranding, resolveLoginLogo, resolveMenuLogo } = useBranding();
  const [systemName, setSystemName] = useState("");
  const [loginFile, setLoginFile] = useState(null);
  const [menuFile, setMenuFile] = useState(null);
  const [loginPreviewUrl, setLoginPreviewUrl] = useState(null);
  const [menuPreviewUrl, setMenuPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const loginInputRef = useRef(null);
  const menuInputRef = useRef(null);

  useEffect(() => {
    setSystemName(branding.systemName || "");
  }, [branding.systemName]);

  useEffect(() => {
    if (!loginFile) {
      setLoginPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(loginFile);
    setLoginPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [loginFile]);

  useEffect(() => {
    if (!menuFile) {
      setMenuPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(menuFile);
    setMenuPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [menuFile]);

  const loginImgSrc = loginPreviewUrl || resolveLoginLogo();
  const menuImgSrc = menuPreviewUrl || resolveMenuLogo();

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("systemName", systemName);
      if (loginFile) fd.append("loginLogo", loginFile);
      if (menuFile) fd.append("menuLogo", menuFile);
      await api.post("/system-settings/branding", fd);
      setLoginFile(null);
      setMenuFile(null);
      await refreshBranding();
      toast.success(i18n.t("platform.branding.saved"));
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const restoreLoginDefault = async () => {
    try {
      await api.post("/system-settings", { branding: { loginLogoUrl: "" } });
      setLoginFile(null);
      await refreshBranding();
      toast.success(i18n.t("platform.branding.saved"));
    } catch (e) {
      toastError(e);
    }
  };

  const restoreMenuDefault = async () => {
    try {
      await api.post("/system-settings", { branding: { menuLogoUrl: "" } });
      setMenuFile(null);
      await refreshBranding();
      toast.success(i18n.t("platform.branding.saved"));
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <MainContainer>
      <PlatformPageHeader
        titleKey="platform.branding.title"
        subtitleKey="platform.branding.subtitle"
      />
      <Box maxWidth={560}>
        <TextField
          label={i18n.t("platform.branding.systemName")}
          fullWidth
          margin="normal"
          variant="outlined"
          size="small"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
        />

        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            {i18n.t("platform.branding.loginLogo")}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
            {i18n.t("platform.branding.uploadHint")}
          </Typography>
          <Box display="flex" alignItems="center" flexWrap="wrap" mt={1} style={{ gap: 8 }}>
            <img
              src={loginImgSrc}
              alt=""
              style={{ maxHeight: 72, maxWidth: 220, objectFit: "contain", border: "1px solid #eee", borderRadius: 4 }}
            />
            <input
              ref={loginInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                setLoginFile(f || null);
                e.target.value = "";
              }}
            />
            <Button size="small" variant="outlined" onClick={() => loginInputRef.current?.click()}>
              {i18n.t("platform.branding.chooseFile")}
            </Button>
            <Button size="small" onClick={restoreLoginDefault}>
              {i18n.t("platform.branding.restoreDefault")}
            </Button>
          </Box>
          <Typography
            variant="caption"
            color="textSecondary"
            component="div"
            style={{ marginTop: 12, lineHeight: 1.55, whiteSpace: "pre-line" }}
          >
            {i18n.t("platform.branding.loginLogoHint")}
          </Typography>
        </Box>

        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>
            {i18n.t("platform.branding.menuLogo")}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
            {i18n.t("platform.branding.uploadHint")}
          </Typography>
          <Box display="flex" alignItems="center" flexWrap="wrap" mt={1} style={{ gap: 8 }}>
            <img
              src={menuImgSrc}
              alt=""
              style={{ maxHeight: 72, maxWidth: 220, objectFit: "contain", border: "1px solid #eee", borderRadius: 4 }}
            />
            <input
              ref={menuInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                setMenuFile(f || null);
                e.target.value = "";
              }}
            />
            <Button size="small" variant="outlined" onClick={() => menuInputRef.current?.click()}>
              {i18n.t("platform.branding.chooseFile")}
            </Button>
            <Button size="small" onClick={restoreMenuDefault}>
              {i18n.t("platform.branding.restoreDefault")}
            </Button>
          </Box>
          <Typography
            variant="caption"
            color="textSecondary"
            component="div"
            style={{ marginTop: 12, lineHeight: 1.55, whiteSpace: "pre-line" }}
          >
            {i18n.t("platform.branding.menuLogoHint")}
          </Typography>
        </Box>

        <Box mt={3}>
          <Button variant="contained" color="primary" disabled={saving} onClick={handleSave}>
            {i18n.t("platform.branding.save")}
          </Button>
        </Box>
      </Box>
    </MainContainer>
  );
}
