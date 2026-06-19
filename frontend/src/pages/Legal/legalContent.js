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
      `A ${COMPANY.name}, operada por ${COMPANY.legalName} (CNPJ ${COMPANY.cnpj}), disponível em ${COMPANY.domain}, respeita a sua privacidade e está comprometida com a proteção dos dados pessoais tratados no âmbito da nossa plataforma de atendimento multicanal.`,
      `${COMPANY.description}`,
      "Esta Política de Privacidade descreve de forma transparente como coletamos, usamos, armazenamos, compartilhamos e protegemos informações quando você utiliza nossos serviços, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e demais normas aplicáveis.",
      "Ao criar uma conta, conectar canais externos ou utilizar o StreamHub Chat de qualquer forma, você declara ter lido e compreendido esta política.",
    ],
  },
  {
    title: "2. Dados que coletamos",
    paragraphs: [
      "Coletamos e tratamos dados pessoais necessários para a prestação do serviço, conforme as categorias detalhadas nas seções seguintes. A coleta pode ocorrer diretamente por você, automaticamente pela plataforma ou por meio de integrações autorizadas com canais externos.",
      "Não coletamos dados além do necessário para as finalidades descritas nesta política, salvo quando houver base legal ou consentimento específico.",
    ],
  },
  {
    title: "3. Dados de cadastro e login",
    paragraphs: ["Ao registrar-se e acessar a plataforma, podemos tratar:"],
    list: [
      "Nome completo, e-mail corporativo ou pessoal, telefone e cargo do usuário.",
      "Senha de acesso (armazenada de forma criptografada; não conservamos a senha em texto legível).",
      "Identificadores de sessão, tokens de autenticação e registros de data e hora de login e logout.",
      "Preferências de idioma, configurações de notificação e perfil de permissões na plataforma.",
      "Endereço IP, dispositivo e navegador utilizados no momento do acesso, para fins de segurança.",
    ],
  },
  {
    title: "4. Dados de empresas e usuários",
    paragraphs: ["Para contas empresariais (multiusuário), também tratamos:"],
    list: [
      "Razão social, nome fantasia, CNPJ ou documento equivalente da empresa contratante.",
      "Plano contratado, status da assinatura, limites de uso e configurações administrativas.",
      "Dados de colaboradores e agentes cadastrados pelo administrador da conta (nome, e-mail, perfil de acesso, setores e filas).",
      "Configurações de filas, setores, etiquetas, respostas rápidas, fluxos de automação e integrações habilitadas.",
      "Registros de auditoria sobre ações relevantes realizadas na conta, quando aplicável.",
    ],
  },
  {
    title: "5. Contatos e mensagens processadas",
    paragraphs: [
      "O StreamHub Chat processa dados de contatos finais e o conteúdo de conversas em nome do cliente (empresa contratante), que atua como controlador desses dados:",
    ],
    list: [
      "Nome, telefone, e-mail, identificadores de canais (ex.: ID do WhatsApp, ID do Instagram) e foto de perfil, quando disponíveis.",
      "Contatos importados manualmente, via planilha ou sincronizados por integrações.",
      "Conteúdo de mensagens de texto, áudio, imagens, vídeos, documentos e demais anexos trocados nos canais conectados.",
      "Metadados de conversas: data e hora, status de entrega e leitura, protocolo de atendimento, fila, agente responsável e etiquetas.",
      "Histórico de atendimento, notas internas, avaliações e registros vinculados ao ticket de atendimento.",
    ],
    paragraphsAfterList: [
      "O tratamento desses dados ocorre exclusivamente para permitir o atendimento, a automação configurada pelo cliente e o cumprimento das funcionalidades contratadas.",
    ],
  },
  {
    title: "6. Dados vindos de integrações Meta, Facebook e Instagram",
    paragraphs: [
      "Quando o cliente conecta contas Instagram, Facebook ou Messenger à plataforma, o StreamHub Chat pode acessar dados autorizados pela Meta Platforms, Inc. e suas afiliadas, conforme as permissões concedidas no fluxo de autorização OAuth ou por token de acesso fornecido pelo cliente.",
      "Esses dados podem incluir, conforme o escopo autorizado:",
    ],
    list: [
      "Mensagens diretas (Instagram Direct, Messenger) e comentários em publicações.",
      "Identificadores da conta profissional ou página conectada (ID da conta, ID da página).",
      "Nome de usuário, nome de exibição, foto de perfil e informações públicas do perfil.",
      "Metadados de conversas necessários para roteamento, resposta e registro de atendimento.",
      "Eventos de webhook enviados pela Meta (novas mensagens, menções, comentários, entre outros suportados).",
      "Tokens de acesso e credenciais de integração (armazenados de forma criptografada).",
    ],
    paragraphsAfterList: [
      "O tratamento ocorre exclusivamente para as finalidades autorizadas pelo cliente e em conformidade com as Políticas da Plataforma Meta, os Termos de Uso do StreamHub Chat e esta Política de Privacidade.",
      "O cliente é responsável por obter as bases legais adequadas (consentimento, legítimo interesse ou outra prevista em lei) para tratar os dados de seus contatos finais recebidos por meio dessas integrações.",
    ],
  },
  {
    title: "7. Como usamos os dados",
    paragraphs: ["Utilizamos os dados coletados para as seguintes finalidades:"],
    list: [
      "Autenticação, controle de acesso e gestão de sessões na plataforma.",
      "Prestação do serviço de atendimento ao cliente, roteamento de conversas, distribuição em filas e setores.",
      "Integração com canais externos autorizados (WhatsApp, Instagram, Facebook Messenger e outros).",
      "Execução de fluxos de automação, chatbots, campanhas, agendamentos e respostas automáticas configuradas pelo cliente.",
      "Envio de notificações operacionais, alertas de novas mensagens e comunicações sobre o serviço.",
      "Suporte técnico, diagnóstico de problemas, melhoria contínua da plataforma e desenvolvimento de novas funcionalidades.",
      "Segurança da informação, prevenção a fraudes, detecção de abusos e cumprimento de obrigações legais e regulatórias.",
      "Faturamento, gestão contratual e comunicações relacionadas ao plano contratado.",
    ],
  },
  {
    title: "8. Compartilhamento de dados",
    paragraphs: [
      "Não vendemos, alugamos nem comercializamos dados pessoais. O compartilhamento ocorre apenas nas hipóteses abaixo:",
    ],
    list: [
      "Com provedores de tecnologia e infraestrutura (hospedagem em nuvem, banco de dados, CDN, monitoramento) que nos auxiliam na operação, sob contratos com cláusulas de confidencialidade e proteção de dados.",
      "Com integradores de canais (Meta/WhatsApp e similares) na medida estritamente necessária para o funcionamento das integrações autorizadas pelo cliente.",
      "Com serviços de notificação push, e-mail transacional e ferramentas de analytics, quando habilitados e necessários.",
      "Com autoridades públicas, órgãos reguladores ou terceiros, quando exigido por lei, ordem judicial ou requisição legal válida.",
      "Em operações societárias (fusão, aquisição, reorganização), com as devidas salvaguardas contratuais e comunicação aos titulares quando aplicável.",
    ],
    paragraphsAfterList: [
      "Em todos os casos, exigimos que os destinatários tratem os dados com o mesmo nível de proteção previsto nesta política.",
    ],
  },
  {
    title: "9. Armazenamento e segurança",
    paragraphs: [
      "Adotamos medidas técnicas e organizacionais adequadas para proteger os dados contra acesso não autorizado, perda, alteração, divulgação indevida ou destruição, incluindo:",
    ],
    list: [
      "Criptografia de credenciais sensíveis e tokens de integração (ex.: AES-256-GCM).",
      "Comunicação segura via HTTPS/TLS entre navegador, aplicativo e servidores.",
      "Controle de acesso baseado em perfis e permissões por usuário.",
      "Logs de auditoria, monitoramento de infraestrutura e práticas de desenvolvimento seguro.",
      "Backups periódicos e procedimentos de recuperação de desastres.",
    ],
    paragraphsAfterList: [
      "Apesar dos esforços empregados, nenhum sistema é totalmente imune a incidentes de segurança. Em caso de violação relevante de dados pessoais, adotaremos as medidas cabíveis e comunicaremos os titulares e a Autoridade Nacional de Proteção de Dados (ANPD), quando exigido por lei.",
    ],
  },
  {
    title: "10. Retenção e exclusão",
    paragraphs: [
      "Conservamos os dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, atender obrigações legais, resolver disputas e fazer cumprir nossos acordos contratuais.",
      "Após o encerramento da conta ou solicitação de exclusão, os dados podem ser mantidos por período adicional limitado para backup, auditoria, defesa de direitos ou cumprimento de obrigação legal, sendo posteriormente eliminados ou anonimizados de forma segura.",
      "Dados de conversas e contatos podem ser excluídos pelo administrador da conta conforme funcionalidades disponíveis na plataforma, ou mediante solicitação formal ao nosso canal de privacidade.",
    ],
  },
  {
    title: "11. Direitos do titular",
    paragraphs: [
      "Nos termos da LGPD, você, como titular de dados pessoais, pode exercer os seguintes direitos mediante requisição ao controlador:",
    ],
    list: [
      "Confirmação da existência de tratamento e acesso aos seus dados pessoais.",
      "Correção de dados incompletos, inexatos ou desatualizados.",
      "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.",
      "Portabilidade dos dados a outro fornecedor de serviço, quando aplicável.",
      "Eliminação dos dados tratados com base no consentimento, salvo hipóteses legais de retenção.",
      "Informação sobre entidades públicas e privadas com as quais compartilhamos dados.",
      "Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa.",
      "Revogação do consentimento, quando o tratamento tiver essa base legal.",
    ],
    paragraphsAfterList: [
      `Para exercer seus direitos, envie solicitação para ${COMPANY.email} com identificação do titular e descrição do pedido. Responderemos nos prazos previstos na legislação aplicável.`,
    ],
  },
  {
    title: "12. Cookies e tecnologias semelhantes",
    paragraphs: [
      "Utilizamos cookies, localStorage e tecnologias similares para:",
    ],
    list: [
      "Manter sessões autenticadas e tokens de acesso.",
      "Lembrar preferências de idioma, tema e configurações da interface.",
      "Medir desempenho, diagnosticar erros e melhorar a experiência de uso.",
      "Viabilizar notificações push e funcionalidades de terceiros integradas.",
    ],
    paragraphsAfterList: [
      "Você pode configurar seu navegador para recusar cookies ou alertá-lo quando cookies forem enviados. A desativação de cookies essenciais pode impedir o funcionamento correto de partes da plataforma, incluindo o login.",
    ],
  },
  {
    title: "13. Transferência internacional de dados",
    paragraphs: [
      "Alguns provedores de infraestrutura, serviços em nuvem e integrações (incluindo Meta/WhatsApp) podem processar ou armazenar dados em servidores localizados fora do Brasil, inclusive nos Estados Unidos e na União Europeia.",
      "Nesses casos, adotamos medidas contratuais (cláusulas-padrão, acordos de processamento de dados) e técnicas adequadas para garantir nível de proteção compatível com a legislação brasileira, em especial a LGPD.",
      "Ao utilizar integrações com plataformas internacionais, o cliente reconhece que parte do tratamento pode ocorrer nos países onde esses provedores operam.",
    ],
  },
  {
    title: "14. Exclusão de dados do usuário",
    paragraphs: [
      `Você pode solicitar a exclusão dos seus dados pessoais a qualquer momento, enviando e-mail para ${COMPANY.email} com o assunto "Solicitação de exclusão de dados", informando nome completo, e-mail cadastrado e descrição do pedido.`,
      "Analisaremos a solicitação e responderemos nos prazos previstos na LGPD, ressalvadas as hipóteses em que a retenção seja necessária por obrigação legal, exercício regular de direitos ou proteção de crédito.",
      "Para dados de contatos finais e conversas processados em nome de uma empresa cliente, a solicitação de exclusão deve ser direcionada preferencialmente ao controlador (empresa que utiliza a plataforma), que poderá acionar nosso suporte quando necessário.",
      "Se você concedeu permissões a aplicativos da Meta (Facebook, Instagram ou Messenger), também pode revogá-las diretamente nas configurações da Meta: acesse Configurações → Segurança → Aplicativos e sites (ou equivalente na versão atual da plataforma Meta) e remova o acesso do StreamHub Chat.",
    ],
  },
  {
    title: "15. Alterações nesta política",
    paragraphs: [
      "Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas, funcionalidades ou requisitos legais.",
      "A versão vigente estará sempre disponível nesta página, com a data da última atualização indicada no topo.",
      "Alterações relevantes poderão ser comunicadas por e-mail, aviso na plataforma ou outros meios adequados. O uso continuado do serviço após a publicação de alterações constitui ciência da nova versão.",
    ],
  },
  {
    title: "16. Contato para privacidade",
    paragraphs: [
      "Para dúvidas, solicitações ou reclamações relacionadas a esta Política de Privacidade e ao tratamento de dados pessoais, entre em contato:",
      `E-mail: ${COMPANY.email}`,
      `Empresa: ${COMPANY.legalName}`,
      `CNPJ: ${COMPANY.cnpj}`,
      `Domínio: ${COMPANY.domain}`,
      "Encarregado de dados (DPO): disponível pelo mesmo e-mail acima, com assunto \"Privacidade / DPO\".",
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    title: "1. Aceitação dos termos",
    paragraphs: [
      `Estes Termos de Uso ("Termos") regulam o acesso e a utilização da plataforma ${COMPANY.name}, operada por ${COMPANY.legalName} (CNPJ ${COMPANY.cnpj}), disponível em ${COMPANY.domain}.`,
      "Ao criar uma conta, conectar canais, acessar ou utilizar qualquer funcionalidade do serviço, você declara ter lido, compreendido e aceito integralmente estes Termos e a nossa Política de Privacidade.",
      "Se você não concordar com qualquer disposição destes Termos, não utilize a plataforma.",
      "Se estiver aceitando em nome de uma empresa, você declara ter poderes para vinculá-la a estes Termos.",
    ],
  },
  {
    title: "2. Descrição do serviço",
    paragraphs: [
      `${COMPANY.name} é ${COMPANY.description.toLowerCase()}`,
      "O serviço é oferecido na modalidade SaaS (software como serviço), acessível via navegador web, com funcionalidades que podem variar conforme o plano contratado, permissões do usuário e integrações habilitadas.",
      "Funcionalidades podem incluir, entre outras: gestão de tickets de atendimento, chat multicanal, filas e setores, automações, campanhas, CRM, relatórios, gestão de contatos e integrações com APIs de terceiros.",
      "Reservamo-nos o direito de modificar, adicionar ou descontinuar funcionalidades, mediante comunicação prévia quando razoavelmente possível.",
    ],
  },
  {
    title: "3. Cadastro e conta",
    paragraphs: [
      "Para utilizar o serviço, é necessário criar uma conta fornecendo informações verdadeiras, completas e atualizadas.",
      "Você é responsável pela confidencialidade de suas credenciais de acesso (e-mail e senha) e por todas as atividades realizadas em sua conta, inclusive por colaboradores e agentes que você cadastrar.",
      "Deve notificar imediatamente o StreamHub Chat em caso de uso não autorizado, suspeita de comprometimento da conta ou vazamento de credenciais.",
      "Empresas que cadastram múltiplos usuários são responsáveis por definir perfis de acesso adequados, revogar acessos de ex-colaboradores e garantir que seus usuários cumpram estes Termos.",
      "É proibido compartilhar credenciais entre pessoas ou utilizar uma única conta para múltiplos operadores sem a devida configuração de usuários individuais.",
    ],
  },
  {
    title: "4. Uso permitido",
    paragraphs: [
      "O serviço destina-se exclusivamente ao uso profissional e legítimo para:",
    ],
    list: [
      "Atendimento ao cliente e suporte comercial autorizado.",
      "Comunicação com contatos que tenham relação prévia ou consentimento adequado com a empresa.",
      "Automação de fluxos de atendimento, qualificação de leads e gestão de conversas.",
      "Gestão interna de equipes, filas, protocolos e histórico de atendimento.",
    ],
    paragraphsAfterList: [
      "Você deve utilizar a plataforma em conformidade com a legislação aplicável (incluindo LGPD, Marco Civil da Internet e normas de telecomunicações), estes Termos, a Política de Privacidade e as políticas dos canais integrados.",
    ],
  },
  {
    title: "5. Uso proibido",
    paragraphs: ["É expressamente proibido utilizar o StreamHub Chat para:"],
    list: [
      "Enviar spam, mensagens em massa não solicitadas, comunicações abusivas ou práticas de marketing sem base legal adequada.",
      "Publicar, transmitir ou armazenar conteúdo ilegal, difamatório, discriminatório, fraudulento, pornográfico infantil ou que viole direitos de terceiros.",
      "Praticar phishing, golpes, esquemas fraudulentos, disseminação de malware ou qualquer atividade criminosa.",
      "Violar políticas de terceiros, incluindo as Políticas Comerciais e de Plataforma da Meta, os Termos de Serviço do WhatsApp e demais provedores de canais.",
      "Fazer uso indevido de APIs, tokens, webhooks ou integrações, incluindo tentativas de burlar limites técnicos, quotas, App Review ou licenciamento.",
      "Realizar engenharia reversa, descompilar, copiar, redistribuir ou sublicenciar o software sem autorização expressa.",
      "Sobrecarregar intencionalmente a infraestrutura ou interferir no funcionamento da plataforma ou de terceiros.",
      "Coletar dados de terceiros sem base legal ou consentimento adequado.",
    ],
    paragraphsAfterList: [
      "A violação destas regras pode resultar em suspensão imediata, encerramento da conta e medidas legais cabíveis.",
    ],
  },
  {
    title: "6. Integrações com Meta, Instagram, Facebook e WhatsApp",
    paragraphs: [
      "O StreamHub Chat permite integração com canais operados pela Meta Platforms, Inc. e afiliadas (Instagram, Facebook, Messenger) e com o WhatsApp, conforme disponibilidade técnica e plano contratado.",
      "O uso dessas integrações está sujeito a:",
    ],
    list: [
      "Políticas da Plataforma Meta, Termos de Serviço do WhatsApp Business e demais documentos oficiais dos provedores.",
      "Processo de App Review e aprovação de permissões (scopes) exigidos pela Meta, quando aplicável.",
      "Limites de taxa (rate limits), quotas de mensagens e regras de janela de atendimento (ex.: janela de 24 horas no WhatsApp).",
      "Manutenção de tokens válidos, renovação de credenciais e configuração correta de webhooks pelo cliente.",
    ],
    paragraphsAfterList: [
      "O cliente é responsável por manter suas contas nas plataformas de terceiros em conformidade, obter consentimentos necessários dos destinatários e utilizar as integrações apenas para finalidades autorizadas.",
      "O StreamHub Chat não se responsabiliza por bloqueios, suspensões, limitações de API, rejeições de App Review ou penalidades impostas por terceiros em razão do uso inadequado das integrações pelo cliente.",
    ],
  },
  {
    title: "7. Responsabilidade do cliente por contatos e mensagens",
    paragraphs: [
      "O cliente (empresa contratante) é o controlador dos dados pessoais de seus contatos finais e é integralmente responsável pelo conteúdo das mensagens enviadas e recebidas por meio da plataforma.",
      "O StreamHub Chat atua como operador de dados na medida em que processa informações em nome do cliente, conforme instruções, configurações e integrações definidas na conta.",
      "O cliente deve garantir base legal adequada (consentimento, execução de contrato, legítimo interesse ou outra prevista em lei) para o tratamento e comunicação com seus contatos.",
      "O cliente é responsável por honrar solicitações de titulares (acesso, correção, exclusão) relativas aos dados que controla, podendo solicitar apoio técnico ao StreamHub Chat quando necessário.",
      "O StreamHub Chat não monitora proativamente o conteúdo das mensagens, mas pode remover conteúdo ou suspender contas que violem estes Termos ou a legislação aplicável.",
    ],
  },
  {
    title: "8. Planos, pagamentos e suspensão",
    paragraphs: [
      "O acesso ao serviço pode estar condicionado à contratação de plano pago, período de teste ou acordo comercial específico.",
      "Valores, periodicidade (mensal, anual), formas de pagamento e limites de uso são informados no momento da contratação, na área financeira da plataforma ou em proposta comercial.",
      "O não pagamento nas datas acordadas, violação destes Termos, uso abusivo da plataforma ou risco à segurança/reputação do serviço pode resultar em:",
    ],
    list: [
      "Suspensão temporária do acesso.",
      "Limitação de funcionalidades ou integrações.",
      "Encerramento definitivo da conta, sem prejuízo de cobrança de valores em aberto.",
      "Adoção de medidas legais para ressarcimento de danos.",
    ],
    paragraphsAfterList: [
      "Reajustes de preço serão comunicados com antecedência mínima conforme contrato ou legislação aplicável.",
    ],
  },
  {
    title: "9. Disponibilidade e manutenção",
    paragraphs: [
      "Empregamos esforços comercialmente razoáveis para manter a plataforma disponível e funcional, mas não garantimos operação ininterrupta, livre de erros ou imune a falhas de terceiros.",
      "Manutenções programadas, atualizações de segurança, alterações em APIs de terceiros e eventos de força maior podem causar indisponibilidades temporárias.",
      "Comunicaremos manutenções programadas relevantes com antecedência razoável, quando possível, por e-mail ou aviso na plataforma.",
      "O StreamHub Chat não se responsabiliza por perdas decorrentes de indisponibilidades causadas por provedores de internet, Meta, WhatsApp, hospedagem de terceiros ou fatores fora do nosso controle razoável.",
    ],
  },
  {
    title: "10. Segurança",
    paragraphs: [
      "Implementamos medidas de segurança compatíveis com a natureza do serviço, incluindo criptografia de credenciais, HTTPS, controle de acesso e monitoramento.",
      "O cliente também deve adotar boas práticas de segurança:",
    ],
    list: [
      "Utilizar senhas fortes e únicas.",
      "Não compartilhar credenciais ou tokens de integração.",
      "Configurar perfis de acesso com o princípio do menor privilégio.",
      "Revogar acessos de colaboradores desligados.",
      "Manter tokens de API e webhooks em sigilo.",
    ],
    paragraphsAfterList: [
      "Em caso de incidente de segurança que afete sua conta, notifique-nos imediatamente em " + COMPANY.email + ".",
    ],
  },
  {
    title: "11. Propriedade intelectual",
    paragraphs: [
      "O software, código-fonte, marca, logotipos, layout, documentação, fluxos, algoritmos e demais elementos da plataforma são de propriedade exclusiva do StreamHub Chat ou de seus licenciadores, protegidos pelas leis de propriedade intelectual.",
      "A licença de uso concedida ao cliente é limitada, não exclusiva, intransferível e revogável, restrita ao período de vigência contratual e às funcionalidades do plano contratado.",
      "É proibida a reprodução, modificação, distribuição ou criação de obras derivadas do software sem autorização expressa por escrito.",
      "Conteúdos enviados pelo cliente (mensagens, arquivos, configurações) permanecem de propriedade do cliente, que nos concede licença limitada para processá-los na prestação do serviço.",
    ],
  },
  {
    title: "12. Limitação de responsabilidade",
    paragraphs: [
      "Na máxima extensão permitida pela legislação aplicável, o StreamHub Chat, seus diretores, funcionários e parceiros não serão responsáveis por:",
    ],
    list: [
      "Danos indiretos, incidentais, especiais, punitivos ou consequenciais.",
      "Lucros cessantes, perda de receita, perda de dados ou perda de oportunidades de negócio.",
      "Prejuízos decorrentes de uso indevido da plataforma pelo cliente ou seus usuários.",
      "Falhas, bloqueios ou alterações impostas por terceiros (Meta, WhatsApp, provedores de internet).",
      "Indisponibilidades além do razoavelmente controlável pela nossa infraestrutura.",
    ],
    paragraphsAfterList: [
      "A responsabilidade total do StreamHub Chat, quando aplicável e não excluída por lei, limita-se ao valor efetivamente pago pelo cliente nos últimos 12 (doze) meses anteriores ao evento que originou a reclamação.",
      "Nada nestes Termos exclui responsabilidades que não possam ser limitadas por lei, incluindo dolo ou culpa grave.",
    ],
  },
  {
    title: "13. Cancelamento e encerramento",
    paragraphs: [
      "O cliente pode solicitar o cancelamento da conta conforme condições contratuais do plano, pela área financeira da plataforma ou por solicitação a " + COMPANY.email + ".",
      "O StreamHub Chat pode encerrar ou suspender contas que:",
    ],
    list: [
      "Violem estes Termos ou a Política de Privacidade.",
      "Representem risco à segurança, à estabilidade da plataforma ou à reputação do serviço.",
      "Estejam inadimplentes por período superior ao previsto contratualmente.",
      "Sejam utilizadas para atividades ilegais ou proibidas.",
    ],
    paragraphsAfterList: [
      "Após o encerramento, o acesso à plataforma será desativado. Os dados poderão ser excluídos ou anonimizados conforme a Política de Privacidade e obrigações legais de retenção.",
      "Disposições que por sua natureza devam sobreviver ao encerramento (propriedade intelectual, limitação de responsabilidade, lei aplicável) permanecerão em vigor.",
    ],
  },
  {
    title: "14. Alterações nos termos",
    paragraphs: [
      "Podemos alterar estes Termos de Uso a qualquer momento para refletir mudanças no serviço, requisitos legais ou práticas comerciais.",
      "A versão atualizada será publicada nesta página com a data de revisão indicada no topo.",
      "Alterações relevantes poderão ser comunicadas por e-mail ou aviso na plataforma com antecedência razoável.",
      "O uso continuado do serviço após a publicação de alterações constitui aceitação dos novos termos. Se não concordar, deve encerrar sua conta antes da vigência das alterações.",
    ],
  },
  {
    title: "15. Contato",
    paragraphs: [
      "Dúvidas, solicitações ou comunicações sobre estes Termos de Uso podem ser enviadas para:",
      `E-mail: ${COMPANY.email}`,
      `Empresa: ${COMPANY.legalName}`,
      `CNPJ: ${COMPANY.cnpj}`,
      `Domínio: ${COMPANY.domain}`,
      "Responderemos em prazo razoável, preferencialmente em até 15 dias úteis para solicitações formais.",
    ],
  },
];
