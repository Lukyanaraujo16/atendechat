const messages = {
  pt: {
    translations: {
      selectLanguage: "Selecione um idioma",
      passwordPolicy: {
        requirements:
          "A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, letra minúscula e número.",
      },
      planFeature: {
        blockedTitle: "Recurso indisponível",
        blockedBody:
          "Este recurso não está disponível no seu plano. Contacte o administrador da plataforma para mais opções.",
      },
      signup: {
        title: "Cadastre-se",
        toasts: {
          success:
            "Pedido enviado! Um administrador irá analisar o seu cadastro. Após aprovação, receberá um e-mail para definir a palavra-passe e aceder à conta.",
          fail: "Não foi possível enviar o pedido. Verifique os dados.",
        },
        form: {
          name: "Nome da empresa",
          adminName: "Nome do responsável",
          email: "Email",
          phone: "Telefone com (DDD)",
          plan: "Plano",
          notes: "Observações (opcional)",
        },
        formErrors: {
          name: {
            required: "Nome da empresa é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          adminName: {
            required: "Nome do responsável é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          notes: {
            long: "Texto demasiado longo",
          },
          password: {
            required: "Senha é obrigatória",
            short: "Senha muito curta",
            long: "Senha muito longa",
          },
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
          acceptTerms: "É necessário aceitar a política de privacidade e os termos de uso.",
        },
        legal: {
          iAgree: "Li e aceito a",
          and: "e os",
        },
        buttons: {
          submit: "Cadastrar",
          submitRequest: "Enviar pedido de cadastro",
          login: "Já tem uma conta? Entre!",
        },
        plan: {
          attendant: "Atendente",
          whatsapp: "WhatsApp",
          queues: "Setores",
        },
      },
      login: {
        title: "Login",
        form: {
          email: "Email",
          password: "Senha",
        },
        buttons: {
          submit: "Entrar",
          register: "Registre-se, agora mesmo!",
        },
        whatsApp: {
          badge: "Suporte disponível",
          ariaLabel: "Abrir WhatsApp",
        },
        links: {
          forgotPassword: "Esqueci minha senha",
          signup: "Não tem uma conta? Cadastre-se!",
        },
        footer: {
          privacy: "Política de Privacidade",
          terms: "Termos de Uso",
        },
      },
      legal: {
        updated: "Última atualização: abril de 2026.",
        privacy: {
          title: "Política de Privacidade",
          intro:
            "Esta política descreve como tratamos dados pessoais no âmbito do serviço StreamHUB Chat / AtendeChat.",
          collectTitle: "1. Dados que recolhemos",
          collectBody:
            "Podemos recolher nome, e-mail, telefone, dados da empresa, conteúdos de conversas necessários à prestação do serviço, registos técnicos (logs) e dados de utilização da plataforma.",
          useTitle: "2. Finalidade e uso",
          useBody:
            "Os dados são utilizados para criar e gerir a conta, prestar suporte, faturação, segurança, melhoria do produto e cumprimento de obrigações legais.",
          securityTitle: "3. Segurança e retenção",
          securityBody:
            "Aplicamos medidas técnicas e organizativas adequadas. Conservamos os dados pelo tempo necessário às finalidades descritas ou exigido por lei.",
          rightsTitle: "4. Os seus direitos",
          rightsBody:
            "Pode solicitar acesso, retificação, eliminação ou oposição ao tratamento, conforme a legislação aplicável, contactando o responsável pelo serviço.",
          contactTitle: "5. Contato",
          contactBody:
            "Para questões sobre privacidade, utilize os canais de suporte indicados no site ou na aplicação.",
        },
        terms: {
          title: "Termos de Uso",
          intro:
            "Ao utilizar o serviço, aceita estes termos. Leia-os com atenção antes de continuar.",
          useTitle: "1. Uso do serviço",
          useBody:
            "O serviço destina-se a uso profissional legítimo. É proibido utilizar a plataforma para spam, conteúdo ilícito ou que viole direitos de terceiros.",
          accountTitle: "2. Conta e credenciais",
          accountBody:
            "É responsável pela confidencialidade da palavra-passe e pelas atividades realizadas na sua conta. Notifique-nos em caso de uso não autorizado.",
          liabilityTitle: "3. Limitação de responsabilidade",
          liabilityBody:
            "O serviço é fornecido «como está». Não nos responsabilizamos por danos indiretos, perda de lucros ou indisponibilidades além do razoavelmente controlável.",
          changesTitle: "4. Alterações",
          changesBody:
            "Podemos atualizar estes termos; a versão vigente estará sempre disponível nesta página.",
        },
      },
      resetPassword: {
        title: "Recuperar senha",
        subtitleRequest:
          "Indique o e-mail da sua conta. Se existir registo, receberá um código e um link por e-mail (válido por 1 hora).",
        subtitleReset: "Introduza o código recebido por e-mail e defina a nova palavra-passe.",
        toasts: {
          emailSent:
            "Se o e-mail estiver registado, enviámos instruções. Verifique a caixa de entrada e o spam.",
          emailNotFound: "Email não encontrado!",
          passwordUpdated: "Palavra-passe atualizada com sucesso. Já pode iniciar sessão.",
        },
        formErrors: {
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
          token: {
            required: "O código de verificação é obrigatório",
          },
          newPassword: {
            required: "Nova senha é obrigatória",
            matches:
                "Sua senha precisa ter no mínimo 8 caracteres, sendo uma letra maiúscula, uma minúscula e um número.",
          },
          confirmPassword: {
            required: "Confirmação de senha é obrigatória",
            matches: "As senhas não correspondem",
          },
        },
        form: {
          email: "Email",
          verificationCode: "Código de verificação",
          newPassword: "Nova senha",
          confirmPassword: "Confirme a nova senha",
        },
        buttons: {
          submitEmail: "Enviar instruções",
          submitPassword: "Guardar nova palavra-passe",
          goSignup: "Não tem uma conta? Cadastre-se!",
          goLogin: "Voltar ao login",
          alreadyHaveCode: "Já tenho o código",
          backToRequest: "Solicitar novo código por e-mail",
        },
      },
      dashboard: {
        title: "Dashboard",
        subtitle: "Visão geral dos atendimentos e indicadores",
        header: {
          filters: "Filtros",
          createReport: "Criar Relatório (BETA)",
        },
        cards: {
          totalAttendances: "Total de Atendimentos",
          inAttendance: "Em Atendimento",
          resolutionRate: "Taxa Resolução",
          ofTotal: "Do Total",
          statusWaiting: "Status: Aguardando Atendimento",
          avgFirstResponse: "Tempo Médio 1° Resposta",
          inMinutes: "Em Minutos",
          status: "Status",
          totalMessages: "Total de Mensagens",
          sent: "Enviadas",
          received: "Recebidas",
        },
        toasts: {
          selectFilterError: "Parametrize o filtro",
          userChartError: "Erro ao obter informações da conversa",
          dateChartError: "Erro ao obter informações da conversa",
        },
        filters: {
          initialDate: "Data Inicial",
          finalDate: "Data Final",
          filterType: {
            title: "Tipo de Filtro",
            options: {
              perDate: "Filtro por Data",
              perPeriod: "Filtro por Período",
            },
            helper: "Selecione o tipo de filtro desejado",
          },
        },
        periodSelect: {
          title: "Período",
          options: {
            today: "Hoje",
            last7: "7 dias",
            last15: "15 dias",
            last30: "30 dias",
            custom: "Personalizado",
          },
          helper: "Selecione o período desejado",
        },
        counters: {
          inTalk: "Em conversa",
          waiting: "Aguardando",
          finished: "Finalizados",
          newContacts: "Novos contatos",
          averageTalkTime: "T.M. de Conversa",
          averageWaitTime: "T.M. de Espera",
        },
        buttons: {
          filter: "Filtrar",
        },
        reports: {
          title: "Relatórios",
          subtitle: "Analise indicadores e performance do seu atendimento",
          print: "Imprimir",
          generatedAt: "Gerado em",
          filter: {
            period: "Período",
            from: "De",
            to: "Até",
            apply: "Atualizar",
          },
          period: {
            last3: "Últimos 3 dias",
            last7: "Últimos 7 dias",
            last15: "Últimos 15 dias",
            last30: "Últimos 30 dias",
            last60: "Últimos 60 dias",
            last90: "Últimos 90 dias",
            custom: "Personalizado",
          },
          types: {
            summary: "Resumo Geral",
            summaryDesc: "Visão consolidada de atendimentos, tempos e indicadores",
            attendances: "Atendimentos por Período",
            attendancesDesc: "Distribuição de tickets por data e horário",
            users: "Performance de Usuários",
            usersDesc: "Atendimentos por atendente no período",
            messages: "Relatório de Mensagens",
            messagesDesc: "Volume de mensagens enviadas e recebidas",
          },
          summary: {
            title: "Resumo do Período",
            totalAttendances: "Total de Atendimentos",
            inProgress: "Em Atendimento",
            pending: "Pendentes",
            finished: "Finalizados",
            resolutionRate: "Taxa de Resolução",
            avgFirstResponse: "Tempo Médio 1ª Resposta",
            avgSupportTime: "Tempo Médio Atendimento",
            totalMessages: "Total de Mensagens",
            byUser: "Por Usuário",
          },
          attendances: {
            title: "Atendimentos por Período",
            tickets: "Atendimentos",
          },
          users: {
            title: "Performance de Usuários",
            tickets: "Atendimentos",
          },
          messages: {
            title: "Relatório de Mensagens",
            sent: "Mensagens Enviadas",
            received: "Mensagens Recebidas",
            total: "Total de Mensagens",
          },
        },
        onlineTable: {
          title: "Status dos atendentes",
          ratingLabel: "1 - Insatisfeito, 2 - Satisfeito, 3 - Muito Satisfeito",
          name: "Nome",
          ratings: "Avaliações",
          avgSupportTime: "T.M. de Atendimento",
          status: "Status (Atual)",
        },
        charts: {
          user: {
            label: "Gráfico de Conversas",
            title: "Total de Conversas por Usuários",
            start: "Início",
            end: "Fim",
            filter: "Filtrar",
            tickets: "atendimentos",
          },
          date: {
            label: "Gráfico de Conversas",
            title: "Total",
            start: "Início",
            end: "Fim",
            filter: "Filtrar",
            tickets: "atendimentos",
          },
        },
      },
      plans: {
        toasts: {
          errorList: "Não foi possível carregar a lista de registros",
          errorOperation: "Não foi possível realizar a operação",
          error:
              "Não foi possível realizar a operação. Verifique se já existe uma plano com o mesmo nome ou se os campos foram preenchidos corretamente",
          success: "Operação realizada com sucesso!",
        },
        confirm: {
          title: "Exclusão de Registro",
          message: "Deseja realmente excluir o registro?",
        },
        form: {
          name: "Nome",
          users: "Usuários",
          connections: "Conexões",
          queues: "Setores",
          value: "Valor",
          internalChat: "Chat Interno",
          internalChatHelp:
            "Mensagens internas entre utilizadores da mesma empresa (fora do WhatsApp).",
          modulesSectionTitle: "Módulos do plano",
          modulesSectionHint:
            "Estes interruptores definem o que o plano permite por defeito. As empresas herdam estes valores e podem ajustar em Plataforma → Empresas.",
          featuresSectionTitle: "Módulos e funcionalidades",
          featuresSectionHint:
            "Marque cada recurso permitido pelo plano. Os itens são independentes (filho não exige pai). Novas funcionalidades são registadas em config/features sem novas colunas na tabela de planos.",
          externalApi: "API Externa",
          kanban: "Kanban",
          integrations: "Integrações",
          campaigns: "Campanhas",
          schedules: "Agendamentos",
          enabled: "Habilitadas",
          disabled: "Desabilitadas",
          clear: "Cancelar",
          delete: "Excluir",
          save: "Salvar",
          yes: "Sim",
          no: "Não",
          money: "R$",
          nameRequired: "Informe o nome do plano",
          valueRequired: "Informe o valor do plano",
          valueInvalid:
              "Valor inválido. Ex.: 99,90 · 1.299,90 · R$ 99,90",
          limitsSectionTitle: "Limites do plano",
          featuresProgressSummary: "{{active}} de {{total}} funcionalidades ativas",
          featureGroupCount: "{{active}}/{{total}} ativos",
          expandModule: "Expandir módulo",
          collapseModule: "Recolher módulo",
          selectAllFeatures: "Marcar todos",
          clearAllFeatures: "Desmarcar todos",
        },
        table: {
          companies: "Empresas",
          aria: "Tabela de planos",
          featureSummary: "Recursos",
          activeModulesCount: "{{count}} módulos ativos",
          featureSummaryEmpty: "Nenhum extra",
          activeFeaturesCount: "{{count}} funcionalidades ativas",
          moreFeatureGroups: "+{{count}}",
          featureTooltipIntro: "Outros módulos com funcionalidades ativas:",
        },
        featureGroups: {
          dashboard: "Dashboard",
          attendance: "Atendimento",
          automation: "Automação",
          agenda: "Agenda",
          team: "Equipe",
          finance: "Financeiro",
          campaigns: "Campanhas",
          contacts: "Contatos",
          settings: "Configurações",
        },
      },
      kanban: {
        toasts: {
          removed: "Ticket Tag Removido!",
          added: "Ticket Tag Adicionado com Sucesso!",
        },
        open: "Em aberto",
        seeTicket: "Ver Ticket",
        column: {
          pending: "Aguardando",
          open: "Em atendimento",
          closed: "Finalizado",
        },
        lastInteraction: "Última interação",
        queue: "Setor",
        attendant: "Atendente",
        unread: "Não lidas",
        emptyColumnTitle: "Nada por aqui",
        emptyColumnHint: "Arraste um card de outra coluna ou aguarde novos tickets.",
        noQueuesHint:
          "Nenhum setor vinculado ao seu usuário. O Kanban precisa de filas para listar tickets.",
        loading: "Carregando quadro…",
        quickActions: {
          menuAria: "Ações do ticket",
          transferTooltip: "Transferir conversa",
          transferConversation: "Transferir conversa",
          assign: "Atribuir atendente",
          unassign: "Remover atendente",
          changeQueue: "Alterar setor",
          tags: "Tags",
          close: "Fechar ticket",
          selectUser: "Atendente",
          selectUserOptional: "Atendente (opcional)",
          keepCurrentAttendant: "Manter atendente atual",
          selectQueue: "Setor",
          tagsPlaceholder: "Selecione as tags",
          confirmClose:
            "Fechar este ticket? O atendimento será encerrado conforme as regras já configuradas (mensagens automáticas, pesquisa, etc.).",
          confirmTransferUser:
            "Deseja realmente transferir este atendimento para outro atendente?",
          cancel: "Cancelar",
          save: "Salvar",
          confirm: "Confirmar",
          noAttendantsForQueue:
            "Nenhum atendente disponível para este setor. Pode transferir só o setor.",
        },
      },
      invoices: {
        title: "Faturas",
        pageSubtitle: "Faturas e pagamento via PIX.",
        paid: "Pago",
        open: "Em Aberto",
        expired: "Vencido",
        details: "Detalhes",
        value: "Valor",
        dueDate: "Data Venc.",
        status: "Status",
        action: "Ação",
        PAY: "PAGAR",
        PAID: "PAGO",
        searchPlaceholder: "Buscar por ID ou descrição…",
        empty: "Nenhuma fatura encontrada.",
        emptyHint: "As faturas geradas pelo sistema aparecerão aqui.",
        statusLabels: {
          paid: "Paga",
          overdue: "Vencida",
          open: "Em aberto",
        },
      },
      finance: {
        banner: {
          message:
            "Sua empresa está com pagamento em atraso. Regularize para manter o serviço em dia.",
          action: "Abrir Financeiro",
        },
        page: {
          delinquentAlert:
            "Há pendência de pagamento. O PIX usa sempre o valor da fatura que escolher na lista.",
        },
        login: {
          expiringSoon:
            "Sua assinatura vence em {{days}} dia(s). Considere renovar em Financeiro.",
          delinquentWarning:
            "Atenção: há pendência de pagamento. Acesse Financeiro para regularizar com PIX.",
        },
      },
      checkoutPage: {
        modalTitle: "Pagamento via PIX",
        noInvoice:
          "Para pagar com PIX, abra Financeiro e use Pagar na fatura pretendida.",
        pixFlowTitle: "Pagamento de fatura — PIX",
        pixFlowSubtitle:
          "O PIX será gerado com o valor da fatura. O plano abaixo indica só limites — não é o valor cobrado.",
        steps: {
          data: "Dados",
          customize: "Personalizar",
          review: "Revisar",
          plan: "Plano",
          pixReview: "Revisar PIX",
        },
        success:
          "Cobrança PIX gerada. Escaneie o QR Code ou copie o código para pagar.",
        closeToEnd: "Falta pouco!",
        BACK: "VOLTAR",
        PAY: "PAGAR",
        PAY_PIX: "GERAR PIX",
        NEXT: "PRÓXIMO",
        pix: {
          invoiceHeading: "Fatura em pagamento",
          amountCharged: "Valor a pagar (PIX)",
          dueDate: "Vencimento",
          amountFromInvoice:
            "Valor igual ao da fatura enviado ao pagamento; ignore o preço do plano como referência de cobrança.",
          totalLabel: "Total PIX",
          waitingHint:
            "Aguardando pagamento. Cobrança expira em até {{minutes}} min (aprox.).",
          expiredHint:
            "Esta cobrança pode ter expirado. Feche, volte a Financeiro e gere um novo PIX.",
          paidToast: "Pagamento confirmado! Nova data: {{date}}",
          instructions:
            "Abra o app do seu banco, pague com PIX copia e cola ou QR Code e aguarde a confirmação automática.",
          copyPix: "Copiar código PIX",
          copied: "Copiado",
          missingQr: "Não foi possível exibir o QR Code. Tente gerar novamente.",
          invoiceRef: "Fatura #{{id}} — {{detail}}",
          redirecting: "Redirecionando…",
        },
        review: {
          title: "Resumo da assinatura",
          titlePix: "Confirmar pagamento PIX",
          confirmPixHint:
            "Confira o valor da fatura. Ao continuar, será gerada a cobrança PIX.",
          pixSectionTitle: "Cobrança (fatura)",
          planSectionTitle: "Plano de referência",
          planReferenceOnly:
            "Limites do plano são informativos; o valor cobrado é o da fatura acima.",
          invoiceId: "Fatura",
          chargesFromInvoice: "Valor cobrado no PIX:",
          dueLabel: "Vencimento",
          details: "Detalhes do plano",
          users: "Usuários",
          whatsapp: "Conexões WhatsApp",
          charges: "Cobrança: mensal (referência)",
          total: "Total",
        },
        form: {
          planField: {
            label: "Plano selecionado (referência)",
          },
        },
        pricing: {
          users: "Usuários",
          connection: "Conexão",
          queues: "Setores",
          SELECT: "SELECIONAR",
          month: "mês",
        },
      },
      companies: {
        title: "Cadastrar Empresa",
        form: {
          name: "Nome da Empresa",
          plan: "Plano",
          token: "Token",
          submit: "Cadastrar",
          success: "Empresa criada com sucesso!",
        },
      },
      auth: {
        mustChangePasswordBanner:
          "Por segurança, altere a sua palavra-passe: utilize o menu da conta (perfil) → opção de editar utilizador e defina uma nova senha.",
        toasts: {
          success: "Login efetuado com sucesso!",
        },
        token: "Token",
      },
      connections: {
        title: "Conexões",
        guide: {
          title: "Como conectar o WhatsApp",
          intro: "Não é necessário API paga. A conexão é por QR Code (como WhatsApp Web).",
          step1: "Clique em \"Adicionar WhatsApp\", dê um nome e salve.",
          step2: "Na lista, clique no botão \"Ver QR Code\" quando o status estiver como \"Aguardando QR\".",
          step3: "No celular: abra o WhatsApp → Aparelhos conectados (ou Dispositivos ligados) → Conectar dispositivo.",
          step4: "Aponte a câmera para o QR Code na tela. Quando conectar, o status ficará verde \"Conectado\".",
        },
        statusLabel: {
          CONNECTED: "Conectado",
          qrcode: "Aguardando QR",
          OPENING: "Conectando...",
          DISCONNECTED: "Desconectado",
          TIMEOUT: "Sem conexão",
          PAIRING: "Emparelhando",
          PENDING: "Pendente",
        },
        toasts: {
          deleted: "Conexão com o WhatsApp excluída com sucesso!",
          connected: "WhatsApp conectado com sucesso!",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida.",
          disconnectTitle: "Desconectar",
          disconnectMessage:
              "Tem certeza? Você precisará ler o QR Code novamente.",
        },
        buttons: {
          add: "Adicionar WhatsApp",
          disconnect: "desconectar",
          tryAgain: "Tentar novamente",
          qrcode: "QR CODE",
          newQr: "Novo QR CODE",
          connecting: "Conectando",
        },
        toolTips: {
          disconnected: {
            title: "Falha ao iniciar sessão do WhatsApp",
            content:
                "Certifique-se de que seu celular esteja conectado à internet e tente novamente, ou solicite um novo QR Code",
          },
          qrcode: {
            title: "Esperando leitura do QR Code",
            content:
                "Clique no botão 'QR CODE' e leia o QR Code com o seu celular para iniciar a sessão",
          },
          connected: {
            title: "Conexão estabelecida!",
          },
          timeout: {
            title: "A conexão com o celular foi perdida",
            content:
                "Certifique-se de que seu celular esteja conectado à internet e o WhatsApp esteja aberto, ou clique no botão 'Desconectar' para obter um novo QR Code",
          },
        },
        table: {
          name: "Nome",
          status: "Status",
          lastUpdate: "Última atualização",
          default: "Padrão",
          actions: "Ações",
          session: "Sessão",
          emptyTitle: "Nenhuma conexão ainda",
          emptyHint: "Adicione um WhatsApp para gerar o QR Code e começar o atendimento.",
        },
      },
      whatsappModal: {
        title: {
          add: "Adicionar WhatsApp",
          edit: "Editar WhatsApp",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
        },
        tabs: {
          general: "Geral",
          messages: "Mensagens",
          assessments: "Avaliações",
          integrations: "Integrações",
          schedules: "Horário de expediente",
        },
        form: {
          name: "Nome",
          default: "Padrão",
          sendIdQueue: "Setor",
          timeSendQueue: "Redirecionar para setor em X minutos",
          queueRedirection: "Redirecionamento de Setor",
          outOfHoursMessage: "Mensagem de fora de expediente",
          queueRedirectionDesc:
              "Selecione um setor para os contatos que não possuem setor serem redirecionados",
          prompt: "Prompt",
          queue: "Setor de Transferência",
          timeToTransfer: "Transferir após x (minutos)",
          //maxUseBotQueues: "Enviar bot x vezes",
          //timeUseBotQueues: "Intervalo em minutos entre envio de bot",
          expiresTicket: "Encerrar chats abertos após x minutos",
          expiresInactiveMessage: "Mensagem de encerramento por inatividade",
          greetingMessage: "Mensagem de saudação",
          complationMessage: "Mensagem de conclusão",
          integration: "Integrações",
          token: "Token da API",
          tokenReadOnly: "Gerado automaticamente. Use na página API de mensagens.",
          generateToken: "Gerar novo token",
          copyToken: "Copiar token",
          tokenCopied: "Token copiado!",
          tokenCreatedTitle: "Token da API criado",
          tokenCreatedMessage: "Guarde este token em local seguro. Use-o na página Messages API para enviar mensagens por esta conexão.",
          autoReadMessages: "Enviar visto no WhatsApp ao visualizar a conversa no painel",
          autoReadMessagesHint:
            "Quando ativo, ao carregar a lista de mensagens do ticket no painel (visualização humana), o sistema envia confirmação de leitura ao WhatsApp. Automações e API não disparam o visto. Desligado: o painel continua zerando não lidas localmente, mas o cliente não recebe os dois risquinhos azuis.",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
          close: "Fechar",
        },
        success: "WhatsApp salvo com sucesso.",
      },
      qrCodeModal: {
        title: "Conectar WhatsApp por QR Code",
        steps: {
          one: "Abra o WhatsApp no seu celular",
          two: {
            partOne: "Toque em Mais opções (⋮) no Android",
            partTwo: "ou em Configurações",
            partThree: "no iPhone",
          },
          three: "Toque em \"Dispositivos conectados\" e depois em \"Conectar dispositivo\"",
          four: "Aponte a câmera do celular para o QR Code abaixo",
        },
        waiting: "Aguardando leitura do QR Code...",
        newQr: "Gerar novo QR Code",
        connected: "Conectado! Você já pode fechar esta janela.",
      },
      qrCode: {
        message: "Leia o QrCode para iniciar a sessão",
      },
      contacts: {
        title: "Contatos e histórico de atendimento",
        subtitle:
          "Clientes e contatos do WhatsApp com registo de interações e atendimentos.",
        pageBanner:
          "As tags vêm dos atendimentos já associados a cada contato.",
        pageExpectations:
          "Foco em histórico de conversas — não substitui um CRM ou um funil de vendas.",
        tagsColumnHint:
          "Tags mostradas a partir dos atendimentos (tickets) deste contato.",
        tagFilterHelp:
          "Filtra contatos que tenham pelo menos um ticket com a tag escolhida.",
        searchHelper: "Pesquise por nome, número, email ou notas.",
        openAttendance: "Abrir atendimento",
        scheduleMessage: "Agendar mensagem",
        lastInteractionTooltip: "Última interação",
        toasts: {
          deleted: "Contato excluído com sucesso!",
          deletedAll: "Todos contatos excluídos com sucesso!",
        },
        searchPlaceholder: "Pesquisar por nome, número, email ou notas…",
        confirmationModal: {
          deleteTitle: "Deletar ",
          deleteAllTitle: "Deletar Todos",
          importTitle: "Importar contatos",
          deleteMessage:
              "Tem certeza que deseja deletar este contato? Todos os tickets relacionados serão perdidos.",
          deleteAllMessage:
              "Tem certeza que deseja deletar todos os contatos? Todos os tickets relacionados serão perdidos.",
          importMessage: "Deseja importar todos os contatos do telefone?",
        },
        buttons: {
          import: "Importar Contatos",
          add: "Adicionar Contato",
          export: "Exportar Contatos",
          delete: "Excluir Todos Contatos",
          edit: "Editar contato",
          deleteRow: "Excluir contato",
        },
        table: {
          contact: "Contato",
          name: "Nome",
          number: "Número",
          whatsapp: "WhatsApp",
          email: "Email",
          tags: "Tags",
          lastInteraction: "Última interação",
          createdAt: "Criado em",
          actions: "Ações",
        },
        filters: {
          sectionLabel: "Filtros",
          tag: "Tag",
          allTags: "Todas",
          dateFrom: "Atualizado de",
          dateTo: "Atualizado até",
        },
        empty: {
          title: "Nenhum contato por aqui",
          subtitle:
            "Ajuste a pesquisa ou os filtros, importe uma lista ou adicione um contato para começar.",
        },
        loading: "Carregando contatos…",
      },
      contactImportModal: {
        title: "Planílha de contatos",
        labels: {
          import: "Importar contatos",
          result: "resultados",
          added: "Adicionados",
          savedContact: "Contato salvo",
          errors: "Erros",
        },
        buttons: {
          download: "Baixar planílha modelo",
          import: "Importar contatos",
        },
      },
      queueIntegrationModal: {
        title: {
          add: "Adicionar projeto",
          edit: "Editar projeto",
        },
        intro:
          "Cada registro aqui pode ser vinculado a um setor (Filas) ou à conexão WhatsApp. O comportamento depende do tipo escolhido.",
        groups: {
          internal: "Automações internas",
          external: "Integrações externas (POST HTTP)",
          legacy: "Legado",
        },
        types: {
          flowbuilder: "Flowbuilder",
          typebot: "Typebot",
          n8n: "N8N",
          webhook: "Webhook",
          dialogflow: "Dialogflow (legado)",
        },
        descriptions: {
          flowbuilder: "Automação interna com lógica e fluxos personalizados",
          typebot: "Chatbot conversacional integrado",
          webhookN8n: "Envio de dados para sistemas externos (POST HTTP)",
        },
        alerts: {
          externalPost:
            "Essa integração envia dados para um sistema externo (POST), mas não recebe respostas automaticamente nem altera o atendimento com base na resposta HTTP. Ela não responde sozinha ao cliente no WhatsApp. Para automações completas na conversa, use Flowbuilder ou Typebot.",
          internalHint:
            "Esta opção participa da conversa conforme o fluxo ou o bot configurado.",
        },
        form: {
          id: "ID",
          type: "Tipo",
          name: "Nome",
          projectName: "Nome do Projeto",
          language: "Linguagem",
          jsonContent: "JsonContent",
          legacyDialogflow: "Dialogflow (legado)",
          legacyDialogflowHint:
            "Integrações Dialogflow não são mais configuráveis nesta tela. Altere o tipo ou edite apenas o nome.",
          urlN8N: "URL",
          urlWebhookHelper:
            "Envio via POST — a resposta do servidor não volta automaticamente para o atendimento.",
          typebotSlug: "Typebot - Slug",
          typebotExpires: "Tempo em minutos para expirar uma conversa",
          typebotKeywordFinish: "Palavra para finalizar o ticket",
          typebotKeywordRestart: "Palavra para reiniciar o fluxo",
          typebotRestartMessage: "Mensagem ao reiniciar a conversa",
          typebotUnknownMessage: "Mensagem de opção inválida",
          typebotDelayMessage: "Intervalo (ms) entre mensagens",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
          test: "Testar Bot",
        },
        messages: {
          testSuccess: "Integração testada com sucesso!",
          addSuccess: "Integração adicionada com sucesso.",
          editSuccess: "Integração editada com sucesso.",
        },
      },
      sideMenu: {
        name: "Menu Lateral Inicial",
        note: "Se habilitado, o menu lateral irá iniciar fechado",
        options: {
          enabled: "Aberto",
          disabled: "Fechado",
        },
      },
      promptModal: {
        form: {
          name: "Nome",
          prompt: "Prompt",
          model: "Modelo",
          max_tokens: "Máximo de Tokens na resposta",
          temperature: "Temperatura",
          apikey: "API Key",
          max_messages: "Máximo de mensagens no Histórico",
        },
        formErrors: {
          name: {
            short: "Nome muito curto",
            long: "Nome muito longo",
            required: "Nome é obrigatório",
          },
          prompt: {
            short: "Prompt muito curto",
            required: "Descreva o treinamento para Inteligência Artificial",
          },
          modal: {
            required: "Informe o modelo desejado para o Prompt",
          },
          maxTokens: {
            required: "Informe o número máximo de tokens na resposta",
          },
          temperature: {
            required: "Informe a temperatura",
          },
          apikey: {
            required: "Informe a API Key",
          },
          queueId: {
            required: "Informe o setor",
          },
          maxMessages: {
            required: "Informe o número máximo de mensagens no histórico",
          },
        },
        success: "Prompt salvo com sucesso!",
        setor: "Informe o setor",
        title: {
          add: "Adicionar Prompt",
          edit: "Editar Prompt",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
      },
      prompts: {
        title: "Prompts",
        openAiHelp:
          "Onde o OpenAI atua: na conexão WhatsApp (prompt vinculado), na fila/setor (quando o prompt do setor está ativo) e no fluxo automatizado (nó \"openai\" no Flow Builder). " +
          "Quando responde: ao receber mensagens de texto (ou áudio, quando suportado) no ticket, desde que as regras do bot e da fila permitam. " +
          "A resposta usa o histórico recente das mensagens daquele ticket e a instrução deste cadastro — o contexto depende do que já foi trocado na conversa.",
        table: {
          name: "Nome",
          queue: "Setor",
          max_tokens: "Máximo Tokens Resposta",
          actions: "Ações",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida!",
        },
        buttons: {
          add: "Adicionar Prompt",
        },
      },
      contactModal: {
        title: {
          add: "Adicionar contato",
          edit: "Editar contato",
        },
        expectations:
          "Histórico de atendimento — não é CRM nem funil de vendas.",
        summary: {
          title: "Atividade e histórico",
          tickets: "Total de atendimentos",
          lastInteraction: "Última interação",
          lastMessage: "Última mensagem",
        },
        tags: {
          added: "Tag adicionada",
          removed: "Tag removida",
          helpFromTickets:
            "As tags são baseadas nos atendimentos (tickets) associados a este contato. Para adicionar ou remover, é necessário existir conversa em andamento ou encerrada.",
        },
        campaigns: {
          title: "Campanhas (listas)",
          hint:
            "Listas de disparo onde este número já consta. Para adicionar a outra lista, use a página de listas de campanha.",
          empty: "Este número ainda não está em nenhuma lista.",
          manageLists: "Gerir listas de campanha",
        },
        form: {
          mainInfo: "Dados do contato",
          extraInfo: "Informações adicionais",
          name: "Nome",
          number: "Número do Whatsapp",
          email: "Email",
          emailPlaceholder: "nome@empresa.com",
          notes: "Notas",
          tags: "Tags",
          addTag: "Adicionar tag",
          extraName: "Nome do campo",
          extraValue: "Valor",
          whatsapp: "Conexão Origem: ",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          phone: {
            required: "Número é obrigatório",
            short: "Número muito curto",
            long: "Número muito longo",
          },
          email: {
            invalid: "Email inválido",
          },
        },
        buttons: {
          addExtraInfo: "Adicionar informação",
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
          openAttendance: "Abrir atendimento",
        },
        success: "Contato salvo com sucesso.",
      },
      queueModal: {
        title: {
          add: "Adicionar setor",
          edit: "Editar setor",
        },
        preview: "Pré-visualização",
        previewPlaceholder: "Nome do setor",
        form: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          color: "Cor",
          colorShort: "Cor curta",
          colorLong: "Cor longa",
          greetingMessage: "Mensagem de saudação",
          complationMessage: "Mensagem de conclusão",
          outOfHoursMessage: "Mensagem de fora de expediente",
          ratingMessage: "Mensagem de avaliação",
          token: "Token",
          orderQueue: "Ordem do setor (Bot)",
          integrationId: "Integração",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        toasts: {
          success: "Setor salvo com sucesso.",
          info: "Clique em salvar para registar as alterações",
        },
        tabs: {
          queueData: "Dados do setor",
          attendanceTime: "Horários de Atendimento",
        },
      },
      userModal: {
        title: {
          add: "Adicionar usuário",
          edit: "Editar usuário",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
          profile: "Perfil",
          profileSupervisor: "Supervisor",
          passwordOptionalEdit: "Deixe em branco para manter a senha atual.",
          whatsapp: "Conexão Padrão",

          allTicket: "Ticket Sem Setor [Invisível]",
          allTicketEnabled: "Habilitado",
          allTicketDesabled: "Desabilitado",
        },
        hints: {
          passwordCreate:
            "Use no mínimo 8 caracteres, com letra maiúscula, minúscula e número.",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          password: {
            required: "Senha é obrigatória",
            short: "Senha muito curta",
            long: "Senha muito longa",
          },
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
        },
        labels: {
          liberations: "Liberações",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Usuário salvo com sucesso.",
      },
      scheduleModal: {
        title: {
          add: "Novo Agendamento",
          edit: "Editar Agendamento",
        },
        subtitle:
          "Automação operacional (lembretes, cobranças, follow-up). Não é campanha de marketing em massa.",
        form: {
          body: "Mensagem",
          contact: "Contato",
          contacts: "Contatos",
          sendType: "Tipo de envio",
          sendSingle: "Envio único",
          sendRecurring: "Envio recorrente",
          sendAt: "Data de Agendamento",
          sentAt: "Data de Envio",
          timeToSend: "Horário",
          companyTimezone: "Horários interpretados no fuso",
          recurrence: "Frequência",
          recurrenceDaily: "Diária",
          recurrenceWeekly: "Semanal",
          recurrenceMonthly: "Mensal",
          weekdays: "Dias da semana",
          dayOfMonth: "Dia do mês",
          preferredWhatsapp: "Conexão preferencial (opcional)",
          preferredWhatsappHint:
            "Deixe em branco para enviar automaticamente por qualquer conexão ativa da empresa.",
          automaticConnection: "Automático (qualquer conexão ativa)",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        confirmationModal: {
          deleteTitle: "Excluir anexo?",
          deleteMessage: "O arquivo será removido deste agendamento.",
        },
        toasts: {
          deleted: "Anexo removido.",
        },
        success: "Agendamento salvo com sucesso.",
      },
      tagModal: {
        title: {
          add: "Nova tag",
          edit: "Editar tag",
        },
        preview: "Pré-visualização",
        previewPlaceholder: "Nome da tag",
        form: {
          name: "Nome",
          color: "Cor (hex)",
        },
        formErrors: {
          nameRequired: "Nome é obrigatório",
          nameShort: "Nome muito curto (mín. 2 caracteres)",
          nameLong: "Nome muito longo",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Tag salva com sucesso.",
      },
      chat: {
        toasts: {
          fillTitle: "Por favor, preencha o título da conversa.",
          fillUser: "Por favor, selecione pelo menos um usuário.",
        },
        list: {
          conversationMenu: "Opções da conversa",
        },
        popover: {
          title: "Mensagens internas",
          openTooltip: "Abrir mensagens internas",
        },
        page: {
          title: "Chat interno",
          subtitle: "Mensagens da equipe, fora do WhatsApp do cliente.",
          searchPlaceholder: "Buscar conversas...",
          loadingMessages: "Carregando mensagens...",
          loadingConversations: "Carregando conversas...",
          messagePlaceholder: "Digite sua mensagem...",
          sendMessage: "Enviar mensagem",
          messageInputAria: "Mensagem",
          emptyNoSearchTitle: "Nenhum resultado",
          emptyNoSearchSub: "Tente outro termo ou limpe a busca.",
          emptyNoConversationsTitle: "Nenhuma conversa ainda",
          emptyNoConversationsSub:
            "Crie uma conversa para começar a mensagear com sua equipe.",
          emptySelectTitle: "Selecione uma conversa",
          emptySelectSub: "Escolha uma conversa na lista para ver as mensagens.",
          newConversationButton: "Nova conversa",
          tabsAria: "Conversas e mensagens",
        },
        modal: {
          title: "Conversa",
          titleField: "Título",
        },
        confirm: {
          title: "Excluir Conversa",
          message: "Esta ação não pode ser revertida, confirmar?",
        },
        chats: "Chats",
        messages: "Mensagens",
        noTicketMessage: "Selecione uma conversa para começar",
        emptyInboxTitle: "Nenhuma conversa selecionada",
        emptyInboxSubtitle:
          "Escolha um atendimento na lista ao lado para ver mensagens e responder com sua equipe.",
        buttons: {
          close: "Fechar",
          save: "Salvar",
          new: "Nova",
          newChat: "Novo",
          edit: "Editar",
          delete: "Excluir",
        },
      },
      uploads: {
        titles: {
          titleUploadMsgDragDrop: "ARRASTE E SOLTE ARQUIVOS NO CAMPO ABAIXO",
          titleFileList: "Lista de arquivo(s)",
        },
      },
      ticketsManager: {
        buttons: {
          newTicket: "Novo",
          fabNewTicket: "Novo atendimento",
          fabBulkActions: "Ações em massa",
        },
        toasts: {
          bulkAssignSuccess:
            "{{count}} atendimento(s) atualizado(s) com a conexão escolhida.",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Setores",
      },
      tickets: {
        toasts: {
          deleted: "O atendimento que você estava foi deletado.",
          unauthorized: "Acesso não permitido",
        },
        filters: {
          user: "Filtro por usuários",
          tags: "Filtro por tags",
        },
        notification: {
          message: "Mensagem de",
        },
        tabs: {
          open: { title: "Abertas" },
          closed: { title: "Resolvidos" },
          search: { title: "Busca" },
        },
        search: {
          placeholder: "Buscar por contato, número ou texto da mensagem…",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Ticket",
        fieldLabel: "Digite para buscar usuários",
        fieldQueueLabel: "Transferir para setor",
        fieldQueuePlaceholder: "Selecione um setor",
        noOptions: "Nenhum usuário encontrado com esse nome",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
        },
      },
      ticketsList: {
        pendingHeader: "Aguardando",
        assignedHeader: "Atendendo",
        noTicketsTitle: "Nada aqui!",
        noTicketsMessage:
            "Nenhum atendimento encontrado com esse status ou termo pesquisado",
        emptyStateTitle: "Nenhum atendimento por aqui",
        emptyStateMessage:
            "Não há tickets nesta visualização ou com os filtros e a busca atuais.",
        emptyStateHint:
            "Ajuste os filtros ou a pesquisa, ou aguarde novos contatos. Quando aparecerem atendimentos, selecione um na lista para abrir a conversa.",
        searchInputAria: "Buscar atendimentos",
        keyboardShortcutsHint:
            "Atalhos: / foca a busca · Alt+1 Abertas · Alt+2 Resolvidos · Alt+3 Filtros · Alt+4 Grupos · setas na lista",
        compactListOn: "Lista compacta",
        compactListOff: "Lista confortável",
        buttons: {
          accept: "Aceitar",
          closed: "Finalizar",
          reopen: "Reabrir",
        },
        orphanConnectionWarning:
          "Conexão WhatsApp deste atendimento não existe mais. Aceitar, finalizar e excluir continuam disponíveis; reatribua uma conexão para enviar mensagens.",
        startedOutsideSystemHint: "Conversa iniciada fora do sistema",
        orphanReassign: {
          button: "Reatribuir conexão",
          title: "Reatribuir conexão",
          description:
            "Escolha uma conexão ativa para recuperar o envio de mensagens neste atendimento.",
          connectionLabel: "Conexão WhatsApp",
          confirm: "Confirmar",
          cancel: "Cancelar",
          loading: "Carregando conexões…",
          noConnections:
            "Nenhuma conexão disponível. Crie ou conecte um WhatsApp antes de reatribuir.",
          success: "Conexão reatribuída com sucesso.",
        },
      },
      ticketsListItem: {
        ariaTicketRow: "Atendimento",
        tooltip: {
          chatbot: "Chatbot",
          peek: "Espiar Conversa",
        },
        noQueue: "SEM SETOR",
      },
      ticketAdvanced: {
        selectTicket: "Selecionar Ticket",
        ticketNav: "Ticket",
        attendanceNav: "Atendimentos",
      },
      newTicketModal: {
        title: "Criar Ticket",
        fieldLabel: "Digite para pesquisar o contato",
        add: "Adicionar",
        searchQueueError:
            "Ocorreu um erro inesperado ao tentar buscar os setores",
        selectQueue: "Selecione um setor",
        selectConection: "Selecione uma conexão",
        buttons: {
          ok: "Salvar",
          cancel: "Cancelar",
        },
      },
      locationPreview: {
        button: "Visualizar",
      },
      mainDrawer: {
        sections: {
          dashboard: "Dashboard",
          atendimento: "Atendimento",
          chatInterno: "Chat interno",
          equipe: "Equipe",
          automacao: "Automação",
          campanhas: "Campanhas",
          financeiro: "Financeiro",
          configuracoes: "Configurações",
        },
        listItems: {
          dashboard: "Dashboard",
          platform: "Gestão SaaS",
          connections: "Conexões",
          tickets: "Atendimentos",
          quickMessages: "Respostas rápidas",
          tasks: "Tarefas",
          agenda: "Agenda",
          contacts: "Contatos",
          queues: "Setores & Chatbot",
          sectors: "Setores",
          tags: "Tags",
          administration: "Administração",
          users: "Usuários",
          settings: "Configurações",
          helps: "Ajuda",
          messagesAPI: "API WhatsApp",
          schedules: "Agendamentos",
          campaigns: "Campanhas",
          contactLists: "Listas de contatos",
          campaignSettings: "Configurações",
          flows: "Fluxos",
          flowsChatbot: "Fluxos (Chatbot)",
          keywordsTrigger: "Gatilhos por palavra-chave",
          integrations: "Integrações",
          reports: "Relatórios",
          kanban: "Kanban",
          groups: "Grupos",
          evaluation: "Avaliação",
          annoucements: "Informativos",
          chats: "Chat Interno",
          finance: "Financeiro",
          files: "Lista de arquivos",
          prompts: "OpenAI",
          queueIntegration: "Automações por setor",
          notificationCenter: "Central de notificações",
        },
        appBar: {
          refresh: "Recarregar página",
          notRegister: "Sem notificações",
          pauseAttendance: {
            title: "Pausar atendimento?",
            message: "Ao pausar o atendimento, o sistema enviará automaticamente uma mensagem aos contatos informando que o atendente não está disponível no momento. Deseja continuar?",
            cancel: "CANCELAR",
            confirm: "SIM, PAUSAR",
          },
          greeting: {
						hello: "Olá",
						welcome: "Bem vindo a",
						active: "Ativo até",
					},
          user: {
            profile: "Perfil",
            logout: "Sair",
          },
        },
        drawerFooter: {
          roleSuperAdmin: "Super Admin",
          roleAdmin: "Administrador",
          roleUser: "Usuário",
        },
      },
      saas: {
        shell: {
          moduleTitle: "Gestão SaaS",
          moduleSubtitle:
            "Administração da plataforma. Operação de tickets e WhatsApp fica no restante do menu.",
          navAria: "Navegação da gestão SaaS",
          backToProduct: "Voltar ao produto",
        },
      },
      platform: {
        shell: {
          eyebrow: "Super Admin · Plataforma",
        },
        tabs: {
          dashboard: "Dashboard da plataforma",
          companies: "Empresas",
          signupRequests: "Pedidos de cadastro",
          plans: "Planos",
          superAdmins: "Super Admins",
          myAccount: "Minha conta",
          branding: "Branding",
          financial: "Financeiro",
          billingAutomation: "Automação de faturação",
          backup: "Backup",
          helps: "Ajuda (conteúdos)",
          announcements: "Informativos",
          pushNotifications: "Notificações push",
          emailSmtp: "E-mail / SMTP",
        },
        emailSettings: {
          title: "E-mail / SMTP",
          subtitle:
            "Configuração do servidor de envio usada pela plataforma para mensagens transacionais.",
          usageHint:
            "Essas configurações são usadas para convites de administrador, recuperação de senha e redefinição de senha. A palavra-passe SMTP não é mostrada depois de guardada.",
          sectionConnection: "Servidor",
          sectionSender: "Remetente",
          enabled: "SMTP ativo (usar estes dados em vez de só variáveis de ambiente)",
          host: "Host SMTP",
          port: "Porta",
          user: "Utilizador",
          password: "Senha SMTP",
          passwordPlaceholderKeep: "Deixe em branco para manter a senha atual",
          passwordPlaceholderEmpty: "Obrigatória se o servidor exige autenticação",
          passwordHelp:
            "Nunca é devolvida pela API. Guarde novamente apenas se pretender alterá-la.",
          removePassword: "Remover senha salva",
          secureSsl: "SSL direto (ex.: porta 465)",
          requireTls: "Exigir TLS (STARTTLS, ex.: porta 587)",
          fromName: "Nome do remetente",
          fromEmail: "E-mail do remetente",
          replyTo: "Reply-To (opcional)",
          save: "Guardar",
          saved: "Configuração SMTP guardada.",
          passwordRemoved: "Senha SMTP removida.",
          testTitle: "Teste de envio",
          testHint:
            "Usa a mesma configuração efetiva que convites e recuperação (base de dados ou MAIL_*).",
          testToLabel: "Enviar teste para",
          testSend: "Enviar e-mail de teste",
          testSent: "E-mail de teste enviado. Verifique a caixa de entrada.",
          tabSmtp: "SMTP",
          tabTemplates: "Modelos de e-mail",
          templates: {
            usageHint:
              "Modelos usados no convite do administrador (nova empresa) e na recuperação/redefinição de senha. Deixe em branco e guarde para voltar ao texto padrão do sistema.",
            sectionGlobal: "Dados gerais",
            supportEmail: "E-mail de suporte (tag {{supportEmail}})",
            loginUrl: "URL base de login da plataforma",
            loginUrlHint:
              "Ex.: https://app.exemplo.com — usada em {{loginUrl}} e no link de redefinição. Se vazio, usa FRONTEND_URL do servidor.",
            welcomeCard: "Boas-vindas / primeiro acesso",
            resetCard: "Redefinição e recuperação de senha",
            subject: "Assunto",
            body: "Corpo",
            bodyHelper: "Texto simples (quebras de linha) ou HTML básico. Valores das tags são escapados no envio.",
            tagsTitle: "Variáveis disponíveis",
            tagsIntro: "Clique numa etiqueta para copiar.",
            tagCopy: "Copiado: {{tag}}",
            save: "Guardar modelos",
            saved: "Modelos guardados.",
            restore: "Restaurar padrão do sistema na base de dados",
            restored: "Campos limpos na base de dados; os envios usam os textos embutidos até voltar a personalizar.",
            testToLabel: "Enviar teste de modelo para",
            testWelcome: "Testar boas-vindas",
            testReset: "Testar redefinição de senha",
            testSent: "E-mail de teste enviado.",
            tags: {
              companyName: "Nome da empresa",
              userName: "Nome do utilizador",
              userEmail: "E-mail do utilizador",
              temporaryPassword: "Senha provisória (se existir)",
              resetLink: "Link para redefinir senha (token)",
              loginUrl: "URL de entrada à plataforma",
              systemName: "Nome do sistema / marca",
              supportEmail: "E-mail de suporte",
            },
          },
          validation: {
            fromEmail: "Indique o e-mail do remetente.",
            testTo: "Indique o destinatário do teste.",
          },
        },
        pushSettings: {
          title: "Notificações push (OneSignal)",
          subtitle:
            "Configure o envio Web Push para utilizadores autenticados. A chave REST fica apenas no servidor (fase de envio).",
          securityHint:
            "Não introduza segredos em código. O App ID é público no cliente; a REST API Key serve para o backend na fase seguinte.",
          enabled: "Ativar integração OneSignal",
          appId: "OneSignal App ID",
          environment: "Ambiente",
          envProduction: "Produção",
          envDevelopment: "Desenvolvimento (localhost como origem segura)",
          restKey: "REST API Key (opcional)",
          restKeyPlaceholderKeep: "Deixe em branco para manter a chave atual",
          restKeyPlaceholderEmpty: "Opcional nesta fase",
          restKeyHelp:
            "Guarde a chave com permissão apenas de envio. O frontend nunca a utiliza; será usada pelo servidor para notificações.",
          removeRestKey: "Remover chave REST guardada",
          save: "Guardar",
          saved: "Configuração guardada.",
          keyRemoved: "Chave REST removida.",
        },
        pushOptIn: {
          message:
            "Ative as notificações push para receber alertas mesmo com o separador em segundo plano (quando a plataforma estiver configurada).",
          enable: "Ativar notificações",
          later: "Agora não",
        },
        signupRequests: {
          title: "Onboarding de novos clientes",
          subtitle:
            "Central operacional: pedidos públicos, aprovação, convites e ativação. Use os alertas para priorizar o que precisa de ação.",
          filterLabel: "Filtrar",
          filterNew: "Novos",
          filterCritical: "Críticos",
          filterPending: "Pendentes",
          filterApproved: "Só aprovados",
          filterInvited: "Convite enviado",
          filterNotActivated: "Não ativados",
          filterActivated: "Ativados",
          filterRejected: "Rejeitados",
          filterAll: "Todos",
          searchPlaceholder: "Pesquisar empresa, responsável ou e-mail…",
          searchHint:
            "Mínimo 2 caracteres. A pesquisa filtra a lista abaixo; os contadores são globais (todos os pedidos).",
          summaryIntro: "Visão geral — clique para aplicar o filtro correspondente.",
          summaryNew: "Novos",
          summaryPending: "Pendentes",
          summaryAwaiting: "Aguardam ativação",
          summaryCritical: "Críticos",
          summaryRejected: "Rejeitados",
          loading: "A carregar…",
          empty: "Nenhum pedido corresponde a este filtro ou pesquisa.",
          colCompany: "Empresa",
          colAdmin: "Responsável",
          colEmail: "E-mail",
          colPhone: "Telefone",
          colPlan: "Plano",
          colStatus: "Estado",
          colAlerts: "Alertas",
          colDate: "Data do pedido",
          colActions: "Ações",
          badgeNew: "Novo",
          pendingSince: "Há {{days}} d. sem análise",
          statusPending: "Pendente",
          statusApproved: "Aprovado",
          statusInvited: "Convite enviado",
          statusActivated: "Ativado",
          statusRejected: "Rejeitado",
          approve: "Aprovar",
          reject: "Rejeitar",
          tooltipDetails: "Ver detalhes",
          tooltipApprove: "Aprovar pedido",
          tooltipReject: "Rejeitar pedido",
          detailsTitle: "Detalhes do pedido",
          detailPlan: "Plano solicitado",
          detailNotes: "Observações",
          detailRejectReason: "Motivo da rejeição",
          detailReviewedAt: "Data de decisão (legado)",
          detailApprovedAt: "Aprovação",
          detailRejectedAt: "Rejeição",
          detailFirstLoginAt: "Primeiro login",
          detailOnboardingStage: "Etapa atual",
          detailAlerts: "Alertas operacionais",
          stagePending: "Aguardando análise",
          stageApprovedNoInvite: "Aprovado — convite por confirmar",
          stageInvited: "Convite enviado — aguardando ativação",
          stageActivated: "Cliente ativo",
          stageRejected: "Pedido rejeitado",
          detailFirstInvitationSentAt: "Primeiro convite enviado em",
          detailInvitationSentAt: "Último convite enviado em",
          detailInvitationResentCount: "Reenvios registados (ação Super Admin)",
          detailInvitationResentNever: "Ainda sem reenvios por esta central.",
          detailInvitationResentHistory: "Histórico de reenvios (últimos)",
          resendInviteTooltip: "Reenviar convite por e-mail",
          resendInviteDialogTitle: "Reenviar convite de acesso",
          resendInviteDialogIntro:
            "Será gerado um novo código e link (72 horas). O link anterior deixa de funcionar. O e-mail será enviado para o endereço do responsável deste pedido.",
          resendInviteConfirm: "Enviar novo convite",
          toastResendInviteOk: "Novo convite enviado e registo atualizado.",
          socketToastNew: "Novo pedido de cadastro: {{company}}",
          socketToastCriticalOne: "Onboarding: pedido #{{id}} entrou em estado crítico.",
          socketToastCriticalMany:
            "Onboarding: {{count}} pedidos entraram em estado crítico. Revista a central.",
          detailActivatedAt: "Ativação (senha definida no link)",
          alertNEW_SIGNUP: "Cadastro muito recente",
          alertPENDING_STALE: "Pendente há muitos dias sem análise",
          alertAPPROVED_INVITE_PENDING: "Empresa criada — envio do convite não confirmado",
          alertAWAITING_ACTIVATION: "Aguardando definição de senha ou primeiro acesso",
          alertINVITE_STALE: "Convite há vários dias sem ativação",
          alertINVITE_LIKELY_EXPIRED: "Link do convite provavelmente expirado (72h)",
          detailApprovedHint:
            "Empresa criada, mas o envio do e-mail de convite não foi confirmado. Verifique notificações ou reenvie o convite ao admin, se necessário.",
          detailCompanyId: "Empresa criada (ID)",
          close: "Fechar",
          approveDialogTitle: "Confirmar aprovação",
          approveDialogIntro: "Ao confirmar, o sistema irá:",
          approveDialogBullet1: "Criar a empresa e o utilizador administrador com os dados deste pedido.",
          approveDialogBullet2:
            "Gerar uma palavra-passe provisória segura e marcar o primeiro login para obrigar troca de senha.",
          approveDialogBullet3:
            "Enviar ao e-mail do responsável um convite com link para definir a palavra-passe (72 horas), se o e-mail estiver configurado no servidor.",
          confirmApproveAction: "Aprovar e criar",
          credentialsDialogTitle: "Credenciais do administrador",
          credentialsDialogIntro:
            "O convite por e-mail não foi enviado (SMTP indisponível ou erro). Entregue estes dados ao cliente por um canal seguro. No primeiro login será pedida a alteração da palavra-passe.",
          rejectTitle: "Rejeitar pedido",
          rejectReason: "Motivo",
          rejectReasonPlaceholder: "Ex.: dados incompletos, duplicado, fora do perfil…",
          rejectReasonHelper:
            "Recomendamos indicar um motivo breve. Fica registado e visível nos detalhes do pedido.",
          rejectWithoutReasonConfirm:
            "Rejeitar sem motivo? Pode deixar o campo vazio, mas o histórico ficará sem explicação.",
          cancel: "Cancelar",
          confirmReject: "Confirmar rejeição",
          toastApproved: "Pedido processado e empresa criada.",
          toastApprovedInviteSent: "Pedido aprovado. Empresa criada e convite enviado por e-mail.",
          toastApprovedInvitePending:
            "Empresa criada, mas o envio do convite pode ter falhado. Confira o estado na lista ou os logs.",
          toastRejected: "Pedido rejeitado.",
        },
        announcements: {
          title: "Informativos globais",
          subtitle:
            "Avisos e comunicados exibidos aos utilizadores conforme as regras do sistema. Gestão central da plataforma.",
        },
        helps: {
          title: "Conteúdos de ajuda",
          subtitle:
            "Tutoriais e links exibidos na área de ajuda da aplicação para todos os utilizadores. Conteúdo global da plataforma.",
        },
        billingAutomation: {
          title: "Automação de faturação",
          subtitle:
            "Defina avisos automáticos e bloqueio por atraso no vencimento do plano. As alterações aplicam-se ao job horário da plataforma.",
          loading: "A carregar configurações…",
          sectionWarnings: "Avisos automáticos",
          sectionBlock: "Bloqueio automático",
          introWarnings:
            "O sistema regista eventos no histórico de cada empresa nos dias configurados (antes e depois do vencimento). Útil para acompanhamento interno; envio por WhatsApp ou e-mail poderá ser ligado mais tarde.",
          introBlock:
            "Empresas ativas com vencimento ultrapassado há X dias ou mais serão bloqueadas automaticamente (conta inativa).",
          enableWarnings: "Ativar avisos automáticos",
          enableBlock: "Ativar bloqueio automático",
          daysBefore: "Avisar antes do vencimento (dias)",
          daysAfter: "Avisar após o vencimento (dias)",
          daysBlock: "Bloquear após X dias de atraso",
          hintDaysBefore:
            "Número de dias antes da data de vencimento em que o primeiro aviso é registado (uma vez por ciclo de vencimento).",
          hintDaysAfter:
            "Dias após o vencimento em que o aviso pós-vencimento é registado (uma vez por ciclo).",
          hintDaysBlock:
            "A partir deste número de dias em atraso, a empresa ativa é bloqueada automaticamente.",
          footerNote:
            "Valores entre 0 e 365. Com os interruptores desligados, essa parte da automação não corre; o job continua agendado.",
          save: "Guardar configurações",
          toastSaved: "Configurações guardadas.",
          sectionWhatsApp: "WhatsApp (avisos)",
          introWhatsApp:
            "Envia o texto de aviso ao telefone cadastrado na empresa (campo telefone), usando a conexão WhatsApp padrão da empresa remetente indicada abaixo — normalmente a empresa matriz da plataforma (ex.: ID 1).",
          enableWhatsApp: "Enviar avisos automáticos também por WhatsApp",
          whatsappSenderCompanyId: "ID da empresa remetente (conexão WhatsApp)",
          hintWhatsappSender:
            "Tem de existir uma conexão WhatsApp ligada (CONNECTED) nessa empresa, definida como padrão ou disponível.",
        },
        plans: {
          title: "Planos do produto",
          subtitle:
            "Defina o catálogo de planos (limites e módulos). Cada empresa escolhe um plano; ajustes por empresa continuam em Plataforma → Empresas.",
          intro:
            "Estes planos são o modelo padrão da plataforma. As empresas podem ter o campo de módulos sobrescrito individualmente (Super Admin → Empresas).",
          formSectionTitle: "Criar ou editar plano",
          listSectionTitle: "Catálogo de planos",
          newPlan: "Novo plano",
          registeredListTitle: "Planos cadastrados",
          registeredListSubtitle:
            "Selecione um plano para editar ou crie um novo. Os módulos só são configurados ao criar ou editar.",
          listRowHint: "Clique numa linha ou no ícone de edição para abrir o formulário.",
          searchPlaceholder: "Pesquisar por nome do plano…",
          sortLabel: "Ordenar",
          sortByName: "Nome (A–Z)",
          sortByValue: "Valor (menor → maior)",
          editingBanner: "A editar: {{name}}",
          editingContextHint:
            "Alterações nos limites e módulos aplicam-se a este plano; a propagação para empresas segue as regras já existentes ao guardar.",
          emptyListTitle: "Nenhum plano no catálogo",
          emptyListSubtitle: "Crie o primeiro plano ou ajuste a pesquisa.",
          noSearchResults: "Nenhum plano corresponde à pesquisa.",
          listLoading: "A carregar planos…",
          moduleSave: {
            title: "Alteração de módulos do plano",
            summaryIntro:
              "Resumo das alterações de módulos em relação ao estado anterior deste plano:",
            lineOn: "{{module}} — ativado",
            lineOff: "{{module}} — desativado",
            choosePropagation:
              "Como pretende aplicar isto às empresas que usam este plano?",
            applyNone: "Só guardar o plano",
            applyNoOverride: "Guardar e preparar: aplicar só onde não há override",
            applyAll: "Guardar e preparar: aplicar a todas as empresas",
            propagationPending:
              "O plano foi guardado. A propagação automática para empresas ainda será ligada no backend.",
            propagationSuccess:
              "Plano guardado. {{count}} empresa(s) tiveram módulos alinhados conforme o modo escolhido.",
            propagationNoCompaniesUpdated:
              "Plano guardado. Nenhuma empresa precisou de alteração ao JSON de módulos (ou todas tinham overrides preservados).",
          },
        },
        dashboard: {
          title: "Dashboard da plataforma",
          subtitle:
            "Indicadores e listas para acompanhar empresas, estado da base e prioridades.",
          companiesTotal: "Total de empresas",
          kpiSectionTitle: "Indicadores principais",
          kpiTotal: "Total de empresas",
          kpiActive: "Empresas ativas",
          kpiInactive: "Empresas inativas",
          kpiNearDue: "Próximas do vencimento",
          kpiNearDueHint: "Com vencimento nos próximos 30 dias",
          healthSectionTitle: "Saúde da plataforma",
          healthSectionSubtitle:
            "Leitura rápida de cobertura administrativa e contas inativas.",
          healthPctActive: "% de empresas ativas",
          healthNoAdmin: "Empresas sem administrador",
          healthBlocked: "Empresas inativas",
          healthBlockedHint: "Conta com estado inativo (bloqueio operacional)",
          recentTitle: "Empresas recentes",
          recentSubtitle: "Últimas contas criadas na plataforma.",
          recentEmpty: "Ainda não há empresas registadas.",
          problemsTitle: "Empresas com atenção",
          problemsSubtitle: "Sem admin, inativas ou com vencimento ultrapassado.",
          problemsEmpty: "Nenhuma empresa nestas condições.",
          reasonNoAdmin: "Sem admin",
          reasonInactive: "Inativa",
          reasonExpired: "Vencida",
          actionNewCompany: "Nova empresa",
          actionPlans: "Gerir planos",
          actionBranding: "Branding",
          footerHint: "Precisa de detalhes ou edição?",
          openCompanies: "Abrir empresas",
        },
        moduleSettings: {
          planChange: {
            title: "Alterar plano da empresa",
            message:
              "Alterar o plano pode mudar os módulos desta empresa. Escolha se mantém as permissões atuais ou alinha aos módulos predefinidos do novo plano.",
            keepModules: "Manter configurações atuais",
            applyPlanModules: "Aplicar módulos do plano",
          },
          origin: {
            inherited: "Permitido pelo plano; empresa pode desligar",
            disabledOverride: "Desativado nesta empresa (override)",
            blockedByPlan: "O plano não inclui este recurso — o backend recusará com ERR_PLAN_FEATURE_DISABLED",
            companyOnly: "Sem plano: ajuste só vale após associar um plano com a feature correspondente",
            noPlan: "Selecione um plano para alinhar estes módulos ao catálogo de funcionalidades",
          },
        },
        companies: {
          title: "Empresas",
          subtitle:
            "Gerencie empresas, permissões e configurações da plataforma.",
          registeredListTitle: "Empresas cadastradas",
          newCompany: "Nova empresa",
          primaryAdminDialogTitle: "Administrador da empresa criado",
          primaryAdminDialogIntro:
            "Foi criado um utilizador administrador com o e-mail principal da empresa. Guarde a palavra-passe provisória em local seguro ou peça ao cliente para usar o link enviado por e-mail.",
          primaryAdminInviteSent:
            "Foi enviado um e-mail com link para definir a palavra-passe. Também pode usar a palavra-passe provisória abaixo para o primeiro acesso.",
          primaryAdminEmail: "E-mail do administrador",
          primaryAdminTempPassword: "Palavra-passe provisória",
          primaryAdminMustChange:
            "No primeiro login será pedida a alteração da palavra-passe.",
          searchPlaceholder: "Buscar por nome ou e-mail…",
          sortByName: "Nome (A–Z)",
          sortByDate: "Data de cadastro",
          sortByPlan: "Plano (A–Z)",
          sortByDueDate: "Vencimento (data)",
          sortByStatus: "Status (bloqueio)",
          sortByPriority: "Prioridade (vencimento)",
          sortLabel: "Ordenar por",
          editRow: "Editar",
          actionsColumn: "Ações",
          columnCompany: "Empresa",
          columnFinance: "Financeiro",
          financeStateOverdue: "Atrasado",
          financeStateToday: "Vence hoje",
          financeStateSoon: "Vencendo",
          financeStateOk: "Em dia",
          financeStateNoDue: "Sem vencimento",
          filterAll: "Todos ({{count}})",
          filterExpired: "🔴 Atrasados ({{count}})",
          filterToday: "🟠 Hoje ({{count}})",
          filterNext3Days: "🟡 3 dias ({{count}})",
          filterOk: "🟢 Em dia ({{count}})",
          filterBlocked: "Bloqueados ({{count}})",
          filterActive: "Ativos ({{count}})",
          dueShortExpired: "Atrasado há {{days}} dia(s)",
          dueShortToday: "Vence hoje",
          dueShortSoon: "Vence em {{days}} dia(s)",
          dueShortOk: "Em dia",
          dueTooltipNoDate: "Sem data de vencimento definida.",
          dueTooltipFullExpired:
            "Data de vencimento: {{longDate}} ({{date}})\nAtrasado há {{days}} dia(s).",
          dueTooltipFullToday: "Data de vencimento: {{longDate}} ({{date}})\nVence hoje.",
          dueTooltipFullSoon:
            "Data de vencimento: {{longDate}} ({{date}})\nFaltam {{days}} dia(s) para o vencimento.",
          dueTooltipFullOk:
            "Data de vencimento: {{longDate}} ({{date}})\nEm dia — faltam {{days}} dias.",
          dueTooltipExpired: "Vencimento ultrapassado há {{days}} dia(s).",
          dueTooltipToday: "Vence hoje.",
          dueTooltipSoon: "Vence em {{days}} dia(s) (inclui hoje e os próximos 3 dias).",
          dueTooltipOk: "Em dia — faltam {{days}} dias para {{date}}.",
          contractedBadge: "Valor personalizado",
          contractedComparedToPlan: "Plano (catálogo): {{value}}",
          contractedFallbackDefault: "valor padrão do plano",
          billingActionTooltip: "Cobrar cliente (mensagem / WhatsApp)",
          billingDialogTitle: "Cobrança — mensagem pronta",
          billingCopyButton: "Copiar texto",
          billingOpenWhatsApp: "Abrir WhatsApp",
          billingPhoneMissingHint:
            "Sem telefone da empresa cadastrado: use Copiar e envie pelo canal que preferir.",
          billingCopyTooltip: "Copiar mensagem de cobrança (modelo)",
          billingCopiedToast: "Mensagem copiada para a área de transferência.",
          billingMessageFallbackName: "Cliente",
          billingMessageNoDue: "data a definir",
          billingMessageNoPlan: "plano não informado",
          billingMessageTemplate:
            "Olá, {{name}}. Referente ao plano {{plan}} (mensalidade {{amount}}), o vencimento é {{date}}. Pedimos que regularize para manter o serviço ativo. Obrigado.",
          renewDialogRecurrence: "Recorrência",
          renewDialogNewDue: "Novo vencimento previsto",
          renewBaseFromCurrentDue:
            "A renovação soma o período a partir do vencimento atual (ainda em vigor).",
          renewBaseFromToday:
            "A renovação soma o período a partir de hoje (vencimento já ultrapassado ou ausente).",
          statusActive: "Ativo",
          statusInactive: "Inativo",
          listRowHint:
            "Linha: editar no formulário abaixo. Ícone de mensagem: modelo de cobrança (copiar ou WhatsApp com telefone da empresa).",
          registeredListSubtitle:
            "Painel interno: vencimentos, cobrança e operação. Prioridade por atraso; filtros e ações sem sair da lista.",
          accessCompany: "Acessar empresa (modo suporte)",
          moreActions: "Mais ações",
          blockCompany: "Bloquear empresa",
          unblockCompany: "Desbloquear empresa",
          renewCompany: "Renovar vencimento",
          deleteCompanyAction: "Excluir empresa",
          confirmBlockTitle: "Bloquear empresa?",
          confirmBlockMessage:
            "A empresa «{{name}}» deixará de conseguir aceder ao sistema até ser desbloqueada. Confirma?",
          confirmUnblockTitle: "Desbloquear empresa?",
          confirmUnblockMessage:
            "A empresa «{{name}}» voltará a poder aceder ao sistema. Confirma?",
          statusUpdateSuccess: "Estado da empresa atualizado.",
          renewDialogTitle: "Renovar vencimento",
          renewDialogMessage:
            "Renovar «{{name}}» conforme a recorrência {{recurrence}}. Novo vencimento previsto: {{date}}.",
          renewInvalidRecurrence:
            "Não foi possível calcular a renovação. Defina uma recorrência válida na empresa (MENSAL, BIMESTRAL, etc.).",
          renewConfirm: "Renovar",
          renewSuccess: "Vencimento renovado com sucesso.",
          renewSuccessReactivated: "Vencimento renovado e empresa reativada com sucesso.",
          deleteGridTitle: "Excluir empresa",
          deleteGridMessage:
            "Esta ação remove a empresa «{{name}}» e dados associados. Não pode ser desfeita. Para confirmar, escreva o nome exacto da empresa abaixo.",
          deleteGridNameLabel: "Nome da empresa para confirmar",
          deleteGridHint: "O botão só fica ativo quando o nome coincidir exactamente.",
          deleteGridConfirm: "Excluir definitivamente",
          deleteGridSuccess: "Empresa excluída.",
          internalNotesTooltip: "Observação interna",
          internalNotesDialogTitle: "Observação interna",
          internalNotesHint: "Visível apenas para super administradores.",
          internalNotesPlaceholder: "Anotações para uso administrativo…",
          internalNotesSave: "Guardar",
          internalNotesSaved: "Observação guardada.",
          companyHistoryTooltip: "Histórico da empresa",
          companyHistoryTitle: "Histórico da empresa",
          companyHistoryEmpty: "Ainda não há registros.",
          companyLogActions: {
            renew: "Plano renovado",
            block: "Empresa bloqueada",
            unblock: "Empresa desbloqueada",
            delete: "Empresa excluída",
            warning_before_due: "Aviso automático — antes do vencimento",
            warning_after_due: "Aviso automático — após o vencimento",
            auto_block: "Bloqueio automático por atraso",
            auto_unblock_after_renew: "Reativação automática após renovação",
            contracted_value_change: "Valor contratado atualizado",
            plan_change: "Plano da empresa alterado",
          },
          logDetailRenew: "Vencimento: {{from}} → {{to}}",
          logDetailBlock: "Conta inativa (bloqueio operacional).",
          logDetailUnblock: "Conta reativada.",
          logDetailDelete: "Registo antes de remover dados ({{name}}).",
          logDetailWarningBefore:
            "Vencimento {{date}} — faltam {{days}} dia(s) (alerta configurado).",
          logDetailWarningAfter:
            "Vencimento {{date}} — {{days}} dia(s) em atraso (alerta configurado).",
          logDetailAutoBlock:
            "Vencimento {{date}} — {{days}} dia(s) em atraso; conta inativada automaticamente.",
          logDetailAutoUnblockAfterRenew:
            "Renovação: vencimento {{from}} → {{to}}; conta reativada automaticamente.",
          logDetailContractedValueChange:
            "Anterior: {{from}} → novo: {{to}} (valor de catálogo do plano: {{planBase}}).",
          logDetailPlanChange: "Plano (id): {{from}} → {{to}}.",
          logActor: "Por {{name}}",
          logActorSystem: "Automático (job de faturação)",
          logWhatsappSent: "WhatsApp enviado (final ••{{last4}})",
          logWhatsappNotSent: "WhatsApp: não enviado ({{reason}})",
          dueAlertExpiredTooltip: "Vencimento ultrapassado — requer atenção",
          dueAlertSoonTooltip: "Vence em breve — acompanhar",
        },
        support: {
          entered: "Modo suporte ativado.",
          exited: "Você saiu do modo suporte.",
          banner: "Você está acessando a empresa {{name}} em modo suporte.",
          exitButton: "Voltar ao Super Admin",
        },
        branding: {
          title: "Branding global",
          subtitle:
            "Nome e logos (tema claro e escuro) no login e no menu interno para todos os utilizadores.",
          systemName: "Nome do sistema",
          loginLogo: "Logos da página de login",
          loginLogoThemeLight: "Logo para tema claro (predefinida).",
          menuLogo: "Logos do menu interno",
          menuLogoThemeLight: "Logo para tema claro (predefinida).",
          previewLight: "Pré-visualização (fundo claro)",
          previewDark: "Pré-visualização (fundo escuro)",
          loginLogoDark: "Logo para tema escuro (opcional)",
          loginLogoDarkHint:
            "Se não enviar, utiliza-se a logo clara em todos os temas. Recomendada variante clara/alta para fundo escuro.",
          menuLogoDark: "Logo do menu para tema escuro (opcional)",
          menuLogoDarkHint:
            "Se não enviar, utiliza-se a logo clara no menu em todos os temas.",
          chooseFileLight: "Escolher imagem (claro)",
          chooseFileDark: "Escolher imagem (escuro)",
          restoreDefaultLight: "Repor logo clara",
          restoreDefaultDark: "Repor logo escura",
          uploadHint:
            "PNG, JPG, WebP, GIF ou SVG até 2 MB. Sem novo ficheiro, mantém-se o logo atual.",
          loginLogoHint:
            "Formatos suportados: PNG, JPG, WebP.\nRecomendado: imagem horizontal (proporção 3:1 ou 4:1).\nExemplo: 300x100, 400x100, 600x150.\nPreferencialmente com fundo transparente.",
          menuLogoHint:
            "Formatos suportados: PNG, JPG, WebP.\nRecomendado: imagem horizontal compacta (proporção 2:1 ou 3:1).\nExemplo: 200x80, 240x80.\nEvite imagens muito altas ou quadradas.",
          favicon: "Favicon do sistema",
          uploadHintFavicon: "PNG, ICO, SVG ou JPG até 1 MB. Sem novo ficheiro, mantém-se o ícone atual.",
          faviconHint:
            "Formatos suportados: PNG, ICO, SVG.\nRecomendado: imagem quadrada (proporção 1:1).\nExemplo: 32x32, 64x64 ou 128x128.",
          chooseFile: "Escolher imagem",
          restoreDefault: "Usar logo padrão",
          saved: "Branding atualizado com sucesso.",
          save: "Salvar",
          loginWhatsAppSection: "Botão de WhatsApp na página de login",
          loginWhatsAppSectionSubtitle:
            "Define o número do botão flutuante no login. Se ficar vazio, o botão não é exibido.",
          loginWhatsAppNumber: "Número do WhatsApp",
          loginWhatsAppNumberHint:
            "Use formato internacional, apenas dígitos — ex.: 5527999999999 (sem espaços, traços ou parênteses).",
          loginWhatsAppMessage: "Mensagem inicial (opcional)",
          loginWhatsAppMessagePlaceholder: "Olá! Vim pela página de login.",
          loginWhatsAppMessageHint:
            "Se preencher, o link do WhatsApp inclui este texto como mensagem inicial (parâmetro text).",
        },
        finance: {
          title: "Financeiro da plataforma",
          subtitle:
            "Visão consolidada por empresa: planos, vencimentos e status operacional. Ideal para acompanhamento rápido — sem fluxo de cobrança automática.",
          kpiSection: "Indicadores",
          kpiTotal: "Total de empresas",
          kpiEmDia: "Empresas em dia",
          kpiEmDiaHint: "Ativas, sem vencimento ultrapassado (inclui “vencendo em breve” e “sem vencimento”).",
          kpiInadimplente: "Inadimplentes",
          kpiSoon: "Vencendo em breve",
          kpiSoonHint: "Vencimento nos próximos 30 dias",
          kpiInactive: "Inativas",
          kpiRevenue: "Receita prevista",
          kpiRevenueHint:
            "Estimativa: soma das mensalidades efetivas das empresas ativas (valor contratado quando existir, senão valor do plano).",
          tableSection: "Carteira de empresas",
          searchLabel: "Busca",
          searchPlaceholder: "Nome ou e-mail…",
          filterFinanceLabel: "Situação financeira",
          filterFinanceAll: "Todas",
          filterFinanceOk: "Em dia",
          filterFinanceSoon: "Vencendo em breve",
          filterFinanceOverdue: "Inadimplente",
          filterFinanceNoDue: "Sem vencimento",
          filterFinanceInactive: "Inativa (conta)",
          filterCompanyLabel: "Status da empresa",
          filterCompanyAll: "Todas",
          filterCompanyActive: "Ativas",
          filterCompanyInactive: "Inativas",
          loading: "Carregando dados…",
          emptyTitle: "Nenhuma empresa neste filtro",
          emptySubtitle: "Ajuste a situação financeira, o status ou a busca.",
          colCompany: "Empresa",
          colPlan: "Plano",
          colPlanValue: "Valor do plano",
          colDue: "Vencimento",
          colRecurrence: "Recorrência",
          colFinance: "Situação financeira",
          colCompanyStatus: "Status da empresa",
          colActions: "Ações",
          actionEdit: "Abrir empresa",
          companyStatus: {
            active: "Ativa",
            inactive: "Inativa",
          },
          status: {
            inactive: "Inativa",
            overdue: "Inadimplente",
            soon: "Vencendo em breve",
            ok: "Em dia",
            noDue: "Sem vencimento",
          },
        },
        backup: {
          title: "Backup e restauração",
          subtitle:
            "Gere um ficheiro ZIP com a base de dados (dump SQL) e a pasta public (uploads, branding, anexos). Requer mysqldump ou pg_dump no servidor. A restauração substitui a BD e os ficheiros públicos — é criado um backup de segurança antes.",
          sectionGenerate: "Gerar backup",
          sectionGenerateHint:
            "O processo pode demorar conforme o tamanho da base e dos ficheiros. O cliente MySQL/PostgreSQL de linha de comando deve estar instalado no servidor.",
          generate: "Gerar backup agora",
          generateHint:
            "Cada backup inclui manifest.json (metadados), database.sql e a árvore public/. Não inclui .env, Redis, filas Bull nem configuração do proxy.",
          sectionAuto: "Backups automáticos",
          sectionAutoHint:
            "Agendamento no servidor (node-cron). Os ficheiros ficam na mesma pasta dos backups manuais. A retenção aplica-se só a cópias automáticas.",
          autoEnabled: "Ativar backup automático",
          autoFrequency: "Frequência",
          freqDaily: "Diário",
          freqWeekly: "Semanal",
          autoTime: "Horário de execução",
          autoWeekday: "Dia da semana",
          weekdays: {
            0: "Domingo",
            1: "Segunda",
            2: "Terça",
            3: "Quarta",
            4: "Quinta",
            5: "Sexta",
            6: "Sábado",
          },
          autoRetention: "Máximo de backups automáticos a manter",
          autoRetentionHint: "Backups manuais e de pré-restauração não são apagados por esta regra.",
          saveAuto: "Guardar agendamento",
          summaryTitle: "Resumo do agendamento",
          summaryStatus: "Estado",
          statusActive: "Ativo",
          statusInactive: "Inativo",
          summarySchedule: "Plano",
          summaryRetentionShort: "Retenção",
          retentionValue: "{{n}} backups automáticos",
          nextTitle: "Próximo backup automático",
          nextDisabled: "Backup automático desativado.",
          nextUnknown: "Não foi possível calcular a próxima execução com os dados atuais.",
          nextEstimateHint:
            "Estimativa com base no relógio deste navegador; a execução real segue o relógio do servidor.",
          nextLineToday: "Hoje às {{time}}",
          nextLineTomorrow: "Amanhã às {{time}}",
          nextLineWeekday: "{{weekday}} às {{time}}",
          timezoneNote: "O horário de execução configurado segue o relógio do servidor onde o backend corre.",
          browserTz: "Fuso deste navegador (referência): {{tz}}",
          formTitle: "Editar agendamento",
          formSubtitle: "Guarde para aplicar. O resumo ao lado atualiza após guardar.",
          nextCardTitle: "Próximo automático",
          nextCardHint: "Estimativa local; o servidor pode diferir no fuso.",
          nextCardOff: "Ative o agendamento para ver a previsão.",
          lastTitle: "Último backup na lista",
          sectionListHint: "Lista ordenada do mais recente para o mais antigo.",
          autoPendingHint:
            "O agendamento está ativo mas ainda não há backups marcados como automáticos na lista — a primeira execução pode ser no próximo horário.",
          emptyHintAutoOn:
            "Ainda não há ficheiros. Pode gerar um backup manual agora ou aguardar o agendamento automático.",
          badgeRecent: "Mais recente",
          sectionList: "Backups disponíveis no servidor",
          loading: "A carregar lista…",
          empty: "Ainda não há backups",
          emptyHint: "Use “Gerar backup agora” para criar o primeiro.",
          colDate: "Data",
          colFile: "Ficheiro",
          colSize: "Tamanho",
          colType: "Tipo",
          colStatus: "Estado",
          colActions: "Ações",
          type: {
            manual: "Manual",
            automatic: "Automático",
            pre_restore: "Pré-restauração",
          },
          delete: "Excluir",
          deleteTitle: "Excluir backup",
          deleteBody: "Esta ação remove o ficheiro ZIP do servidor de forma permanente.",
          deleteConfirmLabel: "Confirmação",
          deleteConfirmHelper: "Para apagar, escreva: EXCLUIR",
          deleteConfirmButton: "Excluir definitivamente",
          deletePhraseError: "Escreva exatamente EXCLUIR para continuar.",
          statusOk: "Válido",
          statusInvalid: "Inválido",
          download: "Descarregar",
          sectionRestore: "Restaurar a partir de ficheiro",
          restoreIntro:
            "Carregue um ZIP gerado por esta instalação (mesmo formato). O motor de BD do backup tem de coincidir com o servidor (MySQL ou PostgreSQL).",
          selectFile: "Escolher ficheiro .zip",
          previewTitle: "Pré-visualização",
          previewDb: "Base no backup: {{name}}",
          previewDialect: "Motor: {{d}}",
          previewVersion: "Versão da app no backup: {{v}}",
          confirmLabel: "Confirmação",
          confirmHelper: "Para confirmar a restauração, escreva: RESTAURAR",
          restoreButton: "Restaurar (irreversível na BD atual)",
          restoreConfirmError: "Escreva exatamente RESTAURAR para continuar.",
          modalTitle: "Confirmar restauração",
          modalBody:
            "Esta operação substitui a base de dados atual e a pasta public. Antes é criado automaticamente um backup de segurança no servidor. Recomenda-se reiniciar o backend após o sucesso.",
          modalConfirm: "Sim, restaurar",
          toasts: {
            generated: "Backup criado com sucesso.",
            uploadValidated: "Ficheiro reconhecido. Confirme para restaurar.",
            restored: "Restauração concluída.",
            autoSaved: "Agendamento de backup guardado.",
            deleted: "Backup removido do servidor.",
          },
          futureHint:
            "Envio para nuvem (S3, Drive, etc.) ficará para uma fase seguinte. O manifest já inclui o tipo de origem (manual, automático, pré-restauração).",
        },
        superAdmins: {
          title: "Super Admins",
          subtitle:
            "Utilizadores com acesso administrativo global. Pode vincular ou não a uma empresa: sem vínculo, a conta serve apenas para gestão SaaS (/saas).",
          createAction: "Novo Super Admin",
          createTitle: "Criar utilizador (painel SaaS)",
          promoteAction: "Promover utilizador",
          tableTitle: "Super administradores",
          colName: "Nome",
          colEmail: "E-mail",
          colSuper: "Super admin",
          colCompany: "Empresa",
          colProfile: "Perfil",
          colOnline: "Estado",
          colActions: "Ações",
          yes: "Sim",
          no: "Não",
          edit: "Editar",
          editTitle: "Editar utilizador",
          fieldName: "Nome",
          fieldEmail: "E-mail",
          fieldProfile: "Perfil",
          fieldSuper: "Super administrador da plataforma",
          fieldCompany: "Empresa vinculada (opcional para Super Admin)",
          companyHintSuper:
            "Opcional para super admin. Escolha \"Sem empresa\" para conta só SaaS (sem operação de tenant).",
          companyHintNonSuper: "Obrigatório: utilizadores que não são super admin devem pertencer a uma empresa.",
          companyNoneOption: "Sem empresa (só gestão SaaS)",
          companySelectPlaceholder: "Selecione uma empresa…",
          companySaaSOnly: "Só SaaS",
          toastCompanyRequiredNonSuper: "Selecione uma empresa. Utilizadores sem privilégio super devem estar vinculados.",
          fieldPassword: "Nova senha (opcional)",
          fieldPasswordCreate: "Senha inicial",
          passwordHint:
            "Deixe em branco para manter a senha atual. Se definir uma nova: mínimo 8 caracteres, maiúscula, minúscula e número.",
          passwordCreateHint:
            "Mínimo 8 caracteres, com maiúscula, minúscula e número. O utilizador pode alterar depois do login.",
          cancel: "Cancelar",
          save: "Guardar",
          createSave: "Criar utilizador",
          createNonSuperNote:
            "Quem não for super admin não aparece nesta lista — faça a gestão em Utilizadores da empresa escolhida.",
          promoteTitle: "Promover a super admin",
          promoteHint:
            "Pesquise por nome ou e-mail (mínimo 2 caracteres). O utilizador passa a aceder à Gestão SaaS. Para remover a empresa depois, use Editar.",
          searchPlaceholder: "Pesquisar utilizador…",
          alreadySuper: "Já é super admin",
          promote: "Promover",
          close: "Fechar",
          confirmDemoteSelf:
            "Tem a certeza de que quer remover o seu próprio privilégio de super admin? Pode perder o acesso ao painel Plataforma.",
          toastSaved: "Alterações guardadas.",
          toastCreated: "Utilizador criado com sucesso.",
          toastPromoted: "Utilizador promovido a super admin.",
          toastCreateValidation:
            "Preencha nome, e-mail e uma senha que cumpra os requisitos de segurança.",
        },
        myAccount: {
          title: "Minha conta",
          subtitle: "Atualize o seu nome, e-mail e senha de acesso à plataforma.",
          formTitle: "Dados da conta",
          fieldName: "Nome",
          fieldEmail: "E-mail",
          fieldPassword: "Nova senha (opcional)",
          passwordHint:
            "Deixe em branco para manter a senha atual. Se definir uma nova: mínimo 8 caracteres, maiúscula, minúscula e número.",
          save: "Guardar alterações",
          toastSaved: "Dados atualizados com sucesso.",
        },
      },
      queueIntegration: {
        title: "Automações por setor",
        pageSubtitle:
          "Cadastro de integrações vinculadas a setores ou à conexão WhatsApp. Tipos diferentes têm comportamentos diferentes — Webhook/N8N apenas enviam dados por POST; Flowbuilder e Typebot tratam a conversa no atendimento.",
        pageIntro:
          "Essa integração envia dados para um sistema externo quando for Webhook ou N8N, mas não recebe respostas automaticamente no atendimento. Guarde o registro aqui e vincule-o em Filas (e opcionalmente na conexão). Para conversa automática com o cliente no WhatsApp, use Flowbuilder ou Typebot.",
        table: {
          id: "ID",
          type: "Tipo",
          categoryInternal: "Interna",
          categoryExternal: "Externa",
          categoryLegacy: "Legado",
          name: "Nome",
          projectName: "Nome do Projeto",
          language: "Linguagem",
          lastUpdate: "Ultima atualização",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar automação",
        },
        searchPlaceholder: "Pesquisar...",
        toasts: {
          deleted: "Automação excluída com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Você tem certeza? Essa ação não pode ser revertida! e será removida dos setores e conexões vinculadas",
        },
      },
      files: {
        title: "Lista de arquivos",
        table: {
          name: "Nome",
          contacts: "Contatos",
          actions: "Ação",
        },
        toasts: {
          deleted: "Lista excluída com sucesso!",
          deletedAll: "Todas as listas foram excluídas com sucesso!",
        },
        buttons: {
          add: "Adicionar",
          deleteAll: "Deletar Todos",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteAllTitle: "Deletar Todos",
          deleteMessage: "Tem certeza que deseja deletar esta lista?",
          deleteAllMessage: "Tem certeza que deseja deletar todas as listas?",
        },
      },
      messagesAPI: {
        title: "API de envio WhatsApp",
        subtitle:
          "Envie mensagens a partir de sistemas externos via HTTP, usando o token da conexão WhatsApp escolhida.",
        copySuccess: "URL copiada para a área de transferência.",
        sections: {
          overview: "Visão geral",
          token: "Como obter o token",
          endpoint: "Endpoint e autenticação",
          requestBodies: "Formatos de envio",
          responses: "Respostas HTTP",
          testText: "Testar envio de texto",
          testMedia: "Testar envio com mídia",
        },
        overviewP1:
          "Esta página documenta a API de envio de mensagens WhatsApp. Cada token pertence a uma única conexão (chip / número) da sua empresa.",
        overviewP2:
          "O token não é criado aqui: em Conexões, edite a conexão desejada e use a opção para gerar ou copiar o token. Esse segredo identifica qual conexão enviará as mensagens.",
        tokenSteps:
          "Abra Conexões, escolha a conexão que deve enviar as mensagens, edite e gere o token. Guarde-o em local seguro — quem possui o token pode enviar mensagens por essa conexão.",
        openConnections: "Ir para Conexões",
        endpointUrlLabel: "URL do endpoint",
        endpointUrlHelp:
          "Use exatamente esta URL nas integrações (servidor, Postman ou scripts).",
        methodLabel: "Método HTTP",
        authTitle: "Cabeçalho obrigatório",
        authLine: "Authorization: Bearer <token>",
        authHelp:
          "Substitua <token> pelo valor gerado em Conexões para a conexão escolhida.",
        contentTypeJson: "Content-Type: application/json (envio somente texto)",
        contentTypeMultipart:
          "Content-Type: multipart/form-data (envio com arquivo)",
        jsonBodyTitle: "Corpo JSON (texto)",
        jsonBodyExample:
          '{ "number": "5511999999999", "body": "Sua mensagem aqui" }',
        multipartBodyTitle: "Multipart (mídia)",
        multipartFields:
          "Campos: number (texto), medias (arquivo). O campo body opcional pode ser usado como legenda conforme o backend.",
        numberFormatTitle: "Formato do número",
        numberFormatText:
          "Use apenas dígitos, com código do país e DDD, sem espaços ou símbolos. Exemplo: 5511999999999.",
        responsesIntro: "Respostas comuns desta API:",
        responses: {
          r200: "200 — Envio processado com sucesso (corpo pode incluir mensagem de confirmação).",
          r401:
            "401 — Token inválido ou ausente (código ERR_INVALID_API_TOKEN).",
          r403:
            "403 — Plano sem permissão para API externa (ERR_EXTERNAL_API_NOT_ALLOWED).",
          r429: "429 — Limite de requisições excedido (ERR_RATE_LIMIT_EXCEEDED).",
          r400:
            "400 — Erro de validação ou falha no envio (ex.: ERR_MESSAGE_SEND_FAILED e mensagem opcional).",
        },
        textMessage: {
          number: "Número do destinatário",
          body: "Texto da mensagem",
          token: "Token da conexão (Bearer)",
          tokenPlaceholder: "Cole o token gerado em Conexões",
          tokenHelper:
            "Cada token corresponde a uma conexão WhatsApp. Não compartilhe publicamente.",
          numberPlaceholder: "5511999999999",
          numberHelper:
            "Apenas dígitos, com código do país e DDD, sem máscara.",
        },
        mediaMessage: {
          number: "Número do destinatário",
          body: "Nome do arquivo",
          media: "Arquivo",
          token: "Token da conexão (Bearer)",
          tokenPlaceholder: "Cole o token gerado em Conexões",
          tokenHelper:
            "O mesmo token usado para envio de texto, referente à conexão que enviará o arquivo.",
          numberPlaceholder: "5511999999999",
          numberHelper:
            "Apenas dígitos, com código do país e DDD, sem máscara.",
          chooseFile: "Selecionar arquivo",
          noFile: "Nenhum arquivo selecionado",
          fileRequired: "Selecione um arquivo para enviar.",
        },
        test: {
          endpointReadonly: "Endpoint (somente leitura)",
          textIntro:
            "Preencha o token da conexão, o número e a mensagem. O pedido será enviado como JSON para o mesmo endpoint da documentação.",
          mediaIntro:
            "Use o mesmo endpoint com multipart: número, arquivo em medias e token no cabeçalho.",
          noResultYet: "Nenhum teste executado ainda. O resultado aparecerá aqui.",
          resultOk: "Sucesso — HTTP {{status}}",
          resultErr: "Falha na requisição",
          resultErrStatus: "Falha — HTTP {{status}}",
        },
        toasts: {
          unauthorized:
            "Esta empresa não possui permissão para acessar essa página. Redirecionando…",
          success: "Mensagem enviada com sucesso!",
        },
        buttons: {
          send: "Enviar teste",
        },
      },
      notifications: {
        title: "Notificações",
        noTickets: "Nenhuma notificação.",
      },
      userNotificationCenter: {
        title: "Central de notificações",
        pageTitle: "Notificações",
        empty: "Nenhuma notificação.",
        emptyUnread: "Não tens notificações por ler.",
        emptyRead: "Não há notificações lidas neste filtro.",
        emptyArchived: "Não há notificações arquivadas.",
        emptyFiltered: "Nenhum resultado para esta pesquisa ou filtros.",
        markAllRead: "Marcar todas como lidas",
        archiveRead: "Arquivar lidas",
        viewAll: "Ver todas",
        all: "Todas",
        unread: "Não lidas",
        readTab: "Lidas",
        archivedTab: "Arquivadas",
        unreadSection: "Não lidas",
        readSection: "Lidas",
        yesterday: "Ontem",
        listLoadError: "Não foi possível carregar as notificações. Tenta novamente.",
        archiveOneAria: "Arquivar notificação",
        filterKind: "Tipo",
        kindAll: "Todos os tipos",
        kindTicket: "Tickets",
        kindAppointment: "Agenda",
        kindBilling: "Cobrança (plataforma)",
        searchPlaceholder: "Pesquisar no título ou texto…",
        searchButton: "Pesquisar",
        bulkMarkRead: "Marcar selecionadas como lidas",
        bulkArchive: "Arquivar selecionadas",
        statusArchived: "Arquivada",
        bellAria: "Abrir central de notificações",
        noCompany: "Inicia sessão com uma empresa ativa ou como super administrador.",
        colTitle: "Título",
        colPreview: "Resumo",
        colWhen: "Quando",
        colStatus: "Estado",
        statusRead: "Lida",
        statusUnread: "Não lida",
        rowsPerPage: "Por página",
      },
      agenda: {
        title: "Agenda",
        noCompany: "É necessária uma empresa ativa para usar a agenda.",
        newEvent: "Novo evento",
        emptyState: "Nenhum evento neste período no calendário. Altere o mês ou crie um compromisso.",
        loadError: "Não foi possível carregar os compromissos. Atualize a página ou tente novamente.",
        periodLabel: "Período carregado",
        view: {
          calendar: "Calendário",
          list: "Lista",
        },
        filters: {
          quick: {
            all: "Todos",
            my: "Meus eventos",
            createdByMe: "Criados por mim",
            collective: "Coletivos",
            individual: "Individuais",
            today: "Hoje",
            next7: "Próximos 7 dias",
          },
          searchPlaceholder: "Buscar por título, descrição, criador ou participantes…",
          clear: "Limpar filtros",
          clearSearch: "Limpar busca",
          emptyFilteredTitle: "Nenhum resultado com estes filtros",
          emptyFilteredSubtitle:
            "Tente outro termo de busca ou remova os filtros para ver todos os compromissos do período.",
        },
        stats: {
          inPeriod: "compromissos no período",
          inVisibleRange: "no intervalo visível (filtros aplicados)",
          shown: "exibidos",
          todayCount: "hoje",
        },
        calendarEvent: {
          collectiveTag: "Coletivo",
          allDayShort: "Dia inteiro",
        },
        list: {
          emptyTitle: "Nenhum compromisso neste período",
          emptySubtitle: "Crie um evento ou altere o intervalo no calendário e volte à lista.",
          viewDetails: "Ver detalhes",
          noParticipants: "Sem participantes listados",
          todayBadge: "Hoje",
          group: {
            today: "Hoje",
            tomorrow: "Amanhã",
            later: "Próximos dias",
          },
        },
        details: {
          sectionTitle: "Detalhes",
          creator: "Criador",
          createdByMe: "Criado por mim",
          createdByOther: "Outro utilizador",
          readOnlyHint: "Só pode visualizar este compromisso. Apenas o criador ou um administrador/supervisor (em eventos coletivos) pode editar.",
          fieldsSection: "Dados do compromisso",
        },
        participantStatus: {
          pending: "Pendente",
          accepted: "Aceite",
          declined: "Recusado",
        },
        respond: {
          accept: "Aceitar convite",
          decline: "Recusar",
          success: "Resposta registada.",
        },
        deleteConfirmTitle: "Excluir evento?",
        deleteConfirmMessage: "Esta ação não pode ser desfeita.",
        deleteConfirmAction: "Excluir",
        toasts: {
          readOnly: "Sem permissão de edição deste evento.",
          created: "Evento criado.",
          updated: "Evento atualizado.",
          scheduleUpdated: "Compromisso atualizado.",
          undo: "Desfazer",
          undoFailed: "Não foi possível desfazer. Atualize a agenda.",
          deleted: "Evento removido.",
          inviteReceived: "Novo convite de agenda.",
        },
        duplicate: {
          action: "Duplicar",
          titlePrefix: "Cópia de {{title}}",
          untitled: "Evento sem título",
        },
        legend: {
          individual: "Individual",
          collective: "Coletivo",
          mine: "Criado por mim",
        },
        calendar: {
          next: "Próximo",
          prev: "Anterior",
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          day: "Dia",
          agenda: "Lista",
          date: "Data",
          time: "Hora",
          event: "Evento",
          showMore: "+{{count}} mais",
        },
        form: {
          create: "Novo compromisso",
          edit: "Editar compromisso",
          title: "Título",
          titleRequired: "Informe o título.",
          description: "Descrição",
          start: "Início",
          end: "Fim",
          allDay: "Dia inteiro",
          collective: "Evento coletivo",
          visibility: "Visibilidade",
          visPrivate: "Privado (apenas participantes convidados)",
          visTeam: "Equipe (mesmo setor / filas em comum com o criador)",
          visCompany: "Empresa (todos da empresa)",
          participants: "Participantes",
          cancel: "Cancelar",
          save: "Salvar",
          endAfterStart: "O fim deve ser após o início.",
          invalidDate: "Data ou hora inválida. Verifique início e fim.",
          participantsRequired: "Inclua ao menos um participante para evento coletivo privado.",
          color: "Cor do evento",
          colorHint:
            "Opcional. Se usar o padrão, a cor segue o tipo (individual / coletivo) e destaca eventos criados por si.",
          colorClear: "Cor padrão",
          palette: {
            blue: "Azul",
            green: "Verde",
            yellow: "Amarelo",
            red: "Vermelho",
            purple: "Roxo",
            gray: "Cinza",
          },
        },
      },
      quickMessages: {
        title: "Respostas Rápidas",
        searchPlaceholder: "Buscar por atalho ou texto da mensagem…",
        noAttachment: "Sem anexo",
        empty: {
          title: "Nenhuma resposta rápida encontrada",
          subtitle: "Ajuste a busca ou crie um atalho com / no atendimento.",
        },
        confirmationModal: {
          deleteTitle: "Exclusão",
          deleteMessage:
            "A lista do chat será atualizada. Esta ação não pode ser desfeita.",
        },
        validation: {
          shortcodeRequired: "Informe o atalho",
          shortcodeMin: "Mínimo 2 caracteres",
          shortcodeMax: "Máximo 80 caracteres",
          messageRequired: "Informe a mensagem",
          messageMax: "Mensagem muito longa",
          categoryMax: "Máximo 120 caracteres",
        },
        buttons: {
          add: "Adicionar",
          attach: "Anexar Arquivo",
          cancel: "Cancelar",
          edit: "Editar",
          delete: "Excluir",
        },
        toasts: {
          success: "Resposta rápida salva com sucesso!",
          deleted: "Resposta rápida excluída.",
          deletedMedia: "Anexo removido com sucesso!",
        },
        dialog: {
          title: "Mensagem Rápida",
          shortcode: "Atalho",
          shortcodeHint: "ex.: ola (uso no chat: /ola)",
          shortcodeHelper: "Será normalizado em minúsculas; não use espaços no meio.",
          category: "Grupo / etiqueta (opcional)",
          message: "Resposta",
          previewLabel: "Pré-visualização",
          previewEmpty: "(nada digitado)",
          save: "Salvar",
          cancel: "Cancelar",
          geral: "Permitir editar",
          add: "Adicionar",
          edit: "Editar",
          visao: "Permitir visão",
        },
        table: {
          shortcode: "Atalho",
          category: "Grupo",
          messagePreview: "Prévia da mensagem",
          message: "Mensagem",
          actions: "Ações",
          mediaName: "Nome do Arquivo",
          attachment: "Anexo",
          createdAt: "Criado em",
          updatedAt: "Atualizado",
          status: "Status",
        },
        chat: {
          title: "Respostas rápidas",
          hintSlash:
            "Dica: no campo de mensagem, digite / para buscar e inserir por atalho.",
          variablesHint:
            "Variáveis: {nome}, {primeiro_nome}, {empresa}, {atendente} (e o legado {{name}}, {{firstName}}, etc.). Dados faltando ficam vazios.",
          loadingList: "Carregando…",
          emptyFilter: "Ajuste a busca ou crie uma nova resposta abaixo.",
          newReply: "+ Nova resposta",
          backToList: "Voltar à lista",
          categoryAll: "Todas",
          sectionsFavorites: "Favoritas",
          sectionsRecents: "Recentes",
          sectionsAll: "Todas as respostas",
          favoriteToggle: "Favoritar resposta",
          greetingDefault: "Olá",
        },
      },
      messageVariablesPicker: {
        label: "Variavéis disponíveis",
        vars: {
          contactFirstName: "Primeiro Nome",
          contactName: "Nome",
          greeting: "Saudação",
          protocolNumber: "Protocolo",
          date: "Data",
          hour: "Hora",
        },
      },
      contactLists: {
        title: "Listas de Contatos",
        table: {
          name: "Nome",
          contacts: "Contatos",
          actions: "Ações",
        },
        buttons: {
          add: "Nova Lista",
        },
        dialog: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          company: "Empresa",
          okEdit: "Editar",
          okAdd: "Adicionar",
          add: "Adicionar",
          edit: "Editar",
          cancel: "Cancelar",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          deleted: "Registro excluído",
          success: "Operação realizada com sucesso",
        },
      },
      contactListItems: {
        title: "Contatos",
        searchPlaceholder: "Pesquisa",
        buttons: {
          add: "Novo",
          lists: "Listas",
          import: "Importar",
        },
        download: "Clique aqui para baixar planilha exemplo.",
        dialog: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          number: "Número",
          numberShort: "Número curto",
          numberLong: "Número longo",
          whatsapp: "Whatsapp",
          email: "E-mail",
          emailInvalid: "E-mail inválido",
          okEdit: "Editar",
          okAdd: "Adicionar",
          add: "Adicionar",
          edit: "Editar",
          cancel: "Cancelar",
        },
        table: {
          name: "Nome",
          number: "Número",
          whatsapp: "Whatsapp",
          email: "E-mail",
          actions: "Ações",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
          importMessage: "Deseja importar os contatos desta planilha? ",
          importTitlte: "Importar",
        },
        toasts: {
          deleted: "Registro excluído",
        },
      },
      campaigns: {
        title: "Campanhas",
        pageSubtitle:
          "Disparos por lista de contatos e conexão WhatsApp.",
        searchPlaceholder: "Pesquisa",
        report: {
          title: "Relatório de",
          title2: "Campanha",
          of: "de",
          validContacts: "Contatos válidos",
          delivered: "Entregues",
          connection: "Conexão",
          contactList: "Lista de Contatos",
          schedule: "Agendamento",
          conclusion: "Conclusão",
        },
        config: {
          interval: "Intervalos",
          randomInterval: "Intervalo Randômico de Disparo",
          biggerInterval: "Intervalo Maior Após",
          greaterInterval: "Intervalo de Disparo Maior",
          noInterval: "Sem Intervalo",
          second: "segundo",
          seconds: "segundos",
          notDefined: "Não definido",
          addVariable: "Adicionar Variável",
          save: "Salvar Configurações",
          shortcut: "Atalho",
          content: "Conteúdo",
          close: "Fechar",
          add: "Adicionar",
        },
        buttons: {
          add: "Nova Campanha",
          contactLists: "Listas de Contatos",
        },
        loading: "Carregando campanhas…",
        empty: {
          title: "Nenhuma campanha cadastrada",
          subtitle:
            "Crie uma campanha para enviar mensagens em massa às suas listas de contatos.",
        },
        status: {
          inactive: "Inativa",
          programmed: "Programada",
          inProgress: "Em andamento",
          canceled: "Cancelada",
          finished: "Finalizada",
        },
        table: {
          name: "Nome",
          whatsapp: "Conexão",
          contactList: "Lista de Contatos",
          status: "Status",
          progress: "Progresso",
          progressLine: "{{pct}}% concluído ({{sent}}/{{total}})",
          failedLine: "Falhas: {{failed}}",
          retryFailed: "Reenviar falhas",
          scheduledAt: "Agendamento",
          completedAt: "Concluída",
          confirmation: "Confirmação",
          actions: "Ações",
          notDefined: "Não definida",
          notDefined2: "Não definido",
          notScheduled: "Sem agendamento",
          notConcluded: "Não concluída",
          stopCampaign: "Parar Campanha",
          resumeCampaign: "Retomar campanha",
          report: "Relatório",
          edit: "Editar",
          delete: "Excluir",
        },
        dialog: {
          new: "Nova Campanha",
          update: "Editar Campanha",
          readonly: "Apenas Visualização",
          contactStats: {
            title: "Público da campanha",
            loading: "Calculando contatos…",
            tagOnlyHint:
                "A lista será gerada ao salvar com base na tag selecionada.",
            line: "Total: {{total}} · Válidos (WhatsApp): {{valid}} · Inválidos: {{invalid}}",
          },
          preview: {
            title: "Pré-visualização (exemplo)",
            mockLine:
                "Exemplo: Nome: João · Número: 5511999999999 · variáveis {nome}, {numero}, {email}",
            empty: "(sem texto nesta mensagem)",
          },
          confirmSend: {
            title: "Confirmar envio",
            messageWithCount:
                "Você está prestes a enviar uma campanha para {{count}} contatos válidos.",
            tagOnly:
                "A lista será gerada ao salvar. Deseja continuar?",
            generic: "Deseja salvar a campanha?",
            confirm: "Confirmar envio",
          },
          confirmRestart: {
            title: "Reiniciar disparos",
            message:
                "A campanha será retomada. Contatos já enviados não serão reenviados. Deseja continuar?",
            confirm: "Confirmar",
          },
          confirmRetryFailed: {
            title: "Reenviar falhas",
            message:
                "Somente os contatos com falha serão reenviados. Contatos já entregues não serão afetados.",
            confirm: "Reenviar",
          },
          opsSummary: {
            title: "Situação do envio",
            line: "Válidos (meta): {{total}} · Enviados: {{sent}} · Pendentes: {{pending}} · Falhas: {{failed}}",
          },
          form: {
            name: "Nome",
            nameShort: "Nome curto",
            nameLong: "Nome longo",
            helper:
                "Utilize variáveis como {nome}, {numero}, {email} ou defina variáveis personalziadas.",
            nameRequired: "Nome é obrigatório",
            message1: "Mensagem 1",
            message2: "Mensagem 2",
            message3: "Mensagem 3",
            message4: "Mensagem 4",
            message5: "Mensagem 5",
            messagePlaceholder: "Conteúdo da mensagem",
            whatsapp: "Conexão",
            status: "Status",
            scheduledAt: "Agendamento",
            confirmation: "Confirmação",
            contactList: "Lista de Contato",
            tagList: "Lista de Tags",
            fileList: "Lista de Arquivos",
          },
          buttons: {
            add: "Adicionar",
            edit: "Atualizar",
            okadd: "Ok",
            cancel: "Cancelar Disparos",
            restart: "Reiniciar Disparos",
            close: "Fechar",
            attach: "Anexar Arquivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          configSaved: "Configurações salvas",
          success: "Operação realizada com sucesso",
          cancel: "Campanha cancelada",
          restart: "Campanha reiniciada",
          retryFailed: "Reenvio de falhas enfileirado",
          deleted: "Registro excluído",
        },
      },
      subscription: {
        title: "Assinatura",
        testPeriod: "Período de Teste",
        remainingTest: "Seu período de teste termina em",
        remainingTest2: "dias!",
        chargeEmail: "E-mail de cobrança",
        signNow: "Assinar agora!",
      },
      announcements: {
        active: "Ativo",
        inactive: "Inativo",
        title: "Informativos",
        searchPlaceholder: "Pesquisa",
        high: "Alta",
        medium: "Média",
        low: "Baixa",
        buttons: {
          add: "Novo Informativo",
          contactLists: "Listas de Informativos",
        },
        table: {
          priority: "Prioridade",
          title: "Title",
          text: "Texto",
          mediaName: "Arquivo",
          status: "Status",
          actions: "Ações",
        },
        dialog: {
          edit: "Edição de Informativo",
          add: "Novo Informativo",
          update: "Editar Informativo",
          readonly: "Apenas Visualização",
          form: {
            priority: "Prioridade",
            required: "Campo obrigatório",
            title: "Title",
            text: "Texto",
            mediaPath: "Arquivo",
            status: "Status",
          },
          buttons: {
            add: "Adicionar",
            edit: "Atualizar",
            okadd: "Ok",
            cancel: "Cancelar",
            close: "Fechar",
            attach: "Anexar Arquivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          success: "Operação realizada com sucesso",
          deleted: "Registro excluído",
          info: "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.",
        },
      },
      campaignsConfig: {
        title: "Configurações de Campanhas",
      },
      queues: {
        title: "Setores & Chatbot",
        searchPlaceholder: "Pesquisar setores...",
        table: {
          id: "ID",
          name: "Setor",
          color: "Cor",
          tickets: "Tickets",
          users: "Usuários",
          greeting: "Mensagem de saudação",
          actions: "Ações",
          orderQueue: "Ordem (bot)",
          createdAt: "Criado em",
        },
        buttons: {
          add: "Adicionar setor",
        },
        toasts: {
          success: "Setor excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Você tem certeza? Essa ação não pode ser revertida se o sistema permitir a exclusão.",
          deleteWarningInUse:
              "Este setor está vinculado a {{tickets}} ticket(s) e {{users}} usuário(s). Se a exclusão falhar, remova os vínculos (conexões, opções do bot e usuários do setor).",
        },
        empty: {
          title: "Nenhum setor encontrado",
          subtitle: "Ajuste a pesquisa ou adicione um novo setor.",
        },
      },
      queueSelect: {
        inputLabel: "Setores",
      },
      users: {
        title: "Usuários",
        searchPlaceholder: "Buscar por nome ou e-mail…",
        table: {
          id: "ID",
          name: "Nome",
          email: "Email",
          profile: "Perfil",
          queues: "Setores",
          online: "Status",
          tickets: "Tickets",
          createdAt: "Cadastro",
          actions: "Ações",
        },
        profileLabels: {
          admin: "Administrador",
          user: "Usuário",
          supervisor: "Supervisor",
        },
        online: {
          yes: "Online",
          no: "Offline",
        },
        empty: {
          title: "Nenhum usuário encontrado",
          subtitle: "Ajuste a pesquisa ou adicione um novo usuário.",
        },
        buttons: {
          add: "Adicionar usuário",
          edit: "Editar",
          delete: "Excluir",
        },
        toasts: {
          deleted: "Usuário excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Esta ação remove o usuário e os vínculos de setores. Não é possível excluir se houver tickets atribuídos — transfira antes.",
          deleteWarningTickets:
              "Este usuário possui {{count}} ticket(s) atribuído(s). A exclusão será bloqueada até transferir os atendimentos.",
        },
      },
      todolist: {
        pageTitle: "Lista pessoal (salva neste navegador)",
        pageSubtitle:
          "Anotações só neste aparelho — não sincronizam com o servidor nem com outros usuários.",
        notice:
          "Essas anotações são salvas apenas neste navegador e não são compartilhadas com a equipe.",
        emptyNoItems: "Nenhuma anotação ainda. Adicione uma acima.",
        emptyFilter: "Nenhuma anotação corresponde a este filtro.",
        storageParseError:
          "Não foi possível carregar suas anotações. Os dados inválidos foram removidos.",
        storageWriteError:
          "Não foi possível salvar (armazenamento do navegador cheio ou bloqueado).",
        input: "Nova anotação",
        completedAria: "Marcar como concluída",
        filter: {
          label: "Mostrar:",
          all: "Todas",
          pending: "Pendentes",
          completed: "Concluídas",
        },
        buttons: {
          add: "Adicionar",
          save: "Salvar",
          typeTask: "Digite uma anotação para adicionar",
        },
      },
      helps: {
        title: "Central de Ajuda",
      },
      evaluation: {
        title: "Avaliação",
        pageSubtitle:
          "Notas de 1 a 3 após o encerramento, enviadas pelo WhatsApp.",
        flowInfo:
          "Com a avaliação ativa, ao encerrar o atendimento o cliente recebe no WhatsApp um pedido de nota (1 a 3). O ticket só fecha no sistema depois de uma resposta válida.",
        scaleHint: "1 = insatisfeito · 2 = satisfeito · 3 = muito satisfeito",
        listHint:
          "Cada linha é uma resposta no WhatsApp; clique para abrir o atendimento.",
        dashboard: {
          cardTitle: "Avaliação média",
          scaleLine: "Escala 1–3 (WhatsApp)",
          statusPrefix: "Indicador:",
          status: {
            great: "Ótimo",
            good: "Bom",
            improve: "A melhorar",
          },
        },
        avgRating: "Avaliação Média",
        totalRatings: "Total de Avaliações",
        byAttendant: "Por Atendente",
        searchPlaceholder: "Buscar por contato ou atendente...",
        noRatings: "Nenhuma avaliação encontrada no período.",
        loadMore: "Carregar mais",
        dateFrom: "De",
        dateTo: "Até",
        table: {
          date: "Data",
          contact: "Contato",
          attendant: "Atendente",
          setor: "Setor",
          rating: "Nota",
          ratingSub: "1 a 3",
        },
      },
      evaluationModal: {
        title: "Criar Nova Avaliação",
        tabBasic: "Configuração Básica",
        tabOptions: "Opções de Avaliação",
        tabPreview: "Preview",
        basicInfo: "Informações Básicas",
        nameLabel: "Nome da Avaliação",
        namePlaceholder: "Nome da Avaliação",
        messageLabel: "Mensagem",
        messagePlaceholder: "Mensagem que será enviada para o cliente",
        optionsTitle: "Opções de Avaliação",
        optionName: "Nome da Opção",
        optionValue: "Valor",
        addOption: "Adicionar Opção",
        previewTitle: "Preview da Avaliação",
        hidePreview: "Ocultar Preview",
        showPreview: "Mostrar Preview",
        previewWhatsApp: "Preview - Mensagem WhatsApp",
        previewOptionsLabel: "Opções de Avaliação:",
        defaultMessage: "Mensagem da avaliação",
        cancel: "Cancelar",
        create: "Criar Avaliação",
        created: "Avaliação criada com sucesso",
        errors: {
          nameRequired: "Informe o nome da avaliação",
          optionsRequired: "Adicione pelo menos uma opção",
        },
      },
      schedules: {
        title: "Agendamentos",
        pageSubtitle: "{{count}} agendamento(s) carregado(s).",
        searchPlaceholder: "Buscar agendamentos…",
        typeSingle: "Único",
        typeRecurring: "Recorrente",
        paused: "Pausado",
        active: "Ativo",
        contactsCount: "{{count}} contato(s)",
        nextRun: "Próxima execução",
        companyTimezoneShort: "Fuso",
        frequencyShort: {
          daily: "Diária",
          weekly: "Semanal",
          monthly: "Mensal",
        },
        listIntro:
          "Lista dos agendamentos (único ou recorrente). Campanhas em massa ficam em Campanhas.",
        loading: "Carregando agendamentos…",
        empty: {
          title: "Ainda não há agendamentos",
          subtitle:
            "Agende envios únicos ou recorrentes para os contatos selecionados.",
        },
        statusLabels: {
          PENDENTE: "Pendente",
          AGENDADA: "Na fila",
          ENVIADA: "Enviada",
          ERRO: "Erro",
          AGUARDANDO_CONEXAO: "Aguardando conexão",
        },
        preferredShort: "Preferencial",
        confirmationModal: {
          deleteTitle: "Você tem certeza que quer excluir este Agendamento?",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        table: {
          contact: "Contato",
          type: "Tipo",
          recurrence: "Frequência",
          contacts: "Contatos",
          nextRun: "Próxima execução",
          body: "Mensagem",
          sendAt: "Data de Agendamento",
          sentAt: "Data de Envio",
          status: "Status",
          actions: "Ações",
        },
        messages: {
          date: "Data",
          time: "Hora",
          event: "Evento",
          allDay: "Dia Todo",
          week: "Semana",
          work_week: "Agendamentos",
          day: "Dia",
          month: "Mês",
          previous: "Anterior",
          next: "Próximo",
          yesterday: "Ontem",
          tomorrow: "Amanhã",
          today: "Hoje",
          agenda: "Agenda",
          noEventsInRange: "Não há agendamentos no período.",
          showMore: "mais",
        },
        buttons: {
          add: "Novo Agendamento",
          pause: "Pausar",
          resume: "Ativar",
          edit: "Editar agendamento",
          delete: "Excluir agendamento",
        },
        toasts: {
          deleted: "Agendamento excluído com sucesso.",
        },
      },
      tags: {
        title: "Tags",
        searchPlaceholder: "Pesquisar tags...",
        confirmationModal: {
          deleteTitle: "Excluir esta tag?",
          deleteMessage: "Esta ação não pode ser revertida.",
          deleteWarningInUse:
            "Esta tag está vinculada a {{count}} atendimento(s) (tickets). Campanhas também podem referenciar a tag. Se a exclusão falhar, remova os vínculos antes.",
          deleteAllMessage: "Tem certeza que deseja deletar todas as Tags?",
          deleteAllTitle: "Deletar Todos",
        },
        table: {
          name: "Tag",
          color: "Cor",
          usage: "Uso",
          tickets: "Uso (tickets)",
          createdAt: "Criada em",
          actions: "Ações",
        },
        buttons: {
          add: "Nova tag",
          deleteAll: "Deletar Todas",
        },
        toasts: {
          deletedAll: "Todas Tags excluídas com sucesso!",
          deleted: "Tag excluída com sucesso.",
        },
        empty: {
          title: "Nenhuma tag encontrada",
          subtitle: "Crie uma tag ou ajuste a pesquisa.",
        },
      },
      settings: {
        schedulesUpdated: "Horários atualizados com sucesso.",
        success: "Configurações salvas com sucesso.",
        pageSubtitle:
          "Opções e horários desta empresa (fuso, WhatsApp, expediente). Gestão global do sistema está em Plataforma.",
        customPageIntro:
          "Esta página aplica-se à empresa atual. Super Admins: empresas, planos, ajuda global e branding estão em Plataforma.",
        companiesRelocated:
          "A gestão de empresas foi movida para Plataforma → Empresas para concentrar o painel Super Admin num só sítio.",
        companiesRelocatedAction: "Abrir Plataforma → Empresas",
        plansRelocated:
          "A gestão do catálogo de planos foi centralizada em Plataforma → Planos para evitar duplicidade e manter o painel Super Admin organizado.",
        plansRelocatedAction: "Abrir Plataforma → Planos",
        helpsRelocated:
          "Os conteúdos de ajuda (tutoriais/links globais) passaram a ser geridos em Plataforma → Ajuda (conteúdos).",
        helpsRelocatedAction: "Abrir Plataforma → Ajuda",
        superPlatformCard: {
          title: "Gestão global da plataforma",
          body:
            "Empresas, planos, conteúdos de ajuda e informativos são geridos em Plataforma. Use os atalhos abaixo.",
        },
        title: "Configurações",
        tabs: {
          options: "Opções",
          schedules: "Horários",
          companies: "Empresas",
          plans: "Planos",
          helps: "Ajuda",
          notifications: "Notificações",
        },
        pushPreferences: {
          title: "Notificações push",
          intro:
            "Define o que queres receber via push (OneSignal) nesta empresa. Continua a ser necessária permissão de notificações no browser.",
          saved: "Preferências de notificação guardadas.",
          pushEnabled: "Ativar notificações push",
          notifyNewTickets: "Novas conversas em aguardamento",
          notifyAssignedTickets: "Tickets atribuídos a mim",
          notifyTicketMessages: "Mensagens de clientes",
          notifyTicketTransfers: "Transferências de setor / ticket",
          save: "Guardar",
          inAppTitle: "Central de notificações (dentro da app)",
          inAppIntro:
            "Controla alertas na central e no sino. Independente das notificações push do browser.",
          inAppEnabled: "Ativar notificações na central",
          inAppNewTickets: "Novos tickets (central)",
          inAppAssignedTickets: "Tickets atribuídos (central)",
          inAppTicketMessages: "Mensagens em tickets (central)",
          inAppTicketTransfers: "Transferências (central)",
          inAppAgenda: "Agenda e convites (central)",
          inAppBilling: "Alertas de cobrança da plataforma (super admin)",
          platformScopeIntro:
            "Estás a editar preferências globais da plataforma (sem empresa no contexto da sessão). Aplicam-se a alertas de cobrança e à central quando não há empresa no token.",
          tenantScopeIntro:
            "Preferências desta empresa (ID {{id}}), conforme o contexto atual da sessão. Altera ao mudar de empresa ou ao sair do modo plataforma.",
        },
        options: {
          pageIntro:
            "Estas opções alteram o comportamento do WhatsApp e dos fluxos para todos os atendimentos desta empresa.",
          expedientCompanyWarning:
            "Modo Empresa: o mesmo expediente vale para toda a empresa. No modo Fila, cada setor usa o seu.",
          toasts: {
            success: "Operação atualizada com sucesso.",
          },
          integrations: {
            asaasNotice:
              "O token de API concede acesso à sua conta Asaas. Guarde-o com segurança e reveja quem pode alterá-lo.",
          },
          fields: {
            ratings: {
              title: "Avaliações",
              disabled: "Desabilitadas",
              enabled: "Habilitadas",
            },
            expedientManager: {
              title: "Gerenciamento de Expediente",
              queue: "Fila",
              company: "Empresa",
            },
            ignoreMessages: {
              title: "Mensagens de grupos do WhatsApp",
              alertNotice:
                "Receber: conversas de grupo ficam na guia Grupos (manual, sem automações). Ignorar: mensagens de grupo não são registradas.",
              helperText:
                "Receber na guia Grupos: as mensagens criam ou atualizam conversas apenas na aba Grupos, em modo manual (sem chatbot e sem automações).\nIgnorar grupos: as mensagens de grupo não são registradas e não entram no sistema.",
              optionReceive: "Receber na guia Grupos (manual, sem automações)",
              optionIgnore: "Ignorar grupos (não entram no sistema)",
            },
            acceptCall: {
              title: "Aceitar chamada (WhatsApp)",
              alertNotice:
                "Aceitar: chamadas seguem o comportamento normal do WhatsApp. Não aceitar: o sistema rejeita e pode enviar a mensagem configurada abaixo.",
              helperText:
                "Sim: chamadas de voz/vídeo seguem o comportamento normal do WhatsApp; o sistema não interfere.\nNão: chamadas recebidas são rejeitadas automaticamente; você pode enviar uma mensagem ao cliente conforme as opções abaixo.",
              disabled: "Não aceitar",
              enabled: "Sim, aceitar",
              rejectSendTitle: "Enviar mensagem ao rejeitar chamada",
              rejectSendYes: "Sim",
              rejectSendNo: "Não",
              rejectMessageLabel: "Mensagem automática ao rejeitar chamada",
              rejectMessagePlaceholder:
                "Ex.: Este número não recebe chamadas. Envie uma mensagem de texto e responderemos por aqui.",
              rejectMessageHelper:
                "Deixe em branco para usar o texto padrão no idioma da empresa. A mensagem é salva ao sair do campo.",
            },
            chatbotType: {
              title: "Tipo Chatbot",
              text: "Texto",
            },
            sendGreetingAccepted: {
              title: "Enviar saudação ao aceitar o ticket",
            },
            sendMsgTransfTicket: {
              title: "Enviar mensagem de transferência de Setor/agente",
            },
            sendGreetingMessageOneQueues: {
              title: "Enviar saudação quando houver somente 1 setor",
            },
            disabled: "Desabilitado",
            active: "Ativo",
            enabled: "Habilitado",
          },
          updating: "Atualizando...",
          tabs: {
            integrations: "INTEGRAÇÕES",
          },
        },
        helps: {
          toasts: {
            errorList: "Não foi possível carregar a lista de registros",
            errorOperation: "Não foi possível realizar a operação",
            error:
                "Não foi possível realizar a operação. Verifique se já existe uma helpo com o mesmo nome ou se os campos foram preenchidos corretamente",
            success: "Operação realizada com sucesso!",
          },
          buttons: {
            clean: "Limpar",
            delete: "Excluir",
            save: "Salvar",
          },
          grid: {
            title: "Título",
            description: "Descrição",
            video: "Vídeo",
          },
          confirmModal: {
            title: "Exclusão de Registro",
            confirm: "Deseja realmente excluir esse registro?",
          },
        },
        company: {
          toasts: {
            errorList: "Não foi possível carregar a lista de registros",
            errorOperation: "Não foi possível realizar a operação",
            error:
                "Não foi possível realizar a operação. Verifique se já existe uma empresa com o mesmo nome ou se os campos foram preenchidos corretamente",
            success: "Operação realizada com sucesso!",
          },
          confirmModal: {
            title: "Exclusão de Registro",
            confirm: "Deseja realmente excluir esse registro?",
          },
          form: {
            name: "Nome",
            primaryAdmin: "Admin principal",
            noPrimaryAdmin: "Sem admin definido",
            email: "E-mail",
            emailMain: "E-mail principal",
            phone: "Telefone",
            sectionCompanyData: "Dados da empresa",
            sectionCompanyDataHint:
              "Dados principais de identificação e contato — incluindo o administrador principal associado a esta empresa.",
            sectionPlanOperation: "Plano e operação",
            sectionPlanOperationHint:
              "Definições contratuais e operacionais: plano, estado da conta, fuso horário e ciclo de vencimento.",
            editingBanner: "Editando: {{name}}",
            editingContextHint:
              "As alterações no formulário aplicam-se apenas a esta empresa.",
            plan: "Plano",
            status: "Status",
            yes: "Sim",
            no: "Não",
            campanhas: "Campanhas",
            enabled: "Habilitadas",
            disabled: "Desabilitadas",
            dueDate: "Data de vencimento",
            recurrence: "Recorrência",
            monthly: "Mensal",
            expire: "Vencimento",
            createdAt: "Criada Em",
            timezone: "Fuso horário da empresa",
            timezoneHint:
              "Agendamentos e recorrências usam este fuso; o armazenamento no servidor continua em UTC.",
            timezoneFooter:
              "Escolha o fuso da sede ou da operação principal.",
            timezoneHelperField:
              "Formato IANA, como na lista abaixo (ex.: America/Sao_Paulo).",
            usersSectionTitle: "Utilizadores da empresa",
            usersSectionHint:
              "Lista informativa dos utilizadores vinculados a esta empresa (sem gestão aqui).",
            usersEmpty: "Nenhum utilizador encontrado nesta empresa.",
            modulesSectionTitle: "Módulos liberados (empresa)",
            modulesSectionHint:
              "Complementa o plano: desligar aqui oculta o módulo e bloqueia o uso, quando o plano permitir o recurso.",
            modulesSectionHintV2:
              "Cada interruptor corresponde a funcionalidades do plano (PlanFeatures). O que o plano não inclui fica desligado e bloqueado — igual ao backend. Chatbot, OpenAI, campanhas, API e grupos são avaliados de forma independente. O calendário da agenda (compromissos) depende só do plano, não deste formulário.",
            contractedPlanSection: "Valor contratado",
            contractedPlanHint:
              "Deixe em branco para usar o valor padrão do plano. Pode usar desconto ou acréscimo em relação ao catálogo.",
            contractedPlanLabel: "Valor contratado personalizado (mensal)",
            contractedPlanBaseline: "Valor padrão do plano: {{value}}",
            contractedPlanNoPlanSelected: "Selecione um plano para comparar com o catálogo.",
            contractedPlanEffective: "Valor efetivo: {{value}}",
            contractedPlanDiscountLabel: "Desconto face ao plano: {{value}}",
            contractedPlanSurchargeLabel: "Acréscimo face ao plano: {{value}}",
            contractedPlanClear: "Limpar valor personalizado",
            contractedPlanValueInvalid: "Valor contratado inválido. Utilize o formato moeda (ex.: 150,00).",
            modules: {
              useKanban: "Kanban",
              useKanbanHelp: "Quadro kanban (feature attendance.kanban).",
              useCampaigns: "Campanhas",
              useCampaignsHelp: "Disparos e listas (campaigns.sends / campaigns.lists). Independentes do chatbot.",
              useFlowbuilders: "Fluxos (chatbot)",
              useFlowbuildersHelp: "Flowbuilder (automation.chatbot). Não exige campanhas no plano.",
              useOpenAi: "OpenAI / Prompts",
              useOpenAiHelp: "Prompts (automation.openai). Independente do chatbot.",
              useSchedules: "Agendamentos de envio",
              useSchedulesHelp: "Horários de envio / schedules (agenda.appointments e attendance.schedules). O calendário de compromissos é agenda.calendar no plano.",
              useExternalApi: "API WhatsApp (envio externo)",
              useExternalApiHelp: "Token HTTP (settings.api).",
              useIntegrations: "Integrações por setor",
              useIntegrationsHelp: "Integrações de fila (automation.integrations).",
              useGroups: "Grupos WhatsApp",
              useGroupsHelp: "Grupos no atendimento (team.groups); o plano pode desactivar.",
            },
          },
          buttons: {
            clear: "Limpar",
            delete: "Excluir",
            expire: "+ Vencimento",
            user: "Usuário",
            manageUsers: "Gerir utilizadores",
            adjustDueDate: "Ajustar vencimento",
            save: "Salvar",
            saveTimezone: "Salvar fuso horário",
          },
        },
        schedules: {
          form: {
            weekday: "Dia da Semana",
            initialHour: "Hora Inicial",
            finalHour: "Hora Final",
            save: "Salvar",
          },
        },
        settings: {
          userCreation: {
            name: "Criação de usuário",
            options: {
              enabled: "Ativado",
              disabled: "Desativado",
            },
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Atribuído à:",
          buttons: {
            return: "Retornar",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceitar",
            download: "Baixar",
            flowHistory: "Histórico de fluxo",
            quickReplies: "Respostas rápidas",
          },
        },
        lostCall: "Chamada de voz/vídeo perdida às",
        deletedMessage: "Essa mensagem foi apagada pelo contato",
        edited: "Editada",
        saudation: "Diga olá para seu novo contato!",
      },
      messagesInput: {
        placeholderOpen: "Digite uma mensagem",
        placeholderClosed:
            "Reabra ou aceite esse ticket para enviar uma mensagem.",
        signMessage: "Assinar",
        sticker: "Enviar figurinha (WebP)",
        stickerOnlyWebp: "Figurinha deve ser um arquivo .webp",
        audioRecorder: {
          generic:
            "Não foi possível acessar ou iniciar o microfone. Verifique as permissões do navegador e tente novamente.",
          permissionDenied:
            "O microfone foi bloqueado. No ícone de cadeado ou de permissões do site, permita o microfone e tente de novo.",
          noDevice:
            "Nenhum microfone foi encontrado. Ligue um microfone ou selecione um dispositivo de entrada e tente novamente.",
          deviceInUse:
            "O microfone está em uso por outro programa. Feche a outra aplicação e tente de novo.",
          notSupported:
            "Seu navegador não suporta gravação de áudio. Atualize o navegador ou use Chrome, Edge ou Firefox recente.",
          formatNotSupported:
            "Seu navegador não suporta gravação de áudio neste formato. Tente atualizar o navegador ou usar Chrome/Edge atualizado.",
          constraints:
            "Não foi possível usar o microfone com as definições pedidas. Tente outro dispositivo ou as permissões do site.",
          invalidState:
            "Estado da gravação inválido. Cancele e tente de novo.",
          recorderStartFailed:
            "Não foi possível iniciar a gravação. Tente novamente.",
          blobOrUploadFailed:
            "Falha ao processar ou enviar o áudio. Tente novamente.",
        },
      },
      contactDrawer: {
        header: "Dados do contato",
        hiddenNumber: "Número oculto (privacidade WhatsApp)",
        buttons: {
          edit: "Editar contato",
        },
        extraInfo: "Outras informações",
      },
      fileModal: {
        title: {
          add: "Adicionar lista de arquivos",
          edit: "Editar lista de arquivos",
        },
        buttons: {
          okAdd: "Salvar",
          okEdit: "Editar",
          cancel: "Cancelar",
          fileOptions: "Adicionar arquivo",
        },
        form: {
          name: "Nome da lista de arquivos",
          message: "Detalhes da lista",
          fileOptions: "Lista de arquivos",
          extraName: "Mensagem para enviar com arquivo",
          extraValue: "Valor da opção",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
          },
          message: {
            required: "Mensagem é obrigatória",
          },
        },
        success: "Lista de arquivos salva com sucesso!",
      },
      ticketOptionsMenu: {
        schedule: "Agendamento",
        delete: "Deletar",
        transfer: "Transferir",
        registerAppointment: "Observações do Contato",
        appointmentsModal: {
          title: "Observações do Contato",
          textarea: "Observação",
          placeholder: "Insira aqui a informação que deseja registrar",
        },
        confirmationModal: {
          title: "Deletar o ticket",
          titleFrom: "do contato ",
          message:
              "Atenção! Todas as mensagens relacionadas ao ticket serão perdidas.",
        },
        buttons: {
          delete: "Excluir",
          cancel: "Cancelar",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancelar",
        },
      },
      messageOptionsMenu: {
        delete: "Deletar",
        reply: "Responder",
        confirmationModal: {
          title: "Apagar mensagem?",
          message: "Esta ação não pode ser revertida.",
        },
      },
      flowBuilderSimulator: {
        openFab: "Testar fluxo",
        title: "Simulação do fluxo",
        subtitle: "Sem envio real ao WhatsApp · Preview local",
        badgeSimulation: "Preview",
        currentStep: "Passo atual",
        noStepYet: "Percorra o fluxo para ver o passo atual.",
        placeholder: "Digite uma mensagem…",
        send: "Enviar",
        restart: "Reiniciar",
        restartFull: "Reiniciar simulação",
        close: "Fechar",
        yes: "Sim",
        no: "Não",
        noStart:
          "Não há bloco Início no fluxo. Adicione o nó Início para simular.",
        noEdgeFromStart: "Conecte uma saída ao bloco Início.",
        ended: "— Fim da simulação —",
        noWaitHint:
          "Fora dos pontos em que o fluxo pede mensagem, use Reiniciar para um novo teste.",
        menuPlaceholder:
          "Opção (número) ou texto inválido para testar o ramo vermelho…",
        simulatedActionBadge: "Ação simulada",
        notExecutedPreview: "Não executado no preview · sem chamadas externas",
        actionHttp: "Pedido HTTP",
        actionOpenai: "OpenAI",
        actionTypebot: "Typebot",
        actionAdmin: "Ação administrativa ({{type}})",
        actionGeneric: "Passo do tipo “{{type}}”",
        conditionManualTitle: "Escolha manual necessária",
        conditionManual: {
          variableOrTicket:
            "Esta condição usa variável ou dados de ticket, indisponíveis no preview. Indique se o resultado seria verdadeiro ou falso.",
          unknownField:
            "Este campo de contexto ou contato não está disponível no simulador. Indique o caminho (sim / não) como se a regra falhasse ou não.",
        },
        singleBlockEmpty: "Bloco de conteúdo vazio — adicione itens no editor do fluxo.",
        nodeType: {
          message: "Mensagem",
          menu: "Menu",
          condition: "Condição",
          singleBlock: "Conteúdo (bloco)",
          question: "Pergunta",
          waitForInteraction: "Aguardar interação",
          interval: "Intervalo",
          img: "Imagem",
          audio: "Áudio",
          video: "Vídeo",
          randomizer: "Randomizador",
          start: "Início",
          httpRequest: "HTTP",
          ticket: "Ticket",
          sector: "Setor",
          tag: "Tag",
          closeTicket: "Encerrar ticket",
          attendant: "Atendente",
          notification: "Notificação",
          blacklist: "Blacklist",
          flowUp: "Fluxo superior",
          openai: "OpenAI",
          typebot: "Typebot",
        },
      },
      flowBuilderMenu: {
        createHint:
          "Depois de adicionar o nó, ligue a saída vermelha (opção inválida) e, se usar tempo de espera, a laranja (sem resposta), para evitar conversas presas no bot.",
        warningsHeader: "Avisos (não bloqueiam salvar)",
        warnings: {
          missing_invalid: {
            short: "Sem ramo inválido",
            detail:
              "A saída vermelha «Opção inválida» não está ligada. Se o cliente responder fora do menu, o fluxo pode parar sem encaminhar.",
          },
          timeout_no_edge: {
            short: "Timeout sem saída",
            detail:
              "Definiu tempo de espera (> 0 s) mas a saída laranja «Sem resposta» não está ligada. O timeout não terá para onde seguir.",
          },
          timeout_edge_no_time: {
            short: "Saída timeout sem tempo",
            detail:
              "A saída laranja «Sem resposta» está ligada, mas o tempo está em 0. Defina os segundos ou desligue a aresta para evitar configuração incoerente.",
          },
          no_option_edges: {
            short: "Opções sem ligação",
            detail:
              "Há opções no menu, mas nenhuma saída numerada (azul) está ligada. O cliente não conseguirá avançar por nenhuma escolha válida.",
          },
        },
      },
      errors: {
        connectionError: "Não foi possível conectar ao servidor. Verifique a URL do backend e se o servidor está online.",
        generic: "Ocorreu um erro. Tente novamente.",
        operationFailed: "Não foi possível concluir a operação. Tente novamente.",
      },
      backendErrors: {
        ERR_INTERNAL_SERVER_ERROR:
            "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde",
        ERR_NO_OTHER_WHATSAPP: "Deve haver pelo menos um WhatsApp padrão.",
        ERR_NO_DEF_WAPP_FOUND:
            "Nenhum WhatsApp padrão encontrado. Verifique a página de conexões.",
        ERR_WAPP_NOT_INITIALIZED:
            "Esta sessão do WhatsApp não foi inicializada. Verifique a página de conexões.",
        ERR_WAPP_CHECK_CONTACT:
            "Não foi possível verificar o contato do WhatsApp. Verifique a página de conexões",
        ERR_WAPP_INVALID_CONTACT: "Este não é um número de Whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA:
            "Não foi possível baixar mídia do WhatsApp. Verifique a página de conexões.",
        ERR_INVALID_CREDENTIALS:
            "Erro de autenticação. Por favor, tente novamente.",
        ERR_USER_DONT_EXISTS:
            "Usuário não encontrado. Verifique o e-mail informado.",
        ERR_SENDING_WAPP_MSG:
            "Erro ao enviar mensagem do WhatsApp. Verifique a página de conexões.",
        ERR_DELETE_WAPP_MSG: "Não foi possível excluir a mensagem do WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Já existe um tíquete aberto para este contato.",
        ERR_SESSION_EXPIRED: "Sessão expirada. Por favor entre.",
        ERR_USER_CREATION_DISABLED:
            "A criação do usuário foi desabilitada pelo administrador.",
        ERR_NO_PERMISSION: "Você não tem permissão para acessar este recurso.",
        ERR_MODULE_NOT_ALLOWED:
          "Este módulo não está liberado para a sua empresa (plano ou configuração da plataforma).",
        ERR_PLAN_FEATURE_DISABLED:
          "Este recurso não está disponível no seu plano.",
        ERR_DUPLICATED_CONTACT: "Já existe um contato com este número.",
        ERR_NO_SETTING_FOUND: "Nenhuma configuração encontrada com este ID.",
        ERR_NO_CONTACT_FOUND: "Nenhum contato encontrado com este ID.",
        ERR_NO_TICKET_FOUND: "Nenhum tíquete encontrado com este ID.",
        ERR_NO_USER_FOUND: "Nenhum usuário encontrado com este ID.",
        ERR_NO_WAPP_FOUND: "Nenhum WhatsApp encontrado com este ID.",
        ERR_CREATING_MESSAGE: "Erro ao criar mensagem no banco de dados.",
        ERR_CREATING_TICKET: "Erro ao criar tíquete no banco de dados.",
        ERR_FETCH_WAPP_MSG:
            "Erro ao buscar a mensagem no WhtasApp, talvez ela seja muito antiga.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
            "Esta cor já está em uso, escolha outra.",
        ERR_QUEUE_DUPLICATE_NAME:
            "Já existe um setor com este nome nesta empresa.",
        ERR_QUEUE_DUPLICATE:
            "Este setor já existe ou conflita com outro registo na empresa.",
        ERR_WAPP_GREETING_REQUIRED:
            "A mensagem de saudação é obrigatória quando há mais de um setor.",
        ERR_CAMPAIGN_NOT_FOUND: "Campanha não encontrada.",
        ERR_CAMPAIGN_INVALID_STATUS:
            "Esta operação não é permitida para o status atual da campanha.",
        ERR_CAMPAIGN_EMPTY_LIST: "Selecione uma lista de contatos ou uma tag.",
        ERR_CAMPAIGN_NO_VALID_CONTACTS:
            "Não há contatos válidos para envio nesta lista.",
        ERR_CAMPAIGN_TAG_REQUIRED: "Informe uma tag para estimativa.",
        ERR_CAMPAIGN_NO_FAILED_TO_RETRY:
            "Não há envios com falha para reenviar nesta campanha.",
        ERR_INVALID_API_TOKEN:
            "Token da API inválido ou ausente. Verifique o cabeçalho Authorization: Bearer.",
        ERR_EXTERNAL_API_NOT_ALLOWED:
            "O plano da empresa não permite uso da API externa. Atualize o plano ou contate o suporte.",
        ERR_RATE_LIMIT_EXCEEDED:
            "Limite de requisições por minuto excedido. Aguarde e tente novamente.",
        ERR_MESSAGE_SEND_FAILED:
            "Não foi possível concluir o envio da mensagem.",
        ERR_INVOICE_NOT_FOUND: "Fatura não encontrada.",
        ERR_FORBIDDEN_INVOICE: "Esta fatura não pertence à sua empresa.",
        ERR_INVOICE_ALREADY_PAID: "Esta fatura já está paga.",
        ERR_SUBSCRIPTION_VALIDATION: "Dados inválidos para gerar o PIX. Verifique e tente novamente.",
        ERR_SUBSCRIPTION_PIX_CREATE:
            "Não foi possível gerar a cobrança PIX. Tente novamente ou contate o suporte.",
        ERR_SUBSCRIPTION_WEBHOOK_CONFIG_VALIDATION: "Dados inválidos para configurar webhook.",
        ERR_WEBHOOK_UNAUTHORIZED: "Webhook não autorizado (token inválido).",
        ERR_COMPANY_DELINQUENT:
            "Pagamento em atraso: esta ação está suspensa até regularizar em Financeiro (PIX).",
        ERR_NO_COMPANY_FOUND: "Empresa não encontrada.",
        ERR_CANNOT_BLOCK_OWN_COMPANY:
            "Não é possível bloquear a empresa em que está autenticado.",
        ERR_CANNOT_DELETE_OWN_COMPANY:
            "Não é possível excluir a empresa em que está autenticado.",
        ERR_CANNOT_DELETE_COMPANY_WITH_SUPER:
            "Não é possível excluir uma empresa que tenha um utilizador super administrador. Reatribua ou remova esses utilizadores primeiro.",
        ERR_INVALID_RECURRENCE:
            "Recorrência inválida ou em falta. Defina MENSAL, BIMESTRAL, TRIMESTRAL, SEMESTRAL ou ANUAL na empresa.",
        ERR_LAST_SUPER_ADMIN:
            "Não é possível remover o último super administrador da plataforma. Promova outro utilizador primeiro.",
        ERR_EMAIL_IN_USE: "Este e-mail já está em uso por outra conta.",
        FAVICON_TOO_LARGE: "Favicon: tamanho máximo 1 MB.",
        INVALID_FAVICON_TYPE: "Favicon: use PNG, JPG, ICO ou SVG.",
        ERR_RESET_INVALID: "Código inválido ou e-mail incorreto. Verifique os dados ou solicite um novo e-mail.",
        ERR_RESET_EXPIRED: "Código expirado. Solicite nova recuperação de senha.",
        ERR_PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 8 caracteres.",
        ERR_PASSWORD_TOO_LONG: "Senha muito longa.",
        ERR_PASSWORD_POLICY:
            "A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, letra minúscula e número.",
        ERR_PASSWORD_REQUIRED: "Senha é obrigatória.",
        ERR_INVALID_PASSWORD: "Senha inválida. Verifique os requisitos.",
        ERR_SIGNUP_PENDING_EXISTS:
          "Já existe um pedido pendente para este e-mail. Aguarde a análise ou contacte o suporte.",
        ERR_SIGNUP_REQUEST_NOT_FOUND: "Pedido de cadastro não encontrado.",
        ERR_MAIL_NOT_CONFIGURED:
          "Envio de e-mail não configurado. Configure SMTP em Gestão SaaS → E-mail / SMTP ou variáveis MAIL_*.",
        ERR_SMTP_NOT_CONFIGURED:
          "SMTP não configurado ou incompleto. Preencha os campos, ative o SMTP ou defina MAIL_* no servidor.",
        ERR_SMTP_INVALID_PORT: "Porta SMTP inválida.",
        ERR_SMTP_INVALID_TEST_EMAIL: "Endereço de e-mail de teste inválido.",
        ERR_SIGNUP_INVITE_RESEND_NOT_ALLOWED:
          "Não é possível reenviar o convite neste estado do pedido (já ativado, pendente ou rejeitado).",
        ERR_SIGNUP_PRIMARY_ADMIN_NOT_FOUND:
          "Utilizador administrador do pedido não encontrado na empresa criada.",
        ERR_SIGNUP_INVITE_EMAIL_FAILED:
          "Falha ao enviar o e-mail de convite. Verifique o serviço de correio e tente novamente.",
        ERR_SIGNUP_REQUEST_NOT_PENDING: "Este pedido já foi tratado.",
        ERR_SIGNUP_COMPANY_NAME_REQUIRED: "Indique o nome da empresa (mínimo 2 caracteres).",
        ERR_COMPANY_EMAIL_REQUIRED: "A empresa precisa de um e-mail para criar o administrador.",
        ERR_EMAIL_ALREADY_IN_USE:
          "Este e-mail já está associado a outro utilizador. Utilize outro e-mail principal ou reutilize o utilizador existente.",
        ERR_INVALID_ID: "Identificador inválido.",
        ERR_INVALID_PLAN: "Plano inválido ou inexistente.",
        ERR_INVALID_BODY: "Dados inválidos. Verifique e tente novamente.",
        ERR_TICKET_NOT_ORPHAN:
          "Este atendimento já tem vínculo ativo. A reatribuição só é permitida em tickets órfãos.",
        ERR_WAPP_NOT_CONNECTED:
          "A conexão escolhida não está conectada. Selecione uma sessão ativa.",
      },
    },
  },
};

export { messages };
