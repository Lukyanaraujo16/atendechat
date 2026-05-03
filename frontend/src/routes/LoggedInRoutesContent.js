import React, { useContext, useMemo } from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import usePlanFlags from "../hooks/usePlanFlags";
import ModuleTabsLayout from "../layout/ModuleTabsLayout";
import PlanFeatureBlocked from "../components/PlanFeatureBlocked";
import { i18n } from "../translate/i18n";

import Dashboard from "../pages/Dashboard/";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Connections from "../pages/Connections/";
import SettingsCustom from "../pages/SettingsCustom/";
import Financeiro from "../pages/Financeiro/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import Queues from "../pages/Queues/";
import Setores from "../pages/Setores/";
import Tags from "../pages/Tags/";
import MessagesAPI from "../pages/MessagesAPI/";
import Helps from "../pages/Helps/";
import ContactLists from "../pages/ContactLists/";
import ContactListItems from "../pages/ContactListItems/";
import QuickMessages from "../pages/QuickMessages/";
import Kanban from "../pages/Kanban";
import GroupManager from "../pages/GroupManager";
import Schedules from "../pages/Schedules";
import Campaigns from "../pages/Campaigns";
import CampaignsConfig from "../pages/CampaignsConfig";
import CampaignReport from "../pages/CampaignReport";
import Chat from "../pages/Chat";
import ToDoList from "../pages/ToDoList/";
import Agenda from "../pages/Agenda";
import Subscription from "../pages/Subscription/";
import Files from "../pages/Files/";
import Prompts from "../pages/Prompts";
import QueueIntegration from "../pages/QueueIntegration";
import CampaignsPhrase from "../pages/CampaignsPhrase";
import FlowBuilder from "../pages/FlowBuilder";
import FlowBuilderConfig from "../pages/FlowBuilderConfig";
import Evaluation from "../pages/Evaluation";
import Reports from "../pages/Reports";
import UserNotifications from "../pages/UserNotifications";
import CrmBoard from "../pages/CRM";

function DashboardRouteGuard() {
  const { user } = useContext(AuthContext);
  const { loaded, effectiveFeatures } = usePlanFlags();
  const fx = effectiveFeatures || {};
  const allowed =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  return (
    <Can
      role={user.profile}
      perform="dashboard:view"
      yes={() => {
        if (!loaded) {
          return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
              <CircularProgress size={36} />
            </Box>
          );
        }
        if (!allowed) return <PlanFeatureBlocked />;
        return <DashboardModule />;
      }}
      no={() => <Redirect to="/tickets" />}
    />
  );
}

function DashboardModule() {
  const { effectiveFeatures } = usePlanFlags();
  const fx = effectiveFeatures || {};
  const tabs = useMemo(() => {
    const t = [];
    if (fx["dashboard.main"] === true) {
      t.push({ path: "/", label: i18n.t("mainDrawer.listItems.dashboard") });
    }
    if (fx["dashboard.reports"] === true) {
      t.push({ path: "/relatorios", label: i18n.t("mainDrawer.listItems.reports") });
    }
    return t;
  }, [fx, i18n.language]);
  if (!tabs.length) {
    return <PlanFeatureBlocked />;
  }
  const defaultPath = tabs[0]?.path || "/";
  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        {fx["dashboard.main"] === true ? (
          <Route exact path="/" component={Dashboard} />
        ) : (
          <Route exact path="/" render={() => <Redirect to={defaultPath} />} />
        )}
        {fx["dashboard.reports"] === true ? (
          <Route exact path="/relatorios" component={Reports} />
        ) : (
          <Route exact path="/relatorios" render={() => <Redirect to={defaultPath} />} />
        )}
      </Switch>
    </ModuleTabsLayout>
  );
}

function AtendimentoModule({ planFlags, isAdmin }) {
  const tabs = useMemo(() => {
    const t = [{ path: "/tickets", label: i18n.t("mainDrawer.listItems.tickets") }];
    if (planFlags.useKanban) {
      t.push({ path: "/kanban", label: i18n.t("mainDrawer.listItems.kanban") });
    }
    t.push({ path: "/contacts", label: i18n.t("mainDrawer.listItems.contacts") });
    if (isAdmin && planFlags.useGroups) {
      t.push({ path: "/group-manager", label: i18n.t("mainDrawer.listItems.groups") });
    }
    return t;
  }, [planFlags.useKanban, planFlags.useGroups, isAdmin, i18n.language]);

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route exact path="/tickets/:ticketId?" component={TicketResponsiveContainer} />
        <Route
          exact
          path="/kanban"
          render={() => {
            if (!planFlags.loaded) {
              return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                  <CircularProgress size={36} />
                </Box>
              );
            }
            return planFlags.useKanban ? <Kanban /> : <PlanFeatureBlocked />;
          }}
        />
        <Route exact path="/contacts" component={Contacts} />
        <Route
          exact
          path="/group-manager"
          render={() => {
            if (!planFlags.loaded) {
              return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                  <CircularProgress size={36} />
                </Box>
              );
            }
            return isAdmin && planFlags.useGroups ? (
              <GroupManager />
            ) : (
              <PlanFeatureBlocked />
            );
          }}
        />
      </Switch>
    </ModuleTabsLayout>
  );
}

