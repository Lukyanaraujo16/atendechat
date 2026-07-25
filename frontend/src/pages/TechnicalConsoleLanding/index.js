import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import {
  AGENTOS_CONSOLE_NAV_GROUPS,
  AGENTOS_CONSOLE_NAV_ITEMS,
} from "../../config/agentOsConsoleNavigation";
import useAgentOsConsolePermissions from "../../hooks/useAgentOsConsolePermissions";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 720,
    px: 0,
    padding: theme.spacing(3, 2.5),
    boxSizing: "border-box",
  },
  groupTitle: {
    marginTop: theme.spacing(2.5),
    marginBottom: theme.spacing(0.5),
    fontWeight: 700,
    fontSize: "0.75rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },
  list: {
    paddingTop: 0,
  },
  meta: {
    marginTop: theme.spacing(2),
  },
}));

/**
 * Landing do Console Técnico dentro do shell — sem métricas nem APIs AgentOS.
 */
export default function TechnicalConsoleLanding() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { readOnlyManage } = useAgentOsConsolePermissions();

  const companyName =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? `#${user.companyId}` : null);

  const groupsWithItems = useMemo(
    () =>
      AGENTOS_CONSOLE_NAV_GROUPS.map((group) => ({
        group,
        items: AGENTOS_CONSOLE_NAV_ITEMS.filter((i) => i.group === group.id),
      })).filter((g) => g.items.length > 0),
    []
  );

  return (
    <Box className={classes.root} data-testid="technical-console-landing">
      <Typography variant="h5" gutterBottom>
        {i18n.t("technicalConsole.landing.title")}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {i18n.t("technicalConsole.landing.subtitle")}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {i18n.t("technicalConsole.landing.internalNotice")}
      </Typography>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Box className={classes.meta}>
        {companyName && (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("technicalConsole.shell.activeCompany", {
              name: companyName,
            })}
          </Typography>
        )}
        {user?.supportMode === true && (
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid="landing-support-context"
          >
            {i18n.t("technicalConsole.shell.supportContext")}
          </Typography>
        )}
      </Box>

      {groupsWithItems.map(({ group, items }) => (
        <React.Fragment key={group.id}>
          <Typography className={classes.groupTitle} component="h2">
            {i18n.t(group.labelKey)}
          </Typography>
          <List className={classes.list} dense>
            {items.map((item) => (
              <ListItem
                key={item.id}
                button
                component={Link}
                to={item.path}
                data-testid={`landing-link-${item.id}`}
              >
                <ListItemText primary={i18n.t(item.labelKey)} />
              </ListItem>
            ))}
          </List>
        </React.Fragment>
      ))}
    </Box>
  );
}
