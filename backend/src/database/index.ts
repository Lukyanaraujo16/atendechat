import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import UserFeaturePermission from "../models/UserFeaturePermission";
import UserNotificationPreferences from "../models/UserNotificationPreferences";
import UserNotification from "../models/UserNotification";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import PinnedTicket from "../models/PinnedTicket";
import TicketDeletionGuard from "../models/TicketDeletionGuard";
import Whatsapp from "../models/Whatsapp";
import InstagramAccount from "../models/InstagramAccount";
import InstagramAccountQueue from "../models/InstagramAccountQueue";
import MetaWebhookEvent from "../models/MetaWebhookEvent";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import Company from "../models/Company";
import Plan from "../models/Plan";
import PlanFeature from "../models/PlanFeature";
import TicketNote from "../models/TicketNote";
import QuickMessage from "../models/QuickMessage";
import Help from "../models/Help";
import TicketTraking from "../models/TicketTraking";
import UserRating from "../models/UserRating";
import QueueOption from "../models/QueueOption";
import Schedule from "../models/Schedule";
import ScheduleContact from "../models/ScheduleContact";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import ContactLabel from "../models/ContactLabel";
import ContactLabelRelation from "../models/ContactLabelRelation";
import ContactQueueVisibility from "../models/ContactQueueVisibility";
import ContactAssignment from "../models/ContactAssignment";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import Baileys from "../models/Baileys";
import CampaignShipping from "../models/CampaignShipping";
import Announcement from "../models/Announcement";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import ChatMessage from "../models/ChatMessage";
import Invoices from "../models/Invoices";
import Subscriptions from "../models/Subscriptions";
import BaileysChats from "../models/BaileysChats";
import Files from "../models/Files";
import FilesOptions from "../models/FilesOptions";
import Prompt from "../models/Prompt";
import QueueIntegrations from "../models/QueueIntegrations";
import { FlowDefaultModel } from "../models/FlowDefault";
import { FlowBuilderModel } from "../models/FlowBuilder";
import { FlowAudioModel } from "../models/FlowAudio";
import { FlowCampaignModel } from "../models/FlowCampaign";
import { FlowImgModel } from "../models/FlowImg";
import RatingTemplate from "../models/RatingTemplate";
import FlowExecutionLog from "../models/FlowExecutionLog";
import OpenAiUsage from "../models/OpenAiUsage";
import SystemSetting from "../models/SystemSetting";
import SupportAccessLog from "../models/SupportAccessLog";
import CompanyLog from "../models/CompanyLog";
import CompanySignupRequest from "../models/CompanySignupRequest";
import CompanyStorageSnapshot from "../models/CompanyStorageSnapshot";
import Appointment from "../models/Appointment";
import AppointmentParticipant from "../models/AppointmentParticipant";
import CrmPipeline from "../models/CrmPipeline";
import CrmStage from "../models/CrmStage";
import CrmCustomField from "../models/CrmCustomField";
import CrmDeal from "../models/CrmDeal";
import CrmAutomationRule from "../models/CrmAutomationRule";
import CrmDealActivity from "../models/CrmDealActivity";
import CrmDealStageHistory from "../models/CrmDealStageHistory";
import CrmSavedView from "../models/CrmSavedView";
import Sticker from "../models/Sticker";
import InventorySettings from "../models/InventorySettings";
import InventoryCategory from "../models/InventoryCategory";
import InventoryProduct from "../models/InventoryProduct";
import InventoryStockMovement from "../models/InventoryStockMovement";
import InventorySellerProfile from "../models/InventorySellerProfile";
import InventorySale from "../models/InventorySale";
import InventorySaleItem from "../models/InventorySaleItem";
import AiAgent from "../models/AiAgent";
import AiAgentProfile from "../models/AiAgentProfile";
import AiAgentRuntimeLog from "../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../models/AiAgentSuggestionReview";
import AiAgentSimulationSession from "../models/AiAgentSimulationSession";
import AiAgentSimulationMessage from "../models/AiAgentSimulationMessage";
import AiAgentSimulationMessageReview from "../models/AiAgentSimulationMessageReview";
import AiKnowledgeBase from "../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../models/AiKnowledgeDocument";
import AiKnowledgeDocumentProcessing from "../models/AiKnowledgeDocumentProcessing";
import AiKnowledgeDocumentIndexing from "../models/AiKnowledgeDocumentIndexing";
import AiKnowledgeDocumentChunk from "../models/AiKnowledgeDocumentChunk";
import AiKnowledgeEmbeddingSettings from "../models/AiKnowledgeEmbeddingSettings";
import AiAgentKnowledgeBase from "../models/AiAgentKnowledgeBase";
import AiAgentKnowledgeSettings from "../models/AiAgentKnowledgeSettings";
import AiKnowledgeRetrieval from "../models/AiKnowledgeRetrieval";
import AiAgentAnalyticsDaily from "../models/AiAgentAnalyticsDaily";
import AiKnowledgeDocumentStats from "../models/AiKnowledgeDocumentStats";
import AiKnowledgeGap from "../models/AiKnowledgeGap";
import AiKnowledgeSuggestion from "../models/AiKnowledgeSuggestion";
import AiAgentExecutionReplay from "../models/AiAgentExecutionReplay";
import AutomationExecution from "../models/AutomationExecution";
import AutomationExecutionStep from "../models/AutomationExecutionStep";
import AutomationExecutionEvent from "../models/AutomationExecutionEvent";
import AutomationOrchestratorSettings from "../models/AutomationOrchestratorSettings";
import AutomationPlannerValidation from "../models/AutomationPlannerValidation";
import AiProviderCredential from "../models/AiProviderCredential";
import { logDbConnectionAtStartup } from "../helpers/dbConnectionInfo";
import {
  assertContactLabelRelationModelRegistered,
  logContactLabelRelationModelTable
} from "../helpers/contactLabelRelationsTable";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  User,
  UserFeaturePermission,
  UserNotificationPreferences,
  UserNotification,
  Contact,
  Ticket,
  PinnedTicket,
  TicketDeletionGuard,
  Message,
  Whatsapp,
  InstagramAccount,
  InstagramAccountQueue,
  MetaWebhookEvent,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  Plan,
  PlanFeature,
  TicketNote,
  QuickMessage,
  Help,
  TicketTraking,
  UserRating,
  QueueOption,
  Schedule,
  ScheduleContact,
  Tag,
  TicketTag,
  ContactLabel,
  ContactLabelRelation,
  ContactQueueVisibility,
  ContactAssignment,
  ContactList,
  ContactListItem,
  Campaign,
  CampaignSetting,
  Baileys,
  CampaignShipping,
  Announcement,
  Chat,
  ChatUser,
  ChatMessage,
  Invoices,
  Subscriptions,
  BaileysChats,
  Files,
  FilesOptions,
  Prompt,
  QueueIntegrations,
  FlowDefaultModel,
  FlowBuilderModel,
  FlowAudioModel,
  FlowCampaignModel,
  FlowImgModel,
  RatingTemplate,
  FlowExecutionLog,
  OpenAiUsage,
  SystemSetting,
  SupportAccessLog,
  CompanyLog,
  CompanySignupRequest,
  CompanyStorageSnapshot,
  Appointment,
  AppointmentParticipant,
  CrmPipeline,
  CrmStage,
  CrmDeal,
  CrmCustomField,
  CrmAutomationRule,
  CrmDealActivity,
  CrmDealStageHistory,
  CrmSavedView,
  Sticker,
  InventorySettings,
  InventoryCategory,
  InventoryProduct,
  InventoryStockMovement,
  InventorySellerProfile,
  InventorySale,
  InventorySaleItem,
  AiAgent,
  AiAgentProfile,
  AiAgentRuntimeLog,
  AiAgentSuggestionReview,
  AiAgentSimulationSession,
  AiAgentSimulationMessage,
  AiAgentSimulationMessageReview,
  AiKnowledgeBase,
  AiKnowledgeDocument,
  AiKnowledgeDocumentProcessing,
  AiKnowledgeDocumentIndexing,
  AiKnowledgeDocumentChunk,
  AiKnowledgeEmbeddingSettings,
  AiAgentKnowledgeBase,
  AiAgentKnowledgeSettings,
  AiKnowledgeRetrieval,
  AiAgentAnalyticsDaily,
  AiKnowledgeDocumentStats,
  AiKnowledgeGap,
  AiKnowledgeSuggestion,
  AiAgentExecutionReplay,
  AutomationExecution,
  AutomationExecutionStep,
  AutomationExecutionEvent,
  AutomationOrchestratorSettings,
  AutomationPlannerValidation,
  AiProviderCredential
];

sequelize.addModels(models);

void logDbConnectionAtStartup(sequelize);
assertContactLabelRelationModelRegistered(sequelize);
logContactLabelRelationModelTable(sequelize);

export default sequelize;