function AutomacaoModule({ planFlags, isAdmin }) {
  const fx = planFlags.effectiveFeatures || {};
  const showChatbot = fx["automation.chatbot"] === true;
  const showKeywords = fx["automation.keywords"] === true;
  const showIntegrations = fx["automation.integrations"] === true;
  const showOpenAi = fx["automation.openai"] === true;
  const showQuickReplies = fx["automation.quick_replies"] === true;

  const tabs = useMemo(() => {
    const t = [];
    if (isAdmin && showChatbot) {
      t.push({
        path: "/flowbuilders",
        label: i18n.t("mainDrawer.listItems.flowsChatbot"),
      });
    }
    if (isAdmin && showKeywords) {
      t.push({
        path: "/phrase-lists",
        label: i18n.t("mainDrawer.listItems.keywordsTrigger"),
      });
    }
    if (isAdmin && showIntegrations) {
      t.push({
        path: "/queue-integration",
        label: i18n.t("mainDrawer.listItems.integrations"),
      });
    }
    if (isAdmin && showOpenAi) {
      t.push({ path: "/prompts", label: i18n.t("mainDrawer.listItems.prompts") });
    }
    if (showQuickReplies) {
      t.push({
        path: "/quick-messages",
        label: i18n.t("mainDrawer.listItems.quickMessages"),
      });
    }
    return t;
  }, [isAdmin, showChatbot, showKeywords, showIntegrations, showOpenAi, showQuickReplies, i18n.language]);

  if (!planFlags.loaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (!tabs.length) {
    return <PlanFeatureBlocked />;
  }

  const fallback = tabs[0]?.path || "/tickets";

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        {showKeywords ? (
          <Route exact path="/phrase-lists" component={CampaignsPhrase} />
        ) : (
          <Route exact path="/phrase-lists" render={() => <Redirect to={fallback} />} />
        )}
        {showChatbot ? (
          <>
            <Route exact path="/flowbuilders" component={FlowBuilder} />
            <Route exact path="/flowbuilder/:id?" component={FlowBuilderConfig} />
          </>
        ) : (
          <>
            <Route exact path="/flowbuilders" render={() => <Redirect to={fallback} />} />
            <Route exact path="/flowbuilder/:id?" render={() => <Redirect to={fallback} />} />
          </>
        )}
        <Route
          exact
          path="/queue-integration"
          render={() =>
            isAdmin && showIntegrations ? (
              <QueueIntegration />
            ) : (
              <Redirect to={fallback} />
            )
          }
        />
        <Route
          exact
          path="/prompts"
          render={() =>
            isAdmin && showOpenAi ? <Prompts /> : <Redirect to={fallback} />
          }
        />
        {showQuickReplies ? (
          <Route exact path="/quick-messages" component={QuickMessages} />
        ) : (
          <Route exact path="/quick-messages" render={() => <PlanFeatureBlocked />} />
        )}
      </Switch>
    </ModuleTabsLayout>
  );
}

function CampanhasModule() {
  const tabs = useMemo(
    () => [
      { path: "/campaigns", label: i18n.t("mainDrawer.listItems.campaigns") },
      { path: "/contact-lists", label: i18n.t("mainDrawer.listItems.contactLists") },
      { path: "/campaigns-config", label: i18n.t("mainDrawer.listItems.campaignSettings") },
    ],
    [i18n.language]
  );
  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route exact path="/campaigns" component={Campaigns} />
        <Route exact path="/contact-lists" component={ContactLists} />
        <Route exact path="/contact-lists/:contactListId/contacts" component={ContactListItems} />
        <Route exact path="/campaigns-config" component={CampaignsConfig} />
        <Route exact path="/campaign/:campaignId/report" component={CampaignReport} />
      </Switch>
    </ModuleTabsLayout>
  );
}

function EquipeModule({ isAdmin, planFlags }) {
  const fx = planFlags.effectiveFeatures || {};
  const usersOk = fx["team.users"] === true;
  const queuesOk = fx["team.queues"] === true;

  const tabs = useMemo(() => {
    if (!isAdmin) {
      return [];
    }
    const t = [];
    if (usersOk) {
      t.push({ path: "/users", label: i18n.t("mainDrawer.listItems.users") });
    }
    if (queuesOk) {
      t.push({ path: "/setores", label: i18n.t("mainDrawer.listItems.sectors") });
    }
    return t;
  }, [isAdmin, usersOk, queuesOk, i18n.language]);

  if (!planFlags.loaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (isAdmin && !usersOk && !queuesOk) {
    return <PlanFeatureBlocked />;
  }

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route
          exact
          path="/users"
          render={() => (usersOk ? <Users /> : <PlanFeatureBlocked />)}
        />
        <Route
          exact
          path="/setores"
          render={() => (queuesOk ? <Setores /> : <PlanFeatureBlocked />)}
        />
        <Route
          exact
          path="/queues"
          render={() => (queuesOk ? <Queues /> : <PlanFeatureBlocked />)}
        />
      </Switch>
    </ModuleTabsLayout>
  );
}

