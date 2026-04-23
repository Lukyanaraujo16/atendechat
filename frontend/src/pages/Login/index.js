import React, { useEffect, useMemo, useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { versionSystem } from "../../../package.json";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useBranding } from "../../context/Branding/BrandingContext";
import {
	LanguageOutlined,
	Visibility,
	VisibilityOff,
	WhatsApp,
} from "@material-ui/icons";
import {
	Checkbox,
	CircularProgress,
	Fab,
	FormControlLabel,
	IconButton,
	InputAdornment,
	Menu,
	MenuItem,
} from "@material-ui/core";
import LanguageControl from "../../components/LanguageControl";


const Copyright = ({ brandName, classes }) => {
	return (
		<Typography variant="body2" className={classes.copyrightText} align="center">
			{"Copyright "}
			<Link className={classes.copyrightLink} href="#">
				{brandName} - v {versionSystem}
			</Link>{" "}
			{new Date().getFullYear()}
			{"."}
		</Typography>
	);
};

const useStyles = makeStyles((theme) => ({
	root: {
		width: "100vw",
		height: "100vh",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		position: "relative",
		backgroundColor: theme.palette.background.default,
		color: theme.palette.text.primary,
		[theme.breakpoints.down("sm")]: {
			padding: theme.spacing(2),
		},
	},
	card: {
		width: "100%",
		maxWidth: 420,
		backgroundColor: theme.palette.background.paper,
		borderRadius: 8,
		border: `1px solid ${theme.palette.divider}`,
		boxShadow:
			theme.palette.type === "dark"
				? "0 8px 32px rgba(0,0,0,0.55)"
				: "0 8px 24px rgba(0,0,0,0.12)",
		padding: theme.spacing(4, 4, 3),
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		[theme.breakpoints.down("sm")]: {
			padding: theme.spacing(3, 2.5, 2.5),
		},
	},
	logoWrap: {
		width: "100%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: theme.spacing(2.5),
	},
	form: {
		width: "100%",
		maxWidth: 360,
	},
	logo: {
		maxWidth: 260,
		width: "100%",
		height: "auto",
		objectFit: "contain",
	},
	input: {
		"& .MuiOutlinedInput-root": {
			borderRadius: 4,
			backgroundColor:
				theme.palette.type === "dark"
					? "rgba(255,255,255,0.06)"
					: theme.palette.grey[50],
		},
		"& .MuiOutlinedInput-notchedOutline": {
			borderColor: theme.palette.divider,
		},
		"& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
			borderColor: theme.palette.text.secondary,
		},
		"& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
			borderColor: theme.palette.primary.main,
		},
		"& .MuiInputLabel-outlined": {
			color: theme.palette.text.secondary,
		},
		"& .MuiInputLabel-outlined.Mui-focused": {
			color: theme.palette.primary.main,
		},
		"& .MuiOutlinedInput-input": {
			color: theme.palette.text.primary,
		},
		"& .MuiIconButton-root": {
			color: theme.palette.action.active,
		},
	},
	submit: {
		margin: theme.spacing(2.5, 0, 1.5),
		borderRadius: 4,
		fontWeight: 700,
		padding: "10px 0",
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.primary.contrastText,
		boxShadow:
			theme.palette.type === "dark"
				? "0 8px 20px rgba(36, 199, 118, 0.35)"
				: "0 8px 14px rgba(36, 199, 118, 0.35)",
		"&:hover": {
			backgroundColor: theme.palette.primary.dark,
		},
	},
	linksWrap: {
		width: "100%",
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(0.75),
		marginTop: theme.spacing(1),
	},
	linkRow: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		color: theme.palette.primary.main,
		textDecoration: "none",
		fontSize: 13,
		fontWeight: 500,
		"&:hover": {
			color: theme.palette.primary.dark,
			textDecoration: "underline",
		},
	},
	rememberRow: {
		marginTop: theme.spacing(0.5),
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
	},
	rememberLabel: {
		"& .MuiFormControlLabel-label": {
			fontSize: 12.5,
			color: theme.palette.text.secondary,
		},
	},
	languageIcon: {
		color: theme.palette.action.active,
	},
	languageControl: {
		position: "absolute",
		top: 12,
		right: 12,
		zIndex: 1,
	},
	footer: {
		position: "absolute",
		bottom: 14,
		left: 0,
		right: 0,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: 6,
		padding: theme.spacing(0, 2),
		[theme.breakpoints.down("sm")]: {
			position: "static",
			marginTop: theme.spacing(2.5),
		},
	},
	footerLinks: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
		fontSize: 12.5,
		color: theme.palette.text.secondary,
		"& a": {
			color: theme.palette.text.secondary,
			textDecoration: "none",
		},
		"& a:hover": {
			color: theme.palette.primary.main,
			textDecoration: "underline",
		},
		"& span": {
			color: theme.palette.text.disabled,
			userSelect: "none",
		},
	},
	copyrightText: {
		color: theme.palette.text.secondary,
	},
	copyrightLink: {
		color: theme.palette.primary.main,
		fontWeight: 600,
		"&:hover": {
			color: theme.palette.primary.dark,
		},
	},
	supportWrap: {
		position: "fixed",
		right: 18,
		bottom: 18,
		display: "flex",
		alignItems: "center",
		gap: 10,
		zIndex: 1500,
	},
	supportBadge: {
		backgroundColor: theme.palette.background.paper,
		borderRadius: 4,
		padding: "6px 10px",
		boxShadow:
			theme.palette.type === "dark"
				? "0 6px 16px rgba(0,0,0,0.5)"
				: "0 6px 14px rgba(0,0,0,0.12)",
		border: `1px solid ${theme.palette.divider}`,
		fontSize: 12.5,
		color: theme.palette.text.primary,
		whiteSpace: "nowrap",
	},
	whatsFab: {
		backgroundColor: "#25D366",
		color: "#fff",
		"&:hover": {
			backgroundColor: "#1fb857",
		},
	},
}));

