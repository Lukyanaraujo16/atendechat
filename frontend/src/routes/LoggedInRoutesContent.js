import React, { useContext, useMemo } from "react";
import { Switch, Route, Redirect, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import usePlanFlags from "../hooks/usePlanFlags";
import ModuleTabsLayout from "../layout/ModuleTabsLayout";
import PlanFeatureBlocked from "../components/PlanFeatureBlocked";
import { i18n } from "../translate/i18n";
import { canManageContactLabels } from "../utils/canManageContactLabels";
import {
  ATTENDANCE_OPERATIONAL_FEATURE_KEYS,
  buildAtendimentoTabs,
  getAttendanceDefaultPath,
  getDefaultAppPath,
  hasAttendanceInboxAccess,
  hasAttendanceModuleAccess,
  canAccessInternalChatModule,
  INTERNAL_CHAT_FEATURE_KEY,
} from "../utils/attendanceAccess";
import { isCommercialAutomationsPath } from "../utils/commercialAutomationsNav";

import Dashboard from "../pages/Dashboard/";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Connections from "../pages/Connections/";
import SettingsCustom from "../pages/SettingsCustom/";
import Financeiro from "../pages/Financeiro/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import ContactLabels from "../pages/ContactLabels/";
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
import MediaManager from "../pages/MediaManager";
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
import InventorySales from "../pages/InventorySales";
import { canViewInventory, planHasInventoryModule } from "../utils/inventoryAccess";
import CRMReports from "../pages/CRMReports";
import CrmAutomations from "../pages/CrmAutomations";
import AiAgent from "../pages/AiAgent";
import AiAgentWizardPage from "../pages/AiAgentWizard";
import AiAgentSimulatorPage from "../pages/AiAgentSimulator";
import AiAgentRouteGuard from "../components/AiAgentRouteGuard";
import {
  AI_AGENT_FEATURE_KEY,
  AI_AGENT_ROUTE_PATH,
  AI_AGENT_SIMULATOR_ROUTE_PATH,
  AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH,
  AI_AGENT_WIZARD_ROUTE_PATH,
  AI_AGENT_UI_ENABLED,
} from "../config/aiAgentFeature";
import { getAgentOsRouterPaths } from "../config/agentOsConsoleRoutes";
import KnowledgeBase from "../pages/KnowledgeBase";
import KnowledgeBaseDetail from "../pages/KnowledgeBaseDetail";
import KnowledgeBaseRouteGuard from "../components/KnowledgeBaseRouteGuard";
import {
  KNOWLEDGE_BASE_FEATURE_KEY,
  KNOWLEDGE_BASE_ROUTE_PATH,
  KNOWLEDGE_BASE_UI_ENABLED,
} from "../config/knowledgeBaseFeature";
import TechnicalAgentOsRoutes from "./TechnicalAgentOsRoutes";

function PlanFlagsLoadingState() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={240}
      width="100%"
      px={2}
    >
      <CircularProgress size={36} />
      <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
        {i18n.t("planFlags.loadingPermissions")}
      </Typography>
    </Box>
  );
}

function routePlanAllows(planFlags, keys) {
  const pf = planFlags.planTierEffectiveFeatures || {};
  return (keys || []).some((k) => pf[k] === true);
}

function routeUserAllows(planFlags, keys) {
  const ef = planFlags.effectiveFeatures || {};
  return (keys || []).some((k) => ef[k] === true);
}

function FeatureBlocked({ planFlags, anyOf }) {
  const keys = anyOf && anyOf.length ? anyOf : [];
  const planOk = routePlanAllows(planFlags, keys);
  const userOk = routeUserAllows(planFlags, keys);
  if (planOk && !userOk) return <PlanFeatureBlocked variant="user" />;
  return <PlanFeatureBlocked />;
}

