export const LEGAL_UPDATED_AT = "19 de maio de 2026";

export const COMPANY = {
  name: "StreamHub Chat",
  legalName: "STREAMHUB INTERNET LTDA",
  cnpj: "22.669.597/0001-02",
  email: "contato@streamhubinternet.com.br",
  domain: "app.streamhubchat.com.br",
  description:
    "Plataforma de atendimento, comunicação, automação e gestão de conversas em múltiplos canais, incluindo WhatsApp, Instagram, Facebook Messenger e outros canais integrados.",
};

export const PRIVACY_SECTIONS = [
  {
    title: "1. Introdução",
    paragraphs: [
      `A ${COMPANY.name} (${COMPANY.legalName}, CNPJ ${COMPANY.cnpj}), operadora do domínio ${COMPANY.domain}, respeita a sua privacidade e está comprometida com a proteção dos dados pessoais tratados no âmbito da nossa plataforma de atendimento multicanal.`,
      "Esta Política de Privacidade descreve como coletamos, usamos, armazenamos, compartilhamos e protegemos informações quando você utiliza nossos serviços, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e demais normas aplicáveis.",
      "Ao utilizar o StreamHub Chat, você declara ter lido e compreendido esta política.",
    ],
  },
  {
    title: "2. Quais dados coletamos",
    paragraphs: ["Podemos coletar e tratar as seguintes categorias de dados:"],
    list: [
      "Dados de cadastro: nome, e-mail, telefone, cargo, senha (armazenada de forma segura) e informações da empresa contratante.",
      "Dados de login e sessão: identificadores de autenticação, tokens de acesso, registros de data e hora de acesso.",
      "Dados de empresas/clientes: razão social, CNPJ, configurações da conta, plano contratado e preferências do painel.",
      "Contatos importados ou atendidos: nome, telefone, e-mail, identificadores de canais externos, etiquetas, histórico de atendimento e metadados associados.",
      "Mensagens trocadas nos canais conectados: conteúdo de conversas, anexos, status de entrega e leitura, quando necessários para a prestação do serviço.",
      "Dados técnicos: endereço IP, tipo de navegador, sistema operacional, logs de servidor, cookies e tecnologias semelhantes.",
    ],
  },
  {
    title: "3. Como usamos os dados",
    paragraphs: ["Utilizamos os dados coletados para as seguintes finalidades:"],
    list: [
      "Autenticação e controle de acesso à plataforma.",
      "Prestação do serviço de atendimento, roteamento de conversas e gestão de filas/setores.",
      "Integração com canais externos autorizados pelo cliente (WhatsApp, Instagram, Facebook Messenger, entre outros).",
      "Automação de fluxos, chatbots, campanhas e notificações configuradas pelo cliente.",
      "Suporte técnico, melhoria da plataforma, segurança, prevenção a fraudes e cumprimento de obrigações legais.",
      "Comunicações operacionais sobre o serviço, atualizações e avisos importantes.",
    ],
  },
  {
    title: "4. Integrações com terceiros",
    paragraphs: [
      "Para oferecer atendimento multicanal, o StreamHub Chat integra-se a serviços de terceiros, incluindo:",
    ],
    list: [
      "Meta (Facebook, Instagram, Messenger): para recebimento e envio de mensagens, comentários e eventos autorizados pelo usuário.",
      "WhatsApp: para conexão e gestão de conversas via integrações suportadas pela plataforma.",
      "Provedores de hospedagem e infraestrutura em nuvem: para armazenamento, processamento e disponibilidade do serviço.",
      "Serviços de notificação push, e-mail transacional e monitoramento, quando habilitados.",
    ],
    paragraphsAfterList: [
      "O uso dessas integrações depende das autorizações concedidas pelo titular da conta e das políticas dos respectivos provedores.",
    ],
  },
  {
    title: "5. Dados da Meta (Facebook / Instagram)",
    paragraphs: [
      "Quando o usuário conecta uma conta Instagram, Facebook ou Messenger à plataforma, o sistema pode acessar dados autorizados pela Meta, conforme as permissões concedidas no momento da conexão.",
      "Esses dados podem incluir: mensagens diretas e de Messenger, comentários, identificadores da conta profissional, nome de perfil, foto de perfil, metadados de conversas e demais informações necessárias para o atendimento.",
      "O tratamento desses dados ocorre exclusivamente para as finalidades autorizadas pelo cliente e em conformidade com as políticas da Meta e com esta Política de Privacidade.",
      "O cliente é responsável por obter as bases legais adequadas para tratar os dados de seus contatos finais.",
    ],
  },
  {
    title: "6. Compartilhamento de dados",
    paragraphs: [
      "Não vendemos dados pessoais. Podemos compartilhar informações apenas nas seguintes hipóteses:",
    ],
    list: [
      "Com provedores de tecnologia que nos auxiliam na operação da plataforma, sob contratos de confidencialidade e proteção de dados.",
      "Com autoridades públicas, quando exigido por lei, ordem judicial ou requisição legal válida.",
      "Com integradores de canais (Meta, WhatsApp, etc.) na medida necessária para o funcionamento das integrações autorizadas.",
      "Em operações societárias (fusão, aquisição), com as devidas salvaguardas.",
    ],
  },
  {
    title: "7. Armazenamento e segurança",
    paragraphs: [
      "Adotamos medidas técnicas e organizacionais para proteger os dados contra acesso não autorizado, perda, alteração ou divulgação indevida, incluindo criptografia de credenciais sensíveis, controle de acesso, logs de auditoria e boas práticas de desenvolvimento seguro.",
      "Apesar dos esforços empregados, nenhum sistema é totalmente imune a incidentes. Em caso de violação relevante, adotaremos as medidas cabíveis e comunicaremos os titulares e autoridades quando exigido por lei.",
    ],
  },
  {
    title: "8. Retenção e exclusão",
    paragraphs: [
      "Conservamos os dados pelo tempo necessário para cumprir as finalidades descritas nesta política, para atender obrigações legais, resolver disputas e fazer cumprir nossos acordos.",
      "Após o encerramento da conta, os dados podem ser mantidos por período adicional para backup, auditoria ou exigência legal, sendo posteriormente eliminados ou anonimizados de forma segura.",
    ],
  },
  {
    title: "9. Direitos do titular",
    paragraphs: [
      "Nos termos da LGPD, você pode solicitar, mediante requisição ao controlador:",
    ],
    list: [
      "Confirmação da existência de tratamento e acesso aos dados.",
      "Correção de dados incompletos, inexatos ou desatualizados.",
      "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.",
      "Portabilidade dos dados, quando aplicável.",
      "Informação sobre compartilhamentos realizados.",
      "Revogação do consentimento, quando o tratamento tiver essa base.",
    ],
  },
  {
    title: "10. Cookies e tecnologias semelhantes",
    paragraphs: [
      "Utilizamos cookies e tecnologias similares para manter sessões autenticadas, lembrar preferências, medir desempenho e melhorar a experiência de uso.",
      "Você pode configurar seu navegador para recusar cookies; parte das funcionalidades da plataforma pode deixar de funcionar corretamente nesse caso.",
    ],
  },
  {
    title: "11. Transferência internacional de dados",
    paragraphs: [
      "Alguns provedores de infraestrutura ou integrações podem processar dados em servidores localizados fora do Brasil, inclusive nos Estados Unidos e na União Europeia.",
      "Nesses casos, adotamos medidas contratuais e técnicas adequadas para garantir nível de proteção compatível com a legislação brasileira.",
    ],
  },
  {
    title: "12. Alterações nesta política",
    paragraphs: [
      "Podemos atualizar esta Política de Privacidade periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização indicada no topo.",
      "Alterações relevantes poderão ser comunicadas por e-mail ou aviso na plataforma.",
    ],
  },
  {
    title: "13. Contato para privacidade",
    paragraphs: [
      `Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato:`,
      `E-mail: ${COMPANY.email}`,
      `Empresa: ${COMPANY.legalName} — CNPJ ${COMPANY.cnpj}`,
      `Domínio: ${COMPANY.domain}`,
    ],
  },
  {
    title: "14. Exclusão de dados do usuário",
    paragraphs: [
      `Você pode solicitar a exclusão dos seus dados pessoais enviando um e-mail para ${COMPANY.email}, informando o nome, e-mail cadastrado e a solicitação de exclusão.`,
      "Analisaremos o pedido e responderemos nos prazos previstos na LGPD, ressalvadas as hipóteses de retenção legal ou contratual.",
      "Se você concedeu permissões a aplicativos da Meta (Facebook, Instagram ou Messenger), também pode revogá-las diretamente nas configurações de aplicativos e sites da Meta, em: Configurações → Segurança → Aplicativos e sites (ou equivalente na versão atual da plataforma Meta).",
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    title: "1. Aceitação dos termos",
    paragraphs: [
      `Estes Termos de Uso regulam o acesso e a utilização da plataforma ${COMPANY.name}, operada por ${COMPANY.legalName} (CNPJ ${COMPANY.cnpj}), disponível em ${COMPANY.domain}.`,
      "Ao criar uma conta, acessar ou utilizar o serviço, você declara ter lido, compreendido e aceito integralmente estes termos. Se não concordar, não utilize a plataforma.",
    ],
  },
  {
    title: "2. Descrição do serviço",
    paragraphs: [
      COMPANY.description,
      "O serviço é oferecido na modalidade SaaS (software como serviço), com funcionalidades que podem variar conforme o plano contratado e as integrações habilitadas.",
    ],
  },
  {
    title: "3. Cadastro e responsabilidade da conta",
    paragraphs: [
      "Para utilizar o serviço, é necessário fornecer informações verdadeiras e mantê-las atualizadas.",
      "Você é responsável pela confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.",
      "Deve notificar imediatamente o StreamHub Chat em caso de uso não autorizado ou suspeita de comprometimento da conta.",
      "Empresas que cadastram colaboradores são responsáveis pelo uso da plataforma por seus usuários.",
    ],
  },
  {
    title: "4. Uso permitido",
    paragraphs: [
      "O serviço destina-se ao uso profissional e legítimo para atendimento ao cliente, comunicação comercial autorizada, automação de fluxos e gestão de conversas.",
      "Você deve utilizar a plataforma em conformidade com a legislação aplicável, estes termos e as políticas dos canais integrados.",
    ],
  },
  {
    title: "5. Uso proibido",
    paragraphs: ["É expressamente proibido:"],
    list: [
      "Enviar spam, mensagens em massa não solicitadas ou comunicações abusivas.",
      "Publicar, transmitir ou armazenar conteúdo ilegal, difamatório, discriminatório, fraudulento ou que viole direitos de terceiros.",
      "Utilizar a plataforma para práticas de phishing, golpes, disseminação de malware ou qualquer atividade criminosa.",
      "Violar políticas de terceiros, incluindo as políticas da Meta, WhatsApp e demais provedores de canais.",
      "Fazer uso indevido de APIs, tokens ou integrações, incluindo tentativas de burlar limites técnicos ou de licenciamento.",
      "Realizar engenharia reversa, copiar ou redistribuir o software sem autorização.",
    ],
  },
  {
    title: "6. Integrações com canais externos",
    paragraphs: [
      "O StreamHub Chat permite integração com canais como Meta (Instagram, Facebook, Messenger), WhatsApp e outros, conforme disponibilidade.",
      "O uso dessas integrações depende das políticas, permissões e aprovações exigidas por cada plataforma, incluindo App Review da Meta quando aplicável.",
      "O cliente é responsável por manter suas contas e tokens válidos, cumprir as regras dos provedores e obter consentimentos necessários dos destinatários das mensagens.",
      "O StreamHub Chat não se responsabiliza por bloqueios, suspensões ou limitações impostas por terceiros em razão do uso inadequado das integrações.",
    ],
  },
  {
    title: "7. Responsabilidade do cliente sobre mensagens e contatos",
    paragraphs: [
      "O cliente é o controlador dos dados de seus contatos finais e responsável pelo conteúdo das mensagens enviadas e recebidas por meio da plataforma.",
      "O StreamHub Chat atua como operador de dados na medida em que processa informações em nome do cliente, conforme instruções e configurações definidas na conta.",
      "O cliente deve garantir base legal adequada (consentimento, legítimo interesse ou outra prevista em lei) para o tratamento e comunicação com seus contatos.",
    ],
  },
  {
    title: "8. Planos, pagamentos e suspensão",
    paragraphs: [
      "O acesso ao serviço pode estar condicionado à contratação de plano pago, conforme condições comerciais vigentes.",
      "Valores, periodicidade e formas de pagamento são informados no momento da contratação ou em comunicações oficiais.",
      "O não pagamento, violação destes termos ou uso abusivo da plataforma pode resultar em suspensão ou encerramento do acesso, sem prejuízo de outras medidas cabíveis.",
    ],
  },
  {
    title: "9. Disponibilidade e manutenção",
    paragraphs: [
      "Empregamos esforços razoáveis para manter a plataforma disponível, mas não garantimos operação ininterrupta ou livre de erros.",
      "Manutenções programadas, atualizações de segurança e eventos fora do nosso controle podem causar indisponibilidades temporárias.",
      "Comunicaremos manutenções relevantes quando possível.",
    ],
  },
  {
    title: "10. Segurança",
    paragraphs: [
      "Implementamos medidas de segurança compatíveis com a natureza do serviço. O cliente também deve adotar boas práticas, como senhas fortes, controle de acesso por perfil e proteção de tokens de integração.",
    ],
  },
  {
    title: "11. Propriedade intelectual",
    paragraphs: [
      "O software, marca, layout, documentação e demais elementos da plataforma são de propriedade do StreamHub Chat ou de seus licenciadores.",
      "A licença de uso concedida é limitada, não exclusiva, intransferível e revogável, restrita ao período de vigência contratual e às funcionalidades do plano contratado.",
    ],
  },
  {
    title: "12. Limitação de responsabilidade",
    paragraphs: [
      "Na máxima extensão permitida pela lei, o StreamHub Chat não será responsável por danos indiretos, lucros cessantes, perda de dados ou prejuízos decorrentes de uso indevido da plataforma, falhas de terceiros ou indisponibilidades além do razoavelmente controlável.",
      "A responsabilidade total do StreamHub Chat, quando aplicável, limita-se ao valor pago pelo cliente nos últimos 12 meses anteriores ao evento que originou a reclamação.",
    ],
  },
  {
    title: "13. Cancelamento e encerramento",
    paragraphs: [
      "O cliente pode solicitar o cancelamento conforme condições contratuais do plano.",
      "O StreamHub Chat pode encerrar ou suspender contas que violem estes termos, representem risco à segurança ou à reputação do serviço.",
      "Após o encerramento, o acesso à plataforma será desativado e os dados poderão ser excluídos conforme a Política de Privacidade e obrigações legais de retenção.",
    ],
  },
  {
    title: "14. Alterações nos termos",
    paragraphs: [
      "Podemos alterar estes Termos de Uso a qualquer momento. A versão atualizada será publicada nesta página com a data de revisão.",
      "O uso continuado do serviço após a publicação de alterações constitui aceitação dos novos termos.",
    ],
  },
  {
    title: "15. Contato",
    paragraphs: [
      `Dúvidas sobre estes termos podem ser enviadas para ${COMPANY.email}.`,
      `${COMPANY.legalName} — CNPJ ${COMPANY.cnpj}`,
      `Domínio: ${COMPANY.domain}`,
    ],
  },
];