const Login = () => {
	const classes = useStyles();

	const [user, setUser] = useState({ email: "", password: "" });
	const [remember, setRemember] = useState(true);
	const [showPassword, setShowPassword] = useState(false);

	// Languages
	const [anchorElLanguage, setAnchorElLanguage] = useState(null);
	const [menuLanguageOpen, setMenuLanguageOpen] = useState(false);

	const { handleLogin, loading: authLoading } = useContext(AuthContext);
	const { branding, resolveLoginLogo } = useBranding();
	const displayName = branding.systemName;
	const loginLogoSrc = resolveLoginLogo();

	const whatsAppHref = useMemo(() => {
		const n = String(branding.publicWhatsAppNumber || "").replace(/\D/g, "");
		if (!n) return null;
		const base = `https://wa.me/${n}`;
		const msg = String(branding.publicWhatsAppMessage || "").trim();
		if (!msg) return base;
		return `${base}?text=${encodeURIComponent(msg)}`;
	}, [branding.publicWhatsAppNumber, branding.publicWhatsAppMessage]);

	useEffect(() => {
		try {
			const savedEmail = localStorage.getItem("login_email") || "";
			const savedRemember = localStorage.getItem("login_remember") !== "false";
			setRemember(savedRemember);
			if (savedRemember && savedEmail) {
				setUser(prev => ({ ...prev, email: savedEmail }));
			}
		} catch (err) {}
	}, []);

	useEffect(() => {
		try {
			localStorage.setItem("login_remember", remember ? "true" : "false");
			if (!remember) localStorage.removeItem("login_email");
		} catch (err) {}
	}, [remember]);

	const handleChangeInput = e => {
		const next = { ...user, [e.target.name]: e.target.value };
		setUser(next);
		if (remember && e.target.name === "email") {
			try {
				localStorage.setItem("login_email", e.target.value);
			} catch (err) {}
		}
	};

	const handlSubmit = e => {
		e.preventDefault();
		handleLogin(user);
	};

	const handlemenuLanguage = ( event ) => {
		setAnchorElLanguage(event.currentTarget);
		setMenuLanguageOpen( true );
	}

	const handleCloseMenuLanguage = (  ) => {
		setAnchorElLanguage(null);
		setMenuLanguageOpen(false);
	}

	return (
		<div className={classes.root}>
			<div className={classes.languageControl}>
				<IconButton edge="start" onClick={handlemenuLanguage} className={classes.languageIcon}>
					<LanguageOutlined aria-label="Idioma" />
				</IconButton>
				<Menu
					id="menu-appbar-language"
					anchorEl={anchorElLanguage}
					getContentAnchorEl={null}
					anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
					transformOrigin={{ vertical: "top", horizontal: "right" }}
					open={menuLanguageOpen}
					onClose={handleCloseMenuLanguage}
				>
					<MenuItem><LanguageControl /></MenuItem>
				</Menu>
			</div>

			<div className={classes.card}>
				<div className={classes.logoWrap}>
					<img className={classes.logo} src={loginLogoSrc} alt={displayName} />
				</div>

				<form className={classes.form} noValidate onSubmit={handlSubmit}>
					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						id="email"
						label={`${i18n.t("login.form.email")} *`}
						name="email"
						value={user.email}
						onChange={handleChangeInput}
						autoComplete="email"
						autoFocus
						className={classes.input}
					/>

					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						name="password"
						label={`${i18n.t("login.form.password")} *`}
						type={showPassword ? "text" : "password"}
						id="password"
						value={user.password}
						onChange={handleChangeInput}
						autoComplete="current-password"
						className={classes.input}
						InputProps={{
							endAdornment: (
								<InputAdornment position="end">
									<IconButton
										aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
										onClick={() => setShowPassword(v => !v)}
										edge="end"
										size="small"
									>
										{showPassword ? <VisibilityOff /> : <Visibility />}
									</IconButton>
								</InputAdornment>
							),
						}}
					/>

					<div className={classes.rememberRow}>
						<FormControlLabel
							className={classes.rememberLabel}
							control={
								<Checkbox
									checked={remember}
									onChange={e => setRemember(e.target.checked)}
									color="primary"
									size="small"
								/>
							}
							label="Salvar login"
						/>
					</div>

					<Button
						type="submit"
						fullWidth
						variant="contained"
						className={classes.submit}
						disabled={authLoading}
					>
						{authLoading ? (
							<CircularProgress size={22} color="inherit" />
						) : (
							i18n.t("login.buttons.submit")
						)}
					</Button>

					<div className={classes.linksWrap}>
						<Link component={RouterLink} to="/forgetpsw" className={classes.linkRow}>
							<span role="img" aria-label="key">
								🔑
							</span>
							{i18n.t("login.links.forgotPassword")}
						</Link>

						<Link component={RouterLink} to="/signup" className={classes.linkRow}>
							<span role="img" aria-label="pen">
								📝
							</span>
							{i18n.t("login.links.signup")}
						</Link>
					</div>
				</form>
			</div>

			<div className={classes.footer}>
				<div className={classes.footerLinks}>
					<Link component={RouterLink} to="/privacy-policy" color="inherit">
						{i18n.t("login.footer.privacy")}
					</Link>
					<span>|</span>
					<Link component={RouterLink} to="/terms-of-service" color="inherit">
						{i18n.t("login.footer.terms")}
					</Link>
				</div>
				<Copyright brandName={displayName} classes={classes} />
			</div>

			{whatsAppHref ? (
				<div className={classes.supportWrap}>
					<div className={classes.supportBadge}>{i18n.t("login.whatsApp.badge")}</div>
					<Fab
						size="medium"
						className={classes.whatsFab}
						component="a"
						href={whatsAppHref}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={i18n.t("login.whatsApp.ariaLabel")}
					>
						<WhatsApp />
					</Fab>
				</div>
			) : null}
		</div>
	);
};

export default Login;