function DashboardRouteGuard() {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const fx = planFlags.effectiveFeatures || {};
  const allowed =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  const showDashboardNav =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  const fallbackPath = getDefaultAppPath({
    effectiveFeatures: fx,
    showDashboardNav,
    planFlags,
    isAdmin:
      user?.profile === "admin" ||
      user?.profile === "supervisor" ||
      user?.supportMode === true,
    user,
  });
  return (
    <Can
      role={user.profile}
      perform="dashboard:view"
      yes={() => {
        if (!planFlags.loaded) {
          return <PlanFlagsLoadingState />;
        }
        if (!allowed)
          return (
            <FeatureBlocked
              planFlags={planFlags}
              anyOf={["dashboard.main", "dashboard.reports"]}
            />
          );
        return <DashboardModule planFlags={planFlags} />;
      }}
      no={() => <Redirect to={fallbackPath} />}
    />
  );
}

function AttendanceModuleGuard({ planFlags, user, isAdmin, children }) {
  const fx = planFlags.effectiveFeatures || {};
  if (!planFlags.ready) {
    return <PlanFlagsLoadingState />;
  }
  if (!hasAttendanceModuleAccess(fx)) {
    if (canAccessInternalChatModule(fx, user, planFlags)) {
      return <Redirect to="/chats" />;
    }
    return (
      <FeatureBlocked
        planFlags={planFlags}
        anyOf={ATTENDANCE_OPERATIONAL_FEATURE_KEYS}
      />
    );
  }
  return children({ fx });
}

function DashboardModule({ planFlags }) {
  const fx = planFlags.effectiveFeatures || {};
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
    return (
      <FeatureBlocked
        planFlags={planFlags}
        anyOf={["dashboard.main", "dashboard.reports"]}
      />
    );
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

function AtendimentoModule({ planFlags, isAdmin, user }) {
  const fx = planFlags.effectiveFeatures || {};
  const defaultPath = useMemo(
    () =>
      getAttendanceDefaultPath({
        effectiveFeatures: fx,
        planFlags,
        isAdmin,
        user,
      }),
    [fx, planFlags, isAdmin, user]
  );

  const tabs = useMemo(
    () =>
      buildAtendimentoTabs({
        effectiveFeatures: fx,
        planFlags,
        isAdmin,
        user,
        t: (key) => i18n.t(key),
      }),
    [fx, planFlags, isAdmin, user, i18n.language]
  );

  if (!tabs.length) {
    return <Redirect to={defaultPath} />;
  }

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route
          exact
          path="/tickets/:ticketId?"
          render={() =>
            hasAttendanceInboxAccess(fx) ? (
              <TicketResponsiveContainer />
            ) : (
              <Redirect to={defaultPath} />
            )
          }
        />
        <Route
          exact
          path="/kanban"
          render={() => {
            if (!planFlags.loaded) {
              return <PlanFlagsLoadingState />;
            }
            if (fx["attendance.kanban"] !== true) {
              return <Redirect to={defaultPath} />;
            }
            return planFlags.useKanban ? (
              <Kanban />
            ) : (
              <FeatureBlocked planFlags={planFlags} anyOf={["attendance.kanban"]} />
            );
          }}
        />
        <Route
          exact
          path="/contacts"
          render={() =>
            hasAttendanceInboxAccess(fx) ? (
              <Contacts />
            ) : (
              <Redirect to={defaultPath} />
            )
          }
        />
        <Route
          exact
          path="/contacts/labels"
          render={() =>
            canManageContactLabels(user) && fx["contacts.tags"] === true ? (
              <ContactLabels />
            ) : (
              <Redirect to={defaultPath} />
            )
          }
        />
        <Route
          exact
          path="/group-manager"
          render={() => {
            if (!planFlags.loaded) {
              return <PlanFlagsLoadingState />;
            }
            if (fx["team.groups"] !== true) {
              return <Redirect to={defaultPath} />;
            }
            return isAdmin && planFlags.useGroups ? (
              <GroupManager />
            ) : (
              <FeatureBlocked planFlags={planFlags} anyOf={["team.groups"]} />
            );
          }}
        />
        <Route render={() => <Redirect to={defaultPath} />} />
      </Switch>
    </ModuleTabsLayout>
  );
}

