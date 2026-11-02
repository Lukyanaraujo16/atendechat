import { site } from "../config/site";

/** Respostas baseadas no comportamento real da plataforma (ver site/README.md). */
export const faq = [
  {
    q: "Quais canais posso conectar ao StreamHub Chat?",
    a: "O WhatsApp é conectado pela leitura de QR Code, com uma ou mais conexões conforme o plano. O Instagram Direct também pode ser integrado quando o recurso estiver incluído na configuração contratada.",
  },
  {
    q: "Preciso instalar algum programa?",
    a: "Não. A plataforma funciona no navegador, no computador ou no celular, e pode ser adicionada à tela inicial do dispositivo para acesso rápido.",
  },
  {
    q: "Como funciona a inteligência artificial?",
    a: "O Agente de IA responde clientes com base no conteúdo cadastrado pela sua empresa, pode transcrever áudios e ser pausado manualmente em cada atendimento. Ele está disponível conforme o plano e utiliza a chave de API da OpenAI ou do Gemini fornecida pela sua empresa.",
  },
  {
    q: "Quanto custa?",
    a: `Os planos começam em R$ ${site.startingPrice} por mês. O valor final depende da configuração escolhida: quantidade de usuários, conexões, setores e módulos habilitados. Nossa equipe monta a proposta com você pelo WhatsApp.`,
  },
  {
    q: "Como começo a usar?",
    a: "Fale com a nossa equipe pelo WhatsApp para definir a configuração ideal. Se preferir, envie uma solicitação de acesso pela página de cadastro da plataforma: o pedido é analisado pela nossa equipe antes da liberação.",
  },
  {
    q: "Como meus dados são tratados?",
    a: "O tratamento de dados está descrito na Política de Privacidade do StreamHub Chat, elaborada com base na Lei Geral de Proteção de Dados (LGPD). Os Termos de Uso e a página de exclusão de dados também estão disponíveis publicamente.",
  },
] as const;
