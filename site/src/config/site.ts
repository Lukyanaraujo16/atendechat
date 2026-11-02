/**
 * Configuração pública do site institucional.
 * Valores podem ser sobrescritos por variáveis PUBLIC_* no build (ver .env.example).
 */
const env = import.meta.env;

const appUrl = (env.PUBLIC_APP_URL as string | undefined) || "https://app.streamhubchat.com.br";

/**
 * WhatsApp comercial. Origem: campo "publicWhatsAppNumber" do Branding da plataforma
 * (Gestão SaaS → Branding), o mesmo exibido no botão de suporte da tela de login
 * (frontend/src/pages/Login/index.js, via GET /system-settings/branding).
 * Se o número mudar no Branding, atualize PUBLIC_WHATSAPP_NUMBER e gere novo build.
 */
const whatsappNumber = String(env.PUBLIC_WHATSAPP_NUMBER || "5519997913388").replace(/\D/g, "");

/** Link oficial do WhatsApp (wa.me) com mensagem pré-preenchida codificada. */
export const whatsappLink = (message: string) =>
  `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

export const messages = {
  plan: "Olá! Conheci o StreamHub Chat pelo site e gostaria de montar um plano personalizado para minha empresa. Podem me ajudar?",
  demo: "Olá! Conheci o StreamHub Chat pelo site e gostaria de agendar uma demonstração da plataforma.",
  specialist: "Olá! Estou conhecendo o StreamHub Chat pelo site e gostaria de falar com um especialista sobre a minha operação de atendimento.",
} as const;

export const site = {
  name: "StreamHub Chat",
  url: "https://streamhubchat.com.br",
  title: "StreamHub Chat — Atendimento omnichannel, automação e CRM em uma só plataforma",
  description:
    "Centralize o WhatsApp e o Instagram, distribua conversas entre equipes, automatize com fluxos e inteligência artificial e acompanhe cada oportunidade até o fechamento. Planos a partir de R$ 99,90/mês.",
  appUrl,
  signupUrl: `${appUrl}/signup`,
  whatsappNumber,
  startingPrice: "99,90",
  email: "contato@streamhubinternet.com.br",
  legal: {
    // Dados já publicados nas páginas jurídicas do app (frontend/src/pages/Legal/legalContent.js).
    name: "STREAMHUB INTERNET LTDA",
    cnpj: "22.669.597/0001-02",
    privacy: `${appUrl}/politica-de-privacidade`,
    terms: `${appUrl}/termos-de-uso`,
    dataDeletion: `${appUrl}/data-deletion`,
  },
} as const;