function AutomacaoModule({ planFlags, isAdmin }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const pathname = location.pathname;
  const fx = planFlags.effectiveFeatures || {};
  const showChatbot = fx["automation.chatbot"] === true;
  const showKeywords = fx["automation.keywords"] === true;
  const showIntegrations = fx["automation.integrations"] === true;
  const showOpenAi = fx["automation.openai"] === true;
  const showQuickReplies = fx["automation.quick_replies"] === true;
  const showAiAgent =
    AI_AGENT_UI_ENABLED && isAdmin && fx[AI_AGENT_FEATURE_KEY] === true;
  const showKnowledgeBase =
    KNOWLEDGE_BASE_UI_ENABLED && isAdmin && fx[KNOWLEDGE_BASE_FEATURE_KEY] === true;

  /**
   * Abas comerciais de Automações: somente Fluxos, Gatilhos e Integrações.
   * Agente de IA, KB, Prompts, Quick Replies e AgentOS saem do agrupamento visual.
   * Páginas técnicas AgentOS vivem em TechnicalAgentOsRoutes (Fase 1.3).
   */
  const commercialTabs = useMemo(() => {
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
    return t;
  }, [
    isAdmin,
    showChatbot,
    showKeywords,
    showIntegrations,
    i18n.language,
  ]);

  const tabs = isCommercialAutomationsPath(pathname) ? commercialTabs : [];

  const hasAnyHostedSurface =
    showChatbot ||
    showKeywords ||
    showIntegrations ||
    showOpenAi ||
    showAiAgent ||
    showKnowledgeBase ||
    showQuickReplies;

  if (!planFlags.loaded) {
    return <PlanFlagsLoadingState />;
  }

  if (!hasAnyHostedSurface) {
    return (
      <FeatureBlocked
        planFlags={planFlags}
        anyOf={[
          "automation.chatbot",
          "automation.keywords",
          "automation.integrations",
          "automation.openai",
          AI_AGENT_FEATURE_KEY,
          KNOWLEDGE_BASE_FEATURE_KEY,
          "automation.quick_replies",
        ]}
      />
    );
  }

  const fallback =
    commercialTabs[0]?.path ||
    (showAiAgent ? AI_AGENT_ROUTE_PATH : null) ||
    (showKnowledgeBase ? KNOWLEDGE_BASE_ROUTE_PATH : null) ||
    (showOpenAi ? "/prompts" : null) ||
    (showQuickReplies ? "/quick-messages" : null) ||
    "/tickets";

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        {showKeywords ? (
          <Route exact path="/phrase-lists" component={CampaignsPhrase} />
        ) : (
          <Route exact path="/phrase-lists" render={() => <Redirect to={fallback} />} />
        )}
        {/*
          Não usar Fragment aqui: o Switch do react-router v5 só considera filhos
          diretos com path. Um <> sem path herda match do contexto e "ganha" antes
          de /queue-integration, /prompts etc., deixando a área em branco.
        */}
        {showChatbot ? (
          <Route exact path="/flowbuilders" component={FlowBuilder} />
        ) : (
          <Route exact path="/flowbuilders" render={() => <Redirect to={fallback} />} />
        )}
        {showChatbot ? (
          <Route exact path="/flowbuilder/:id?" component={FlowBuilderConfig} />
        ) : (
          <Route exact path="/flowbuilder/:id?" render={() => <Redirect to={fallback} />} />
        )}
        <Route
          exact
          path="/queue-integration"
          render={() =>
            isAdmin && showIntegrations ? (
              <QueueIntegration />
            ) : (
              <FeatureBlocked planFlags={planFlags} anyOf={["automation.integrations"]} />
            )
          }
        />
        <Route
          exact
          path="/prompts"
          render={() =>
            isAdmin && showOpenAi ? <Prompts /> : (
              <FeatureBlocked planFlags={planFlags} anyOf={["automation.openai"]} />
            )
          }
        />
        <Route
          exact
          path={`${AI_AGENT_WIZARD_ROUTE_PATH}/:agentId`}
          render={() => (
            <AiAgentRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showAiAgent ? <AiAgentWizardPage /> : null}
            </AiAgentRouteGuard>
          )}
        />
        <Route
          exact
          path={AI_AGENT_WIZARD_ROUTE_PATH}
          render={() => (
            <AiAgentRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showAiAgent ? <AiAgentWizardPage /> : null}
            </AiAgentRouteGuard>
          )}
        />
        <Route
          exact
          path={AI_AGENT_SIMULATOR_ROUTE_PATH}
          render={() => (
            <AiAgentRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showAiAgent ? <AiAgentSimulatorPage /> : null}
            </AiAgentRouteGuard>
          )}
        />
        <Route
          exact
          path={AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH}
          render={() => <Redirect to={AI_AGENT_SIMULATOR_ROUTE_PATH} />}
        />
        <Route
          exact
          path={AI_AGENT_ROUTE_PATH}
          render={() => (
            <AiAgentRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showAiAgent ? <AiAgent /> : null}
            </AiAgentRouteGuard>
          )}
        />
        <Route
          exact
          path={`${KNOWLEDGE_BASE_ROUTE_PATH}/:baseId`}
          render={() => (
            <KnowledgeBaseRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showKnowledgeBase ? <KnowledgeBaseDetail /> : null}
            </KnowledgeBaseRouteGuard>
          )}
        />
        <Route
          exact
          path={KNOWLEDGE_BASE_ROUTE_PATH}
          render={() => (
            <KnowledgeBaseRouteGuard
              planFlags={planFlags}
              user={user}
              fallbackPath={fallback}
            >
              {isAdmin && showKnowledgeBase ? <KnowledgeBase /> : null}
            </KnowledgeBaseRouteGuard>
          )}
        />
        {showQuickReplies ? (
          <Route exact path="/quick-messages" component={QuickMessages} />
        ) : (
          <Route exact path="/quick-messages" render={() => (
            <FeatureBlocked planFlags={planFlags} anyOf={["automation.quick_replies"]} />
          )} />
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
    return <PlanFlagsLoadingState />;
  }

  if (isAdmin && !usersOk && !queuesOk) {
    return (
      <FeatureBlocked
        planFlags={planFlags}
        anyOf={["team.users", "team.queues"]}
      />
    );
  }

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route
          exact
          path="/users"
          render={() =>
            usersOk ? <Users /> : (
              <FeatureBlocked planFlags={planFlags} anyOf={["team.users"]} />
            )
          }
        />
        <Route
          exact
          path="/setores"
          render={() =>
            queuesOk ? <Setores /> : (
              <FeatureBlocked planFlags={planFlags} anyOf={["team.queues"]} />
            )
          }
        />
        <Route
          exact
          path="/queues"
          render={() =>
            queuesOk ? <Queues /> : (
              <FeatureBlocked planFlags={planFlags} anyOf={["team.queues"]} />
            )
          }
        />
      </Switch>
    </ModuleTabsLayout>
  );
}

