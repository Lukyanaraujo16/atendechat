const messages = {
  pt: {
    translations: {
      selectLanguage: "Selecione um idioma",
      signup: {
        title: "Cadastre-se",
        toasts: {
          success: "Usuário criado com sucesso! Faça seu login!!!.",
          fail: "Erro ao criar usuário. Verifique os dados informados.",
        },
        form: {
          name: "Nome da empresa",
          email: "Email",
          phone: "Telefone com (DDD)",
          plan: "Plano",
          password: "Senha",
        },
        formErrors: {
          name: {
            required: "Nome da empresa é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          password: {
            short: "Senha muito curta",
            long: "Senha muito longa",
          },
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
        },
        buttons: {
          submit: "Cadastrar",
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
      },
      resetPassword: {
        title: "Redefinir Senha",
        toasts: {
          emailSent: "Email enviado com sucesso!",
          emailNotFound: "Email não encontrado!",
          passwordUpdated: "Senha atualizada com sucesso!",
        },
        formErrors: {
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
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
          submitEmail: "Enviar email",
          submitPassword: "Redefinir senha",
          back: "Não tem uma conta? Cadastre-se!",
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
          assign: "Atribuir atendente",
          unassign: "Remover atendente",
          changeQueue: "Alterar setor",
          tags: "Tags",
          close: "Fechar ticket",
          selectUser: "Atendente",
          selectQueue: "Setor",
          tagsPlaceholder: "Selecione as tags",
          confirmClose:
            "Fechar este ticket? O atendimento será encerrado conforme as regras já configuradas (mensagens automáticas, pesquisa, etc.).",
          cancel: "Cancelar",
          save: "Salvar",
        },
      },
      invoices: {
        title: "Faturas",
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
            "Identificamos pendência financeira. O valor cobrado no PIX é sempre o da fatura abaixo.",
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
          "Para pagar com PIX, abra Financeiro e clique em Pagar na fatura desejada.",
        pixFlowTitle: "Pagamento de fatura — PIX",
        pixFlowSubtitle:
          "O valor debitado é sempre o da fatura selecionada. O backend gera a cobrança PIX; não utilize valores do plano como referência de pagamento.",
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
            "Este valor é o registrado na fatura. Ele será enviado ao gateway — não altere expectativas com base no preço do plano abaixo.",
          totalLabel: "Total PIX",
          waitingHint:
            "Aguardando pagamento. Cobrança expira em até {{minutes}} min (aprox.).",
          expiredHint:
            "O tempo desta cobrança PIX pode ter expirado. Feche e abra novamente em Financeiro para gerar outra.",
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
            "Confira o valor da fatura e o plano contratado. Ao continuar, será gerada uma cobrança imediata via PIX.",
          pixSectionTitle: "Cobrança (fatura)",
          planSectionTitle: "Plano de referência",
          planReferenceOnly:
            "Limites do plano são informativos. O valor efetivo cobrado é o da fatura acima.",
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
          step3: "No celular: WhatsApp → Menu (⋮) ou Configurações → Dispositivos conectados → Conectar dispositivo.",
          step4: "Aponte a câmera para o QR Code na tela. Quando conectar, o status ficará verde \"Conectado\".",
        },
        statusLabel: {
          CONNECTED: "Conectado",
          qrcode: "Aguardando QR",
          OPENING: "Conectando...",
          DISCONNECTED: "Desconectado",
          TIMEOUT: "Sem conexão",
          PAIRING: "Emparelhando",
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
          "Centralize quem conversa com a sua empresa. As tags exibidas refletem os atendimentos (tickets) já associados a cada contato.",
        pageExpectations:
          "Este módulo foca-se em atendimento e histórico — não é um funil de vendas nem um pipeline comercial completo. É a base para organizar conversas e pode evoluir no futuro.",
        tagsColumnHint:
          "Tags mostradas a partir dos atendimentos (tickets) deste contato.",
        tagFilterHelp:
          "Filtra contatos que tenham pelo menos um ticket com a tag escolhida.",
        searchHelper: "Pesquise por nome, número, email ou notas.",
        openAttendance: "Abrir atendimento",
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
          "Atendimento e histórico — não é funil de vendas nem pipeline. Ideal para acompanhar conversas.",
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
          passwordCreate: "Use uma senha com pelo menos 5 caracteres.",
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
        page: {
          title: "Chat interno",
          searchPlaceholder: "Buscar conversas...",
          loadingMessages: "Carregando mensagens...",
          loadingConversations: "Carregando conversas...",
          messagePlaceholder: "Digite sua mensagem...",
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
        noTicketMessage: "Selecione um ticket para começar a conversar.",
        buttons: {
          close: "Fechar",
          save: "Salvar",
          new: "Nova",
          newChat: "Novo",
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
          placeholder: "Buscar atendimento e mensagens",
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
          connections: "Conexões",
          tickets: "Atendimentos",
          quickMessages: "Respostas rápidas",
          tasks: "Tarefas",
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
        flowInfo:
          "Quando a avaliação está ativa nas configurações, ao encerrar o atendimento o cliente recebe no WhatsApp um pedido de nota (escala 1 a 3). O ticket só é finalizado no sistema depois que o cliente responde com 1, 2 ou 3. Respostas inválidas são ignoradas até vir uma nota válida.",
        scaleHint: "Escala: 1 — Insatisfeito · 2 — Satisfeito · 3 — Muito satisfeito",
        listHint: "Cada linha é uma resposta registrada; a nota reflete a opção escolhida pelo cliente no WhatsApp.",
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
        title: "Configurações",
        tabs: {
          options: "Opções",
          schedules: "Horários",
          companies: "Empresas",
          plans: "Planos",
          helps: "Ajuda",
        },
        options: {
          toasts: {
            success: "Operação atualizada com sucesso.",
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
              helperText:
                "Receber na guia Grupos: as mensagens criam ou atualizam conversas apenas na aba Grupos, em modo manual (sem chatbot e sem automações).\nIgnorar grupos: as mensagens de grupo não são registradas e não entram no sistema.",
              optionReceive: "Receber na guia Grupos (manual, sem automações)",
              optionIgnore: "Ignorar grupos (não entram no sistema)",
            },
            acceptCall: {
              title: "Aceitar chamada (WhatsApp)",
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
            email: "E-mail",
            phone: "Telefone",
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
              "Usado para calcular horários de agendamentos e recorrências. Dados no servidor permanecem em UTC.",
            timezoneFooter: "Lista IANA (ex.: America/Sao_Paulo).",
          },
          buttons: {
            clear: "Limpar",
            delete: "Excluir",
            expire: "+ Vencimento",
            user: "Usuário",
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
      errors: {
        connectionError: "Não foi possível conectar ao servidor. Verifique a URL do backend e se o servidor está online.",
        generic: "Ocorreu um erro. Tente novamente.",
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
      },
    },
  },
};

export { messages };