function ConfiguracoesModule({ showExternalApi }) {
  const tabs = useMemo(() => {
    const t = [{ path: "/connections", label: i18n.t("mainDrawer.listItems.connections") }];
    if (showExternalApi) {
      t.push({ path: "/messages-api", label: i18n.t("mainDrawer.listItems.messagesAPI") });
    }
    t.push({ path: "/settings", label: i18n.t("mainDrawer.listItems.settings") });
    return t;
  }, [showExternalApi, i18n.language]);

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route exact path="/connections" component={Connections} />
        <Route
          exact
          path="/messages-api"
          render={() => (showExternalApi ? <MessagesAPI /> : <PlanFeatureBlocked />)}
        />
        <Route exact path="/settings" component={SettingsCustom} />
      </Switch>
    </ModuleTabsLayout>
  );
}

export default function LoggedInRoutesContent() {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const isAdmin = user?.profile === "admin";
  const fx = planFlags.effectiveFeatures || {};

  const atendimentoPaths = ["/tickets/:ticketId?", "/kanban", "/contacts", "/group-manager"];

  const automacaoPaths = [
    "/flowbuilders",
    "/flowbuilder/:id?",
    "/phrase-lists",
    "/queue-integration",
    "/prompts",
    "/quick-messages",
  ];

  const campanhasPaths = [
    "/campaigns",
    "/contact-lists",
    "/contact-lists/:contactListId/contacts",
    "/campaigns-config",
    "/campaign/:campaignId/report",
  ];

  const equipePaths = ["/users", "/setores", "/queues"];

  const configPaths = ["/connections", "/messages-api", "/settings"];

  return (
    <Switch>
      <Route exact path={["/", "/relatorios"]} component={DashboardRouteGuard} />

      <Route
        path={atendimentoPaths}
        render={() => <AtendimentoModule planFlags={planFlags} isAdmin={isAdmin} />}
      />

      <Route
        exact
        path="/chats"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return planFlags.useInternalChat ? <Chat /> : <PlanFeatureBlocked />;
        }}
      />
      <Route
        exact
        path="/chats/:id"
        render={(routeProps) => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return planFlags.useInternalChat ? (
            <Chat {...routeProps} />
          ) : (
            <PlanFeatureBlocked />
          );
        }}
      />

      <Route exact path="/notifications" component={UserNotifications} />

      <Route exact path="/todolist" component={ToDoList} />
      <Route
        exact
        path="/agenda"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["agenda.calendar"] === true ? <Agenda /> : <PlanFeatureBlocked />;
        }}
      />
      <Route
        exact
        path="/schedules"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return planFlags.useSchedules ? <Schedules /> : <PlanFeatureBlocked />;
        }}
      />

      <Route path={automacaoPaths} render={() => <AutomacaoModule planFlags={planFlags} isAdmin={isAdmin} />} />

      {!planFlags.useCampaigns && (
        <Route
          path={["/campaigns", "/contact-lists", "/campaigns-config", "/campaign/:campaignId/report"]}
          render={() => <PlanFeatureBlocked />}
        />
      )}

      {planFlags.useCampaigns && (
        <Route path={campanhasPaths} render={() => <CampanhasModule />} />
      )}

      <Route
        path={equipePaths}
        render={() => <EquipeModule isAdmin={isAdmin} planFlags={planFlags} />}
      />

      <Route
        path={configPaths}
        render={() => (
          <ConfiguracoesModule showExternalApi={planFlags.useExternalApi} />
        )}
      />

      <Route
        exact
        path="/financeiro"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          const finOk =
            fx["finance.subscription"] === true || fx["finance.invoices"] === true;
          return finOk ? <Financeiro /> : <PlanFeatureBlocked />;
        }}
      />

      <Route
        exact
        path="/avaliacao"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["team.ratings"] === true ? <Evaluation /> : <PlanFeatureBlocked />;
        }}
      />
      <Route
        exact
        path="/tags"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["contacts.tags"] === true ? <Tags /> : <PlanFeatureBlocked />;
        }}
      />
      <Route
        exact
        path="/files"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["contacts.files"] === true ? <Files /> : <PlanFeatureBlocked />;
        }}
      />
      <Route exact path="/helps" component={Helps} />
      <Route
        exact
        path="/announcements"
        render={() => <Redirect to="/saas/announcements" />}
      />
      <Route
        exact
        path="/subscription"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["finance.subscription"] === true ? (
            <Subscription />
          ) : (
            <PlanFeatureBlocked />
          );
        }}
      />

      <Route
        exact
        path="/crm"
        render={() => {
          if (!planFlags.loaded) {
            return (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={240} width="100%">
                <CircularProgress size={36} />
              </Box>
            );
          }
          return fx["crm.pipeline"] === true ? <CrmBoard /> : <PlanFeatureBlocked />;
        }}
      />

      <Route render={() => <Redirect to="/tickets" />} />
    </Switch>
  );
}