function ConfiguracoesModule({
  planFlagsLoaded,
  showExternalApi,
  showMediaManager,
  showGroupsManager,
  planFlags,
}) {
  const tabs = useMemo(() => {
    const t = [{ path: "/connections", label: i18n.t("mainDrawer.listItems.connections") }];
    if (showExternalApi) {
      t.push({ path: "/messages-api", label: i18n.t("mainDrawer.listItems.messagesAPI") });
    }
    t.push({ path: "/settings", label: i18n.t("mainDrawer.listItems.settings") });
    if (showMediaManager) {
      t.push({ path: "/settings/media-manager", label: i18n.t("settings.tabs.mediaManager") });
    }
    if (showGroupsManager) {
      t.push({ path: "/settings/groups", label: i18n.t("settings.tabs.groupManager") });
    }
    return t;
  }, [showExternalApi, showMediaManager, showGroupsManager, i18n.language]);

  if (!planFlagsLoaded) {
    return <PlanFlagsLoadingState />;
  }

  return (
    <ModuleTabsLayout tabs={tabs}>
      <Switch>
        <Route exact path="/connections" component={Connections} />
        <Route
          exact
          path="/messages-api"
          render={() =>
            showExternalApi ? <MessagesAPI /> : (
              <FeatureBlocked planFlags={planFlags} anyOf={["settings.api"]} />
            )
          }
        />
        <Route exact path="/settings" component={SettingsCustom} />
        <Route
          exact
          path="/settings/media-manager"
          render={() =>
            showMediaManager ? <MediaManager /> : <PlanFeatureBlocked />
          }
        />
        <Route
          exact
          path="/settings/groups"
          render={() =>
            showGroupsManager ? (
              <GroupManager />
            ) : (
              <FeatureBlocked planFlags={planFlags} anyOf={["team.groups"]} />
            )
          }
        />
      </Switch>
    </ModuleTabsLayout>
  );
}

