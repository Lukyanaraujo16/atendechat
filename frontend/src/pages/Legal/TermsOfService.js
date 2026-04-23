import React from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Container from "@material-ui/core/Container";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: "100vh",
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  section: {
    marginTop: theme.spacing(3),
  },
  back: {
    marginBottom: theme.spacing(2),
    display: "inline-block",
  },
}));

function Section({ classes, title, body }) {
  return (
    <div className={classes.section}>
      <Typography variant="h6" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="textSecondary" component="p">
        {body}
      </Typography>
    </div>
  );
}

export default function TermsOfService() {
  const classes = useStyles();
  const t = (key) => i18n.t(`legal.terms.${key}`);

  return (
    <Box className={classes.root}>
      <Container maxWidth="md">
        <Link component={RouterLink} to="/login" className={classes.back} color="primary">
          ← {i18n.t("resetPassword.buttons.goLogin")}
        </Link>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("title")}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("legal.updated")}
        </Typography>
        <Typography variant="body1" paragraph>
          {t("intro")}
        </Typography>
        <Section classes={classes} title={t("useTitle")} body={t("useBody")} />
        <Section classes={classes} title={t("accountTitle")} body={t("accountBody")} />
        <Section classes={classes} title={t("liabilityTitle")} body={t("liabilityBody")} />
        <Section classes={classes} title={t("changesTitle")} body={t("changesBody")} />
      </Container>
    </Box>
  );
}
