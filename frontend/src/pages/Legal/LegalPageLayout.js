import React from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Container from "@material-ui/core/Container";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: "100vh",
    backgroundColor: "#f5f7fa",
    color: theme.palette.text.primary,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "#fff",
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2, 0),
  },
  brand: {
    fontWeight: 700,
    fontSize: "1.25rem",
    color: theme.palette.primary.main,
    textDecoration: "none",
  },
  main: {
    flex: 1,
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(3),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(4),
    },
  },
  back: {
    marginBottom: theme.spacing(2),
    display: "inline-block",
  },
  updated: {
    marginBottom: theme.spacing(3),
  },
  footer: {
    backgroundColor: "#fff",
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2, 0),
    textAlign: "center",
  },
  footerLinks: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
}));

export default function LegalPageLayout({ title, updatedAt, children }) {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Container maxWidth={false} style={{ maxWidth: 900 }}>
          <Link component={RouterLink} to="/login" className={classes.brand}>
            StreamHub Chat
          </Link>
        </Container>
      </Box>

      <Box className={classes.main}>
        <Container maxWidth={false} style={{ maxWidth: 900 }}>
          <Box className={classes.card}>
            <Link component={RouterLink} to="/login" className={classes.back} color="primary">
              ← Voltar ao login
            </Link>
            <Typography variant="h4" component="h1" gutterBottom>
              {title}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              className={classes.updated}
            >
              Última atualização: {updatedAt}
            </Typography>
            {children}
          </Box>
        </Container>
      </Box>

      <Box className={classes.footer}>
        <Container maxWidth={false} style={{ maxWidth: 900 }}>
          <Typography variant="body2" color="textSecondary">
            © {new Date().getFullYear()} StreamHub Chat — STREAMHUB INTERNET LTDA
          </Typography>
          <Box className={classes.footerLinks}>
            <Link component={RouterLink} to="/privacy" color="inherit" variant="body2">
              Política de Privacidade
            </Link>
            <Link component={RouterLink} to="/terms" color="inherit" variant="body2">
              Termos de Uso
            </Link>
            <Link href="mailto:contato@streamhubinternet.com.br" color="inherit" variant="body2">
              contato@streamhubinternet.com.br
            </Link>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

export function LegalSection({ title, paragraphs = [], list = [], paragraphsAfterList = [] }) {
  return (
    <Box mb={3} component="section">
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      {paragraphs.map((text, index) => (
        <Typography
          key={`p-${index}`}
          variant="body1"
          color="textSecondary"
          paragraph
          style={{ lineHeight: 1.7 }}
        >
          {text}
        </Typography>
      ))}
      {list.length > 0 && (
        <Box component="ul" m={0} pl={3}>
          {list.map((item, index) => (
            <Typography
              key={`li-${index}`}
              component="li"
              variant="body1"
              color="textSecondary"
              paragraph
              style={{ lineHeight: 1.7 }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
      {paragraphsAfterList.map((text, index) => (
        <Typography
          key={`pa-${index}`}
          variant="body1"
          color="textSecondary"
          paragraph
          style={{ lineHeight: 1.7 }}
        >
          {text}
        </Typography>
      ))}
    </Box>
  );
}