export default function LoggedInRoutesContent() {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const isAdmin = user?.profile === "admin";
  const isTenantManager = isAdmin || user?.profile === "supervisor";
  const isPrivileged =
    user?.profile === "admin" || user?.profile === "supervisor" || user?.supportMode === true;
  const showMediaManager = isAdmin || user?.supportMode === true;
  const fx = planFlags.effectiveFeatures || {};
  const showDashboardNav =
    fx["dashboard.main"] === true || fx["dashboard.reports"] === true;
  const appDefaultPath = getDefaultAppPath({
    effectiveFeatures: fx,
    showDashboardNav,
    planFlags,
    isAdmin: isTenantManager,
    user,
  });

  const atendimentoPaths = [
    "/tickets/:ticketId?",
    "/kanban",
    "/contacts",
    "/contacts/labels",
    "/group-manager",
  ];

  const automacaoPaths = [
    "/flowbuilders",
    "/flowbuilder/:id?",
    "/phrase-lists",
    "/queue-integration",
    "/prompts",
    AI_AGENT_ROUTE_PATH,
    AI_AGENT_WIZARD_ROUTE_PATH,
    `${AI_AGENT_WIZARD_ROUTE_PATH}/:agentId`,
    AI_AGENT_SIMULATOR_ROUTE_PATH,
    AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH,
    KNOWLEDGE_BASE_ROUTE_PATH,
    `${KNOWLEDGE_BASE_ROUTE_PATH}/:baseId`,
    "/quick-messages",
  ];

  const technicalConsolePaths = getAgentOsRouterPaths();

  const campanhasPaths = [
    "/campaigns",
    "/contact-lists",
    "/contact-lists/:contactListId/contacts",
    "/campaigns-config",
    "/campaign/:campaignId/report",
  ];

  const equipePaths = ["/users", "/setores", "/queues"];

  const configPaths = [
    "/connections",
    "/messages-api",
    "/settings",
    "/settings/media-manager",
    "/settings/groups"
  ];

  return (
    <Switch>
      <Route exact path={["/", "/relatorios"]} component={DashboardRouteGuard} />

      <Route
        path={atendimentoPaths}
        render={() => (
          <AttendanceModuleGuard
            planFlags={planFlags}
            user={user}
            isAdmin={isTenantManager}
          >
            {() => (
              <AtendimentoModule
                planFlags={planFlags}
                isAdmin={isTenantManager}
                user={user}
              />
            )}
          </AttendanceModuleGuard>
        )}
      />

      <Route
        exact
        path="/chats"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          if (!canAccessInternalChatModule(fx, user, planFlags)) {
            if (hasAttendanceModuleAccess(fx)) {
              return (
                <Redirect
                  to={getAttendanceDefaultPath({
                    effectiveFeatures: fx,
                    planFlags,
                    isAdmin: isTenantManager,
                    user,
                  })}
                />
              );
            }
            return (
              <FeatureBlocked
                planFlags={planFlags}
                anyOf={[INTERNAL_CHAT_FEATURE_KEY]}
              />
            );
          }
          return <Chat />;
        }}
      />
      <Route
        exact
        path="/chats/:id"
        render={(routeProps) => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          if (!canAccessInternalChatModule(fx, user, planFlags)) {
            if (hasAttendanceModuleAccess(fx)) {
              return (
                <Redirect
                  to={getAttendanceDefaultPath({
                    effectiveFeatures: fx,
                    planFlags,
                    isAdmin: isTenantManager,
                    user,
                  })}
                />
              );
            }
            return (
              <FeatureBlocked
                planFlags={planFlags}
                anyOf={[INTERNAL_CHAT_FEATURE_KEY]}
              />
            );
          }
          return <Chat {...routeProps} />;
        }}
      />

      <Route exact path="/notifications" component={UserNotifications} />

      <Route exact path="/todolist" component={ToDoList} />
      <Route
        exact
        path="/agenda"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["agenda.calendar"] === true ? (
            <Agenda />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["agenda.calendar"]} />
          );
        }}
      />
      <Route
        exact
        path="/schedules"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return planFlags.useSchedules ? (
            <Schedules />
          ) : (
            <FeatureBlocked
              planFlags={planFlags}
              anyOf={["agenda.appointments", "attendance.schedules"]}
            />
          );
        }}
      />

      <Route path={technicalConsolePaths} component={TechnicalAgentOsRoutes} />

      <Route path={automacaoPaths} render={() => <AutomacaoModule planFlags={planFlags} isAdmin={isAdmin} />} />

      <Route
        path={campanhasPaths}
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          if (!planFlags.useCampaigns) {
            return (
              <FeatureBlocked
                planFlags={planFlags}
                anyOf={["campaigns.sends", "campaigns.lists"]}
              />
            );
          }
          return <CampanhasModule />;
        }}
      />

      <Route
        path={equipePaths}
        render={() => <EquipeModule isAdmin={isTenantManager} planFlags={planFlags} />}
      />

      <Route
        path={configPaths}
        render={() => (
          <ConfiguracoesModule
            planFlagsLoaded={planFlags.loaded}
            showExternalApi={planFlags.useExternalApi}
            showMediaManager={showMediaManager}
            showGroupsManager={planFlags.useGroups && isPrivileged}
            planFlags={planFlags}
          />
        )}
      />

      <Route
        exact
        path="/financeiro"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          const finOk =
            fx["finance.subscription"] === true || fx["finance.invoices"] === true;
          return finOk ? (
            <Financeiro />
          ) : (
            <FeatureBlocked
              planFlags={planFlags}
              anyOf={["finance.subscription", "finance.invoices"]}
            />
          );
        }}
      />

      <Route
        exact
        path="/avaliacao"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["team.ratings"] === true ? (
            <Evaluation />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["team.ratings"]} />
          );
        }}
      />
      <Route
        exact
        path="/tags"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["contacts.tags"] === true ? (
            <Tags />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["contacts.tags"]} />
          );
        }}
      />
      <Route
        exact
        path="/files"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["contacts.files"] === true ? (
            <Files />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["contacts.files"]} />
          );
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
            return <PlanFlagsLoadingState />;
          }
          return fx["finance.subscription"] === true ? (
            <Subscription />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["finance.subscription"]} />
          );
        }}
      />

      <Route
        exact
        path="/crm/reports"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["crm.pipeline"] === true ? (
            <CRMReports />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["crm.pipeline"]} />
          );
        }}
      />

      <Route
        exact
        path="/crm/automations"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["crm.pipeline"] === true ? (
            <CrmAutomations />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["crm.pipeline"]} />
          );
        }}
      />

      <Route
        exact
        path="/crm"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          return fx["crm.pipeline"] === true ? (
            <CrmBoard />
          ) : (
            <FeatureBlocked planFlags={planFlags} anyOf={["crm.pipeline"]} />
          );
        }}
      />

      <Route
        exact
        path="/inventory-sales"
        render={() => {
          if (!planFlags.loaded) {
            return <PlanFlagsLoadingState />;
          }
          if (!planHasInventoryModule(planFlags)) {
            return (
              <FeatureBlocked planFlags={planFlags} anyOf={["inventory.sales"]} />
            );
          }
          if (!canViewInventory(planFlags, user)) {
            return <PlanFeatureBlocked variant="user" />;
          }
          return <InventorySales />;
        }}
      />

      <Route render={() => <Redirect to={appDefaultPath} />} />
    </Switch>
  );
}
