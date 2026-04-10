const messages = {
  es: {
    translations: {
      selectLanguage: "Seleccione un idioma",
      signup: {
        title: "Regístrate",
        toasts: {
          success: "¡Usuario creado con éxito! ¡Inicia sesión!!!",
          fail: "Error al crear usuario. Verifica los datos ingresados.",
        },
        form: {
          name: "Nombre de la empresa",
          email: "Correo electrónico",
          phone: "Teléfono con (código de área)",
          plan: "Plan",
          password: "Contraseña",
        },
        formErrors: {
          name: {
            required: "El nombre de la empresa es obligatorio",
            short: "Nombre demasiado corto",
            long: "Nombre demasiado largo",
          },
          password: {
            short: "Contraseña demasiado corta",
            long: "Contraseña demasiado larga",
          },
          email: {
            required: "El correo electrónico es obligatorio",
            invalid: "Correo electrónico inválido",
          },
        },
        buttons: {
          submit: "Registrar",
          login: "¿Ya tienes una cuenta? ¡Inicia sesión!",
        },
        plan: {
          attendant: "Asistente",
          whatsapp: "WhatsApp",
          queues: "Colas",
        },
      },
      login: {
        title: "Iniciar sesión",
        form: {
          email: "Correo electrónico",
          password: "Contraseña",
        },
        buttons: {
          submit: "Entrar",
          register: "¡Regístrate ahora mismo!",
        },
      },
      resetPassword: {
        title: "Restablecer Contraseña",
        toasts: {
          emailSent: "¡Correo enviado con éxito!",
          emailNotFound: "¡Correo electrónico no encontrado!",
          passwordUpdated: "¡Contraseña actualizada con éxito!",
        },
        formErrors: {
          email: {
            required: "El correo electrónico es obligatorio",
            invalid: "Correo electrónico inválido",
          },
          newPassword: {
            required: "La nueva contraseña es obligatoria",
            matches:
                "Tu contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una minúscula y un número.",
          },
          confirmPassword: {
            required: "La confirmación de contraseña es obligatoria",
            matches: "Las contraseñas no coinciden",
          },
        },
        form: {
          email: "Correo electrónico",
          verificationCode: "Código de verificación",
          newPassword: "Nueva contraseña",
          confirmPassword: "Confirmar nueva contraseña",
        },
        buttons: {
          submitEmail: "Enviar correo",
          submitPassword: "Restablecer contraseña",
          back: "¿No tienes una cuenta? ¡Regístrate!",
        },
      },
      dashboard: {
        title: "Dashboard",
        subtitle: "Visión general de atenciones e indicadores",
        header: {
          filters: "Filtros",
          createReport: "Crear Informe (BETA)",
        },
        cards: {
          totalAttendances: "Total de Atenciones",
          inAttendance: "En Atención",
          resolutionRate: "Tasa de Resolución",
          ofTotal: "Del Total",
          statusWaiting: "Estado: Esperando Atención",
          avgFirstResponse: "Tiempo Medio 1ª Respuesta",
          inMinutes: "En Minutos",
          status: "Estado",
          totalMessages: "Total de Mensajes",
          sent: "Enviadas",
          received: "Recibidas",
        },
        toasts: {
          selectFilterError: "Parametrice el filtro",
              userChartError: "Error al obtener información de la conversación",
              dateChartError: "Error al obtener información de la conversación",
        },
        filters: {
          initialDate: "Fecha Inicial",
              finalDate: "Fecha Final",
              filterType: {
            title: "Tipo de Filtro",
                options: {
              perDate: "Filtro por Fecha",
                  perPeriod: "Filtro por Período",
            },
            helper: "Seleccione el tipo de filtro deseado",
          },
        },
        periodSelect: {
          title: "Período",
              options: {
            none: "Ninguno seleccionado",
                last3: "Últimos 3 días",
                last7: "Últimos 7 días",
                last15: "Últimos 15 días",
                last30: "Últimos 30 días",
                last60: "Últimos 60 días",
                last90: "Últimos 90 días",
          },
          helper: "Seleccione el período deseado",
        },
        counters: {
          inTalk: "En conversación",
              waiting: "En espera",
              finished: "Finalizados",
              newContacts: "Nuevos contactos",
              averageTalkTime: "T.M. de Conversación",
              averageWaitTime: "T.M. de Espera",
        },
        buttons: {
          filter: "Filtrar",
        },
        onlineTable: {
          title: "Estado de los atendentes",
          ratingLabel: "1 - Insatisfecho, 2 - Satisfecho, 3 - Muy Satisfecho",
              name: "Nombre",
              ratings: "Evaluaciones",
              avgSupportTime: "T.M. de Atención",
              status: "Estado (Actual)",
        },
        charts: {
          user: {
            label: "Gráfico de Conversaciones",
                title: "Total de Conversaciones por Usuarios",
                start: "Inicio",
                end: "Fin",
                filter: "Filtrar",
                tickets: "atenciones",
          },
          date: {
            label: "Gráfico de Conversaciones",
                title: "Total",
                start: "Inicio",
                end: "Fin",
                filter: "Filtrar",
                tickets: "atenciones",
          },
        },
      },
      plans: {
        toasts: {
          errorList: "No fue posible cargar la lista de registros",
          errorOperation: "No fue posible realizar la operación",
          error: "No fue posible realizar la operación. Verifique si ya existe un plan con el mismo nombre o si los campos fueron completados correctamente",
          success: "¡Operación realizada con éxito!",
        },
        confirm: {
          title: "Eliminación de Registro",
          message: "¿Realmente desea eliminar el registro?",
        },
        form: {
          name: "Nombre",
          users: "Usuarios",
          connections: "Conexiones",
          queues: "Colas",
          value: "Valor",
          internalChat: "Chat Interno",
          externalApi: "API Externa",
          kanban: "Kanban",
          integrations: "Integraciones",
          campaigns: "Campañas",
          schedules: "Programaciones",
          enabled: "Habilitadas",
          disabled: "Deshabilitadas",
          clear: "Cancelar",
          delete: "Eliminar",
          save: "Guardar",
          yes: "Sí",
          no: "No",
          money: "$",
        },
      },
      kanban: {
        toasts: {
          removed: "¡Etiqueta de Ticket Eliminada!",
          added: "¡Etiqueta de Ticket Agregada con Éxito!",
        },
        open: "Abierto",
        seeTicket: "Ver Ticket",
        column: {
          pending: "En espera",
          open: "En atención",
          closed: "Finalizado",
        },
        lastInteraction: "Última actividad",
        queue: "Sector",
        attendant: "Agente",
        unread: "No leídos",
        emptyColumnTitle: "Nada por aquí",
        emptyColumnHint: "Arrastre una tarjeta de otra columna o espere nuevos tickets.",
        noQueuesHint:
          "Ningún sector vinculado a su usuario. El Kanban necesita colas para listar tickets.",
        loading: "Cargando tablero…",
        quickActions: {
          menuAria: "Acciones del ticket",
          assign: "Asignar agente",
          unassign: "Quitar agente",
          changeQueue: "Cambiar sector",
          tags: "Etiquetas",
          close: "Cerrar ticket",
          selectUser: "Agente",
          selectQueue: "Cola",
          tagsPlaceholder: "Seleccione etiquetas",
          confirmClose:
            "¿Cerrar este ticket? El atención finalizará según las reglas configuradas (mensajes automáticos, encuesta, etc.).",
          cancel: "Cancelar",
          save: "Guardar",
        },
      },
      invoices: {
        title: "Facturas",
        pageSubtitle: "Facturas y pago por PIX.",
        paid: "Pagado",
        open: "Pendiente",
        expired: "Vencido",
        details: "Detalles",
        value: "Valor",
        dueDate: "Fecha Venc.",
        status: "Estado",
        action: "Acción",
        PAY: "PAGAR",
        PAID: "PAGADO",
        searchPlaceholder: "Buscar por ID o descripción…",
        empty: "No hay facturas.",
        emptyHint: "Las facturas generadas aparecerán aquí.",
        statusLabels: {
          paid: "Pagada",
          overdue: "Vencida",
          open: "Abierta",
        },
      },
      finance: {
        banner: {
          message:
            "Su empresa tiene un pago pendiente. Regularice para mantener el servicio al día.",
          action: "Ir a Facturación",
        },
        page: {
          delinquentAlert:
            "Hay un pago pendiente. El PIX usa siempre el importe de la factura que elija en la lista.",
        },
        login: {
          expiringSoon:
            "Su suscripción vence en {{days}} día(s). Renueve en Facturación.",
          delinquentWarning:
            "Atención: hay un pago pendiente. Abra Facturación para pagar con PIX.",
        },
      },
      checkoutPage: {
        modalTitle: "Pago con PIX",
        noInvoice:
          "Para pagar con PIX, abra Facturación y use Pagar en la factura indicada.",
        pixFlowTitle: "Pago de factura — PIX",
        pixFlowSubtitle:
          "El PIX se genera con el importe de la factura. El plan abajo solo indica límites, no el cobro.",
        steps: {
          data: "Datos",
          customize: "Personalizar",
          review: "Revisar",
          plan: "Plan",
          pixReview: "Revisar PIX",
        },
        success:
          "Cobro PIX generado. Escanee el QR o copie el código para pagar.",
        closeToEnd: "¡Falta poco!",
        BACK: "VOLVER",
        PAY: "PAGAR",
        PAY_PIX: "GENERAR PIX",
        NEXT: "SIGUIENTE",
        pix: {
          invoiceHeading: "Factura a pagar",
          amountCharged: "Importe (PIX)",
          dueDate: "Vencimiento",
          amountFromInvoice:
            "Igual al de la factura enviado al pago; no use el precio del plan como importe.",
          totalLabel: "Total PIX",
          waitingHint:
            "Esperando pago. El cobro caduca en unos {{minutes}} min (aprox.).",
          expiredHint:
            "Este cobro puede haber caducado. Cierre, vuelva a Facturación y genere otro PIX.",
          paidToast: "¡Pago confirmado! Nueva fecha: {{date}}",
          instructions:
            "Abra la app del banco, pague con PIX y espere la confirmación automática.",
          copyPix: "Copiar código PIX",
          copied: "Copiado",
          missingQr: "No se pudo mostrar el QR. Intente de nuevo.",
          invoiceRef: "Factura #{{id}} — {{detail}}",
          redirecting: "Redirigiendo…",
        },
        review: {
          title: "Resumen de la suscripción",
          titlePix: "Confirmar pago PIX",
          confirmPixHint:
            "Revise el importe de la factura. Al continuar se creará el cobro PIX.",
          pixSectionTitle: "Cobro (factura)",
          planSectionTitle: "Plan de referencia",
          planReferenceOnly:
            "Los límites del plan son informativos; el cobro es el de la factura de arriba.",
          invoiceId: "Factura",
          chargesFromInvoice: "Importe cobrado en PIX:",
          dueLabel: "Vencimiento",
          details: "Detalles del plan",
          users: "Usuarios",
          whatsapp: "Conexiones WhatsApp",
          charges: "Cobro: mensual (referencia)",
          total: "Total",
        },
        form: {
          planField: {
            label: "Plan seleccionado (referencia)",
          },
        },
        pricing: {
          users: "Usuarios",
          connection: "Conexión",
          queues: "Colas",
          SELECT: "SELECCIONAR",
          month: "mes",
        },
      },
      companies: {
        title: "Registrar Empresa",
        form: {
          name: "Nombre de la Empresa",
          plan: "Plan",
          token: "Token",
          submit: "Registrar",
          success: "¡Empresa creada con éxito!",
        },
      },
      auth: {
        toasts: {
          success: "¡Inicio de sesión realizado con éxito!",
        },
        token: "Token",
      },
      connections: {
        title: "Conexiones",
        guide: {
          title: "Cómo conectar WhatsApp",
          intro: "No se necesita API de pago. La conexión es por código QR (como WhatsApp Web).",
          step1: "Haga clic en \"Agregar WhatsApp\", asigne un nombre y guarde.",
          step2: "En la lista, haga clic en \"Ver código QR\" cuando el estado sea \"Esperando QR\".",
          step3: "En el teléfono: WhatsApp → Menú (⋮) o Ajustes → Dispositivos vinculados → Vincular dispositivo.",
          step4: "Apunte la cámara al código QR en pantalla. Al conectar, el estado mostrará \"Conectado\" en verde.",
        },
        statusLabel: {
          CONNECTED: "Conectado",
          qrcode: "Esperando QR",
          OPENING: "Conectando...",
          DISCONNECTED: "Desconectado",
          TIMEOUT: "Sin conexión",
          PAIRING: "Emparejando",
        },
        toasts: {
          deleted: "¡Conexión con WhatsApp eliminada con éxito!",
          connected: "¡WhatsApp conectado con éxito!",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "¿Está seguro? Esta acción no puede ser revertida.",
          disconnectTitle: "Desconectar",
          disconnectMessage: "¿Está seguro? Necesitará leer el código QR nuevamente.",
        },
        buttons: {
          add: "Agregar WhatsApp",
          disconnect: "desconectar",
          tryAgain: "Intentar nuevamente",
          qrcode: "CÓDIGO QR",
          newQr: "Nuevo CÓDIGO QR",
          connecting: "Conectando",
        },
        toolTips: {
          disconnected: {
            title: "Error al iniciar sesión de WhatsApp",
            content: "Asegúrese de que su teléfono esté conectado a internet e intente nuevamente, o solicite un nuevo código QR",
          },
          qrcode: {
            title: "Esperando lectura del código QR",
            content: "Haga clic en el botón 'CÓDIGO QR' y lea el código QR con su teléfono para iniciar la sesión",
          },
          connected: {
            title: "¡Conexión establecida!",
          },
          timeout: {
            title: "Se perdió la conexión con el teléfono",
            content: "Asegúrese de que su teléfono esté conectado a internet y WhatsApp esté abierto, o haga clic en el botón 'Desconectar' para obtener un nuevo código QR",
          },
        },
        table: {
          name: "Nombre",
          status: "Estado",
          lastUpdate: "Última actualización",
          default: "Predeterminado",
          actions: "Acciones",
          session: "Sesión",
        },
      },
      whatsappModal: {
        title: {
          add: "Agregar WhatsApp",
          edit: "Editar WhatsApp",
        },
        formErrors: {
          name: {
            required: "El nombre es obligatorio",
            short: "Nombre demasiado corto",
            long: "Nombre demasiado largo",
          },
        },
        tabs: {
          general: "General",
          messages: "Mensajes",
          assessments: "Evaluaciones",
          integrations: "Integraciones",
          schedules: "Horario laboral",
        },
        form: {
          name: "Nombre",
          default: "Predeterminado",
          sendIdQueue: "Cola",
          timeSendQueue: "Redirigir a cola en X minutos",
          queueRedirection: "Redirección de Cola",
          outOfHoursMessage: "Mensaje fuera de horario",
          queueRedirectionDesc:
              "Seleccione una cola para redirigir los contactos que no tienen cola asignada",
          prompt: "Prompt",
          queue: "Cola de Transferencia",
          timeToTransfer: "Transferir después de x (minutos)",
          expiresTicket: "Cerrar chats abiertos después de x minutos",
          expiresInactiveMessage: "Mensaje de cierre por inactividad",
          greetingMessage: "Mensaje de bienvenida",
          complationMessage: "Mensaje de conclusión",
          integration: "Integración",
          token: "Token de API",
          tokenReadOnly: "Generado automáticamente. Use en la página API de mensajes.",
          generateToken: "Generar nuevo token",
          copyToken: "Copiar token",
          tokenCopied: "¡Token copiado!",
          tokenCreatedTitle: "Token de API creado",
          tokenCreatedMessage: "Guarde este token en un lugar seguro. Úselo en la página Messages API para enviar mensajes por esta conexión.",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          close: "Cerrar",
        },
        success: "WhatsApp guardado con éxito.",
      },
      qrCodeModal: {
        title: "Conectar WhatsApp por código QR",
        steps: {
          one: "Abra WhatsApp en su teléfono",
          two: {
            partOne: "Toque en Más opciones (⋮) en Android",
            partTwo: "o en Configuración",
            partThree: "en iPhone",
          },
          three: "Toque en \"Dispositivos vinculados\" y luego en \"Vincular un dispositivo\"",
          four: "Apunte la cámara del teléfono al código QR de abajo",
        },
        waiting: "Esperando lectura del código QR...",
        newQr: "Generar nuevo código QR",
        connected: "¡Conectado! Ya puede cerrar esta ventana.",
      },
      qrCode: {
        message: "Lea el código QR para iniciar la sesión",
      },
      contacts: {
        title: "Contactos e historial de atención",
        subtitle:
          "Clientes y contactos de WhatsApp con registro de interacciones y tickets.",
        pageBanner:
          "Las etiquetas provienen de los tickets asociados a cada contacto.",
        pageExpectations:
          "Pensado para historial de conversaciones — no sustituye un CRM ni un embudo de ventas.",
        tagsColumnHint:
          "Etiquetas mostradas a partir de los tickets de este contacto.",
        tagFilterHelp:
          "Filtra contactos que tengan al menos un ticket con la etiqueta elegida.",
        searchHelper: "Busque por nombre, número, email o notas.",
        openAttendance: "Abrir atención",
        lastInteractionTooltip: "Última interacción",
        toasts: {
          deleted: "¡Contacto eliminado con éxito!",
          deletedAll: "¡Todos los contactos eliminados con éxito!",
        },
        searchPlaceholder: "Buscar por nombre, número, email o notas…",
        confirmationModal: {
          deleteTitle: "Eliminar ",
          deleteAllTitle: "Eliminar Todos",
          importTitle: "Importar contactos",
          deleteMessage:
              "¿Está seguro que desea eliminar este contacto? Todos los tickets relacionados se perderán.",
          deleteAllMessage:
              "¿Está seguro que desea eliminar todos los contactos? Todos los tickets relacionados se perderán.",
          importMessage: "¿Desea importar todos los contactos del teléfono?",
        },
        buttons: {
          import: "Importar Contactos",
          add: "Agregar Contacto",
          export: "Exportar Contactos",
          delete: "Eliminar Todos los Contactos",
          edit: "Editar contacto",
          deleteRow: "Eliminar contacto",
        },
        table: {
          name: "Nombre",
          number: "Número",
          whatsapp: "WhatsApp",
          email: "Email",
          tags: "Etiquetas",
          lastInteraction: "Última interacción",
          createdAt: "Creado",
          actions: "Acciones",
        },
        filters: {
          tag: "Etiqueta",
          allTags: "Todas",
          dateFrom: "Actualizado desde",
          dateTo: "Actualizado hasta",
        },
        empty: {
          title: "No hay contactos para mostrar",
          subtitle:
            "Ajuste la búsqueda o filtros, importe una lista o agregue un contacto.",
        },
        loading: "Cargando contactos…",
      },
      contactImportModal: {
        title: "Planilla de contactos",
        labels: {
          import: "Importar contactos",
          result: "resultados",
          added: "Agregados",
          savedContact: "Contacto guardado",
          errors: "Errores",
        },
        buttons: {
          download: "Descargar planilla modelo",
          import: "Importar contactos",
        },
      },
      queueIntegrationModal: {
        title: {
          add: "Agregar proyecto",
          edit: "Editar proyecto",
        },
        intro:
          "Cada registro puede vincularse a una cola (Filas) o a la conexión WhatsApp. El comportamiento depende del tipo elegido.",
        groups: {
          internal: "Automatizaciones internas",
          external: "Integraciones externas (POST HTTP)",
          legacy: "Legado",
        },
        types: {
          flowbuilder: "Flowbuilder",
          typebot: "Typebot",
          n8n: "N8N",
          webhook: "Webhook",
          dialogflow: "Dialogflow (heredado)",
        },
        descriptions: {
          flowbuilder: "Automatización interna con lógica y flujos personalizados",
          typebot: "Chatbot conversacional integrado",
          webhookN8n: "Envío de datos a sistemas externos (POST HTTP)",
        },
        alerts: {
          externalPost:
            "Esta integración envía datos a un sistema externo (POST), pero no recibe respuestas automáticamente ni cambia la atención según la respuesta HTTP. No responde sola al cliente en WhatsApp. Para automatización completa en el chat, use Flowbuilder o Typebot.",
          internalHint:
            "Esta opción participa en la conversa según el flujo o el bot configurado.",
        },
        form: {
          id: "ID",
          type: "Tipo",
          name: "Nombre",
          projectName: "Nombre del Proyecto",
          language: "Lenguaje",
          jsonContent: "JsonContent",
          legacyDialogflow: "Dialogflow (heredado)",
          legacyDialogflowHint:
            "Las integraciones Dialogflow ya no se configuran aquí. Cambie el tipo o edite solo el nombre.",
          urlN8N: "URL",
          urlWebhookHelper:
            "Envío por POST — la respuesta del servidor no vuelve automáticamente al ticket.",
          typebotSlug: "Typebot - Slug",
          typebotExpires: "Tiempo en minutos para expirar una conversación",
          typebotKeywordFinish: "Palabra para finalizar el ticket",
          typebotKeywordRestart: "Palabra para reiniciar el flujo",
          typebotRestartMessage: "Mensaje al reiniciar la conversación",
          typebotUnknownMessage: "Mensaje de opción inválida",
          typebotDelayMessage: "Intervalo (ms) entre mensajes",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          test: "Probar Bot",
        },
        messages: {
          testSuccess: "¡Integración probada con éxito!",
          addSuccess: "Integración agregada con éxito.",
          editSuccess: "Integración editada con éxito.",
        },
      },
      sideMenu: {
        name: "Menú Lateral Inicial",
        note: "Si está habilitado, el menú lateral iniciará cerrado",
        options: {
          enabled: "Abierto",
          disabled: "Cerrado",
        },
      },
      promptModal: {
        form: {
          name: "Nombre",
          prompt: "Prompt",
          model: "Modelo",
          max_tokens: "Máximo de Tokens en la respuesta",
          temperature: "Temperatura",
          apikey: "API Key",
          max_messages: "Máximo de mensajes en el Historial",
        },
        formErrors: {
          name: {
            short: "Nombre demasiado corto",
            long: "Nombre demasiado largo",
            required: "El nombre es obligatorio",
          },
          prompt: {
            short: "Prompt demasiado corto",
            required: "Describa el entrenamiento para la Inteligencia Artificial",
          },
          modal: {
            required: "Informe el modelo deseado para el Prompt",
          },
          maxTokens: {
            required: "Informe el número máximo de tokens en la respuesta",
          },
          temperature: {
            required: "Informe la temperatura",
          },
          apikey: {
            required: "Informe la API Key",
          },
          queueId: {
            required: "Informe la cola",
          },
          maxMessages: {
            required: "Informe el número máximo de mensajes en el historial",
          },
        },
        success: "¡Prompt guardado con éxito!",
        setor: "Informe el sector",
        title: {
          add: "Agregar Prompt",
          edit: "Editar Prompt",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
      },
      prompts: {
        title: "Prompts",
        openAiHelp:
          "Dónde actúa OpenAI: en la conexión WhatsApp (prompt vinculado), en la cola/sector (cuando el prompt del sector está activo) y en el flujo automatizado (nodo \"openai\" en Flow Builder). " +
          "Cuándo responde: al recibir mensajes de texto (o audio, si está soportado) en el ticket, siempre que las reglas del bot y de la cola lo permitan. " +
          "La respuesta usa el historial reciente de ese ticket y la instrucción de este registro — el contexto depende de lo ya intercambiado en la conversación.",
        table: {
          name: "Nombre",
          queue: "Sector/Cola",
          max_tokens: "Máximo Tokens Respuesta",
          actions: "Acciones",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "¿Está seguro? ¡Esta acción no puede ser revertida!",
        },
        buttons: {
          add: "Agregar Prompt",
        },
      },
      contactModal: {
        title: {
          add: "Agregar contacto",
          edit: "Editar contacto",
        },
        expectations:
          "Historial de atención — no es CRM ni embudo comercial.",
        summary: {
          title: "Actividad e historial",
          tickets: "Total de atenciones",
          lastInteraction: "Última interacción",
          lastMessage: "Último mensaje",
        },
        tags: {
          added: "Etiqueta agregada",
          removed: "Etiqueta eliminada",
          helpFromTickets:
            "Las etiquetas se basan en los tickets vinculados a este contacto. Para agregar o quitar, debe existir una conversación (abierta o cerrada).",
        },
        campaigns: {
          title: "Campañas (listas)",
          hint:
            "Listas donde este número ya figura. Para añadirlo a otra lista, use la página de listas de campaña.",
          empty: "Este número aún no está en ninguna lista.",
          manageLists: "Gestionar listas de campaña",
        },
        form: {
          mainInfo: "Datos del contacto",
          extraInfo: "Información adicional",
          name: "Nombre",
          number: "Número de WhatsApp",
          email: "Email",
          notes: "Notas",
          tags: "Etiquetas",
          addTag: "Agregar etiqueta",
          extraName: "Nombre del campo",
          extraValue: "Valor",
          whatsapp: "Conexión Origen: ",
        },
        formErrors: {
          name: {
            required: "El nombre es obligatorio",
            short: "Nombre demasiado corto",
            long: "Nombre demasiado largo",
          },
          phone: {
            short: "Número demasiado corto",
            long: "Número demasiado largo",
          },
          email: {
            invalid: "Email inválido",
          },
        },
        buttons: {
          addExtraInfo: "Agregar información",
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
          openAttendance: "Abrir atención",
        },
        success: "Contacto guardado con éxito.",
      },
      queueModal: {
        title: {
          add: "Agregar cola",
          edit: "Editar cola",
        },
        form: {
          name: "Nombre",
          nameShort: "Nombre corto",
          nameLong: "Nombre largo",
          nameRequired: "El nombre es obligatorio",
          color: "Color",
          colorShort: "Color corto",
          colorLong: "Color largo",
          greetingMessage: "Mensaje de bienvenida",
          complationMessage: "Mensaje de conclusión",
          outOfHoursMessage: "Mensaje fuera de horario",
          ratingMessage: "Mensaje de evaluación",
          token: "Token",
          orderQueue: "Orden de la cola (Bot)",
          integrationId: "Integración",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        toasts: {
          success: "Cola guardada con éxito.",
          info: "Haga clic en guardar para registrar los cambios",
        },
        tabs: {
          queueData: "Datos de la cola",
          attendanceTime: "Horarios de Atención",
        },
      },
      userModal: {
        title: {
          add: "Agregar usuario",
          edit: "Editar usuario",
        },
        form: {
          name: "Nombre",
          email: "Email",
          password: "Contraseña",
          profile: "Perfil",
          profileSupervisor: "Supervisor",
          passwordOptionalEdit: "Déjelo en blanco para mantener la contraseña actual.",
          whatsapp: "Conexión Predeterminada",
          allTicket: "Ticket Sin Cola [Invisible]",
          allTicketEnabled: "Habilitado",
          allTicketDesabled: "Deshabilitado",
        },
        hints: {
          passwordCreate: "Use una contraseña de al menos 5 caracteres.",
        },
        formErrors: {
          name: {
            required: "El nombre es obligatorio",
            short: "Nombre demasiado corto",
            long: "Nombre demasiado largo",
          },
          password: {
            required: "La contraseña es obligatoria",
            short: "Contraseña demasiado corta",
            long: "Contraseña demasiado larga",
          },
          email: {
            required: "El email es obligatorio",
            invalid: "Email inválido",
          },
        },
        labels: {
          liberations: "Liberaciones",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Usuario guardado con éxito.",
      },
      scheduleModal: {
        title: {
          add: "Nueva Programación",
          edit: "Editar Programación",
        },
        subtitle:
          "Automatización operativa (recordatorios, cobros, seguimiento). No es campaña masiva de marketing.",
        form: {
          body: "Mensaje",
          contact: "Contacto",
          contacts: "Contactos",
          sendType: "Tipo de envío",
          sendSingle: "Envío único",
          sendRecurring: "Envío recurrente",
          sendAt: "Fecha de Programación",
          sentAt: "Fecha de Envío",
          timeToSend: "Hora",
          companyTimezone: "Horarios en la zona",
          recurrence: "Frecuencia",
          recurrenceDaily: "Diaria",
          recurrenceWeekly: "Semanal",
          recurrenceMonthly: "Mensual",
          weekdays: "Días de la semana",
          dayOfMonth: "Día del mes",
          preferredWhatsapp: "Conexión preferida (opcional)",
          preferredWhatsappHint:
            "Déjelo vacío para enviar con cualquier conexión activa de la empresa.",
          automaticConnection: "Automático (cualquier conexión activa)",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        confirmationModal: {
          deleteTitle: "¿Eliminar adjunto?",
          deleteMessage: "El archivo se quitará de esta programación.",
        },
        toasts: {
          deleted: "Adjunto eliminado.",
        },
        success: "Programación guardada con éxito.",
      },
      tagModal: {
        title: {
          add: "Nueva Etiqueta",
          edit: "Editar Etiqueta",
        },
        form: {
          name: "Nombre",
          color: "Color",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Etiqueta guardada con éxito.",
      },
      chat: {
        toasts: {
          fillTitle: "Por favor, complete el título de la conversación.",
          fillUser: "Por favor, seleccione al menos un usuario.",
        },
        list: {
          conversationMenu: "Opciones de la conversación",
        },
        popover: {
          title: "Mensajes internos",
          openTooltip: "Abrir mensajes internos",
        },
        page: {
          title: "Chat interno",
          subtitle:
            "Mensajes del equipo y conversaciones por canal.",
          searchPlaceholder: "Buscar conversaciones...",
          loadingMessages: "Cargando mensajes...",
          loadingConversations: "Cargando conversaciones...",
          messagePlaceholder: "Escriba su mensaje...",
          sendMessage: "Enviar mensaje",
          messageInputAria: "Mensaje",
          emptyNoSearchTitle: "Sin resultados",
          emptyNoSearchSub: "Pruebe otro término o borre la búsqueda.",
          emptyNoConversationsTitle: "Aún no hay conversaciones",
          emptyNoConversationsSub:
            "Cree una conversación para empezar a mensajear con su equipo.",
          emptySelectTitle: "Seleccione una conversación",
          emptySelectSub: "Elija una de la lista para ver los mensajes.",
          newConversationButton: "Nueva conversación",
          tabsAria: "Conversaciones y mensajes",
        },
        modal: {
          title: "Conversación",
          titleField: "Título",
        },
        confirm: {
          title: "Eliminar Conversación",
          message: "Esta acción no puede ser revertida, ¿confirmar?",
        },
        chats: "Chats",
        messages: "Mensajes",
        noTicketMessage: "Seleccione un ticket para comenzar a chatear.",
        buttons: {
          close: "Cerrar",
          save: "Guardar",
          new: "Nueva",
          newChat: "Nuevo",
          edit: "Editar",
          delete: "Eliminar",
        },
      },
      uploads: {
        titles: {
          titleUploadMsgDragDrop: "ARRASTRE Y SUELTE ARCHIVOS EN EL CAMPO DE ABAJO",
          titleFileList: "Lista de archivo(s)",
        },
      },
      ticketsManager: {
        buttons: {
          newTicket: "Nuevo",
        },
        toasts: {
          bulkAssignSuccess:
            "{{count}} atención(es) actualizada(s) con la conexión seleccionada.",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Colas",
      },
      tickets: {
        toasts: {
          deleted: "La atención que estabas atendiendo fue eliminada.",
          unauthorized: "Acceso no permitido",
        },
        filters: {
          user: "Filtrar por usuarios",
          tags: "Filtrar por etiquetas",
        },
        notification: {
          message: "Mensaje de",
        },
        tabs: {
          open: { title: "Abiertos" },
          closed: { title: "Resueltos" },
          search: { title: "Búsqueda" },
        },
        search: {
          placeholder: "Buscar atención y mensajes",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Ticket",
        fieldLabel: "Escriba para buscar usuarios",
        fieldQueueLabel: "Transferir a cola",
        fieldQueuePlaceholder: "Seleccione una cola",
        noOptions: "Ningún usuario encontrado con ese nombre",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
        },
      },
      ticketsList: {
        pendingHeader: "En espera",
        assignedHeader: "En atención",
        noTicketsTitle: "¡Nada aquí!",
        noTicketsMessage:
            "Ninguna atención encontrada con ese estado o término buscado",
        emptyStateTitle: "No hay atenciones aquí",
        emptyStateMessage:
            "No hay tickets en esta vista o con los filtros y la búsqueda actuales.",
        emptyStateHint:
            "Ajusta los filtros o la búsqueda, o espera nuevos contactos. Cuando aparezcan, selecciona uno para abrir la conversación.",
        searchInputAria: "Buscar atenciones",
        keyboardShortcutsHint:
            "Atajos: / enfoque búsqueda · Alt+1 Abiertas · Alt+2 Resueltas · Alt+3 Filtros · Alt+4 Grupos · flechas en lista",
        compactListOn: "Lista compacta",
        compactListOff: "Lista cómoda",
        buttons: {
          accept: "Aceptar",
          closed: "Finalizar",
          reopen: "Reabrir",
        },
      },
      ticketsListItem: {
        ariaTicketRow: "Atención",
        tooltip: {
          chatbot: "Chatbot",
          peek: "Espiar Conversación",
        },
        noQueue: "SIN COLA",
      },
      ticketAdvanced: {
        selectTicket: "Seleccionar Ticket",
        ticketNav: "Ticket",
        attendanceNav: "Atenciones",
      },
      newTicketModal: {
        title: "Crear Ticket",
        fieldLabel: "Escriba para buscar el contacto",
        add: "Agregar",
        searchQueueError:
            "Ocurrió un error inesperado al intentar buscar las colas",
        selectQueue: "Seleccione una cola",
        selectConection: "Seleccione una conexión",
        buttons: {
          ok: "Guardar",
          cancel: "Cancelar",
        },
      },
      locationPreview: {
        button: "Visualizar",
      },
      mainDrawer: {
        sections: {
          dashboard: "Dashboard",
          atendimento: "Atención",
          chatInterno: "Chat interno",
          equipe: "Equipo",
          automacao: "Automatización",
          campanhas: "Campañas",
          financeiro: "Financiero",
          configuracoes: "Configuración",
        },
        listItems: {
          dashboard: "Dashboard",
          platform: "Plataforma",
          connections: "Conexiones",
          tickets: "Atenciones",
          quickMessages: "Respuestas rápidas",
          tasks: "Tareas",
          contacts: "Contactos",
          queues: "Colas & Chatbot",
          sectors: "Sectores",
          tags: "Etiquetas",
          administration: "Administración",
          users: "Usuarios",
          settings: "Configuración",
          helps: "Ayuda",
          messagesAPI: "API WhatsApp",
          schedules: "Programaciones",
          campaigns: "Campañas",
          contactLists: "Listas de contactos",
          campaignSettings: "Configuración",
          flows: "Flujos",
          flowsChatbot: "Flujos (Chatbot)",
          keywordsTrigger: "Disparadores por palabra clave",
          integrations: "Integraciones",
          reports: "Informes",
          kanban: "Kanban",
          groups: "Grupos",
          evaluation: "Evaluación",
          annoucements: "Informativos",
          chats: "Chat interno",
          finance: "Financiero",
          files: "Lista de archivos",
          prompts: "OpenAI",
          queueIntegration: "Automatizaciones por sector",
        },
        appBar: {
          refresh: "Recargar página",
          notRegister: "Sin notificaciones",
          pauseAttendance: {
            title: "¿Pausar atención?",
            message: "Al pausar la atención, el sistema enviará automáticamente un mensaje a los contactos informando que el atendente no está disponible en este momento. ¿Desea continuar?",
            cancel: "CANCELAR",
            confirm: "SÍ, PAUSAR",
          },
          greeting: {
            hello: "Hola",
            welcome: "Bienvenido a",
            active: "Activo hasta",
          },
          user: {
            profile: "Perfil",
            logout: "Salir",
          },
        },
        drawerFooter: {
          roleSuperAdmin: "Super Admin",
          roleAdmin: "Administrador",
          roleUser: "Usuario",
        },
      },
      platform: {
        shell: {
          eyebrow: "Super Admin · Plataforma",
        },
        tabs: {
          dashboard: "Panel de la plataforma",
          companies: "Empresas",
          superAdmins: "Super Admins",
          myAccount: "Mi cuenta",
          branding: "Marca",
        },
        dashboard: {
          title: "Panel de la plataforma",
          subtitle:
            "Indicadores y listas para seguir empresas, estado de la base y prioridades.",
          companiesTotal: "Total de empresas",
          kpiSectionTitle: "Indicadores principales",
          kpiTotal: "Total de empresas",
          kpiActive: "Empresas activas",
          kpiInactive: "Empresas inactivas",
          kpiNearDue: "Próximas al vencimiento",
          kpiNearDueHint: "Vencimiento en los próximos 30 días",
          healthSectionTitle: "Salud de la plataforma",
          healthSectionSubtitle:
            "Lectura rápida de cobertura administrativa y cuentas inactivas.",
          healthPctActive: "% de empresas activas",
          healthNoAdmin: "Empresas sin administrador",
          healthBlocked: "Empresas inactivas",
          healthBlockedHint: "Cuenta marcada como inactiva (bloqueo operativo)",
          recentTitle: "Empresas recientes",
          recentSubtitle: "Últimas cuentas creadas en la plataforma.",
          recentEmpty: "Aún no hay empresas registradas.",
          problemsTitle: "Empresas que requieren atención",
          problemsSubtitle: "Sin admin, inactivas o con vencimiento vencido.",
          problemsEmpty: "Ninguna empresa en estas condiciones.",
          reasonNoAdmin: "Sin admin",
          reasonInactive: "Inactiva",
          reasonExpired: "Vencida",
          actionNewCompany: "Nueva empresa",
          actionPlans: "Gestionar planes",
          actionBranding: "Marca",
          footerHint: "¿Necesita más detalle o edición?",
          openCompanies: "Abrir empresas",
        },
        companies: {
          title: "Empresas",
          subtitle:
            "Gestione empresas, permisos y configuración de la plataforma.",
          registeredListTitle: "Empresas registradas",
          searchPlaceholder: "Buscar por nombre o correo…",
          sortByName: "Nombre (A–Z)",
          sortByDate: "Fecha de registro",
          sortLabel: "Ordenar por",
          editRow: "Editar",
          actionsColumn: "Acciones",
          statusActive: "Activo",
          statusInactive: "Inactivo",
          listRowHint: "Pulse una fila o Editar para cargarla en el formulario superior.",
          registeredListSubtitle:
            "Vista global de empresas: busque, ordene y seleccione para editar arriba.",
        },
        branding: {
          title: "Marca global",
          subtitle:
            "Nombre y logos mostrados en el login y en el menú interno para todos los usuarios.",
          systemName: "Nombre del sistema",
          loginLogo: "Logo de la página de inicio de sesión",
          menuLogo: "Logo del menú interno",
          uploadHint:
            "PNG, JPG, WebP, GIF o SVG hasta 2 MB. Sin archivo nuevo, se conserva el logo actual.",
          chooseFile: "Elegir imagen",
          restoreDefault: "Usar logo predeterminado",
          saved: "Marca actualizada correctamente.",
          save: "Guardar",
        },
        superAdmins: {
          title: "Super Admins",
          subtitle:
            "Usuarios con acceso administrativo global a la plataforma. Promueva, edite datos y restablezca contraseñas con seguridad.",
          promoteAction: "Promover usuario",
          tableTitle: "Superadministradores",
          colName: "Nombre",
          colEmail: "Correo",
          colSuper: "Super admin",
          colCompany: "Empresa",
          colProfile: "Perfil",
          colOnline: "Estado",
          colActions: "Acciones",
          yes: "Sí",
          no: "No",
          edit: "Editar",
          editTitle: "Editar usuario",
          fieldName: "Nombre",
          fieldEmail: "Correo",
          fieldProfile: "Perfil",
          fieldSuper: "Superadministrador de la plataforma",
          fieldPassword: "Nueva contraseña (opcional)",
          passwordHint: "Deje en blanco para mantener la contraseña actual.",
          cancel: "Cancelar",
          save: "Guardar",
          promoteTitle: "Promover a super admin",
          promoteHint:
            "Busque por nombre o correo (mínimo 2 caracteres). El usuario accederá al panel Plataforma.",
          searchPlaceholder: "Buscar usuario…",
          alreadySuper: "Ya es super admin",
          promote: "Promover",
          close: "Cerrar",
          confirmDemoteSelf:
            "¿Seguro que desea quitarse el privilegio de super admin? Podría perder el acceso al panel Plataforma.",
          toastSaved: "Cambios guardados.",
          toastPromoted: "Usuario promovido a super admin.",
        },
        myAccount: {
          title: "Mi cuenta",
          subtitle: "Actualice su nombre, correo y contraseña de acceso a la plataforma.",
          formTitle: "Datos de la cuenta",
          fieldName: "Nombre",
          fieldEmail: "Correo",
          fieldPassword: "Nueva contraseña (opcional)",
          passwordHint: "Deje en blanco para mantener la contraseña actual.",
          save: "Guardar cambios",
          toastSaved: "Datos actualizados correctamente.",
        },
      },
      queueIntegration: {
        title: "Automatizaciones por sector",
        pageSubtitle:
          "Registros de integración vinculados a colas o a la conexión WhatsApp. Los tipos no se comportan igual: Webhook/N8N solo envían datos por POST; Flowbuilder y Typebot gestionan la conversación en la atención.",
        pageIntro:
          "Con Webhook o N8N, los datos se envían a un sistema externo, pero no se reciben respuestas automáticamente en la atención. Cree el registro aquí y vincúlelo en Colas (y opcionalmente en la conexión). Para respuestas automáticas al cliente en WhatsApp, use Flowbuilder o Typebot.",
        table: {
          id: "ID",
          type: "Tipo",
          categoryInternal: "Interna",
          categoryExternal: "Externa",
          categoryLegacy: "Legado",
          name: "Nombre",
          projectName: "Nombre del Proyecto",
          language: "Lenguaje",
          lastUpdate: "Última actualización",
          actions: "Acciones",
        },
        buttons: {
          add: "Agregar automatización",
        },
        searchPlaceholder: "Buscar...",
        toasts: {
          deleted: "Automatización eliminada correctamente.",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage:
              "¿Está seguro? ¡Esta acción no puede ser revertida! y será eliminada de las colas y conexiones vinculadas",
        },
      },
      files: {
        title: "Lista de archivos",
        table: {
          name: "Nombre",
          contacts: "Contactos",
          actions: "Acción",
        },
        toasts: {
          deleted: "¡Lista eliminada con éxito!",
          deletedAll: "¡Todas las listas fueron eliminadas con éxito!",
        },
        buttons: {
          add: "Agregar",
          deleteAll: "Eliminar Todos",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteAllTitle: "Eliminar Todos",
          deleteMessage: "¿Está seguro que desea eliminar esta lista?",
          deleteAllMessage: "¿Está seguro que desea eliminar todas las listas?",
        },
      },
      messagesAPI: {
        title: "API de envío WhatsApp",
        subtitle:
          "Envíe mensajes desde sistemas externos por HTTP usando el token de la conexión WhatsApp elegida.",
        copySuccess: "URL copiada al portapapeles.",
        sections: {
          overview: "Visión general",
          token: "Cómo obtener el token",
          endpoint: "Endpoint y autenticación",
          requestBodies: "Formatos de envío",
          responses: "Respuestas HTTP",
          testText: "Probar mensaje de texto",
          testMedia: "Probar mensaje con archivo",
        },
        overviewP1:
          "Esta página documenta la API de envío de mensajes WhatsApp. Cada token pertenece a una sola conexión (línea / número) de su empresa.",
        overviewP2:
          "El token no se crea aquí: en Conexiones, edite la conexión deseada y genere o copie el token. Ese secreto identifica qué conexión enviará los mensajes.",
        tokenSteps:
          "Abra Conexiones, elija la conexión que debe enviar, edítela y genere el token. Guárdelo en un lugar seguro: quien tenga el token puede enviar mensajes por esa conexión.",
        openConnections: "Ir a Conexiones",
        endpointUrlLabel: "URL del endpoint",
        endpointUrlHelp:
          "Use exactamente esta URL en integraciones (servidor, Postman o scripts).",
        methodLabel: "Método HTTP",
        authTitle: "Encabezado obligatorio",
        authLine: "Authorization: Bearer <token>",
        authHelp:
          "Reemplace <token> por el valor generado en Conexiones para la conexión elegida.",
        contentTypeJson: "Content-Type: application/json (solo texto)",
        contentTypeMultipart:
          "Content-Type: multipart/form-data (envío con archivo)",
        jsonBodyTitle: "Cuerpo JSON (texto)",
        jsonBodyExample:
          '{ "number": "5511999999999", "body": "Su mensaje aquí" }',
        multipartBodyTitle: "Multipart (medio)",
        multipartFields:
          "Campos: number (texto), medias (archivo). El campo body opcional puede usarse como leyenda según el backend.",
        numberFormatTitle: "Formato del número",
        numberFormatText:
          "Solo dígitos, con código de país y DDD, sin espacios ni símbolos. Ejemplo: 5511999999999.",
        responsesIntro: "Respuestas frecuentes de esta API:",
        responses: {
          r200: "200 — Envío procesado correctamente (el cuerpo puede incluir un mensaje de confirmación).",
          r401:
            "401 — Token inválido o ausente (ERR_INVALID_API_TOKEN).",
          r403:
            "403 — Plan sin permiso para API externa (ERR_EXTERNAL_API_NOT_ALLOWED).",
          r429: "429 — Límite de solicitudes excedido (ERR_RATE_LIMIT_EXCEEDED).",
          r400:
            "400 — Error de validación o de envío (p. ej. ERR_MESSAGE_SEND_FAILED con mensaje opcional).",
        },
        textMessage: {
          number: "Número del destinatario",
          body: "Texto del mensaje",
          token: "Token de la conexión (Bearer)",
          tokenPlaceholder: "Pegue el token generado en Conexiones",
          tokenHelper:
            "Cada token corresponde a una conexión WhatsApp. No lo comparta públicamente.",
          numberPlaceholder: "5511999999999",
          numberHelper:
            "Solo dígitos, con código de país y DDD, sin máscara.",
        },
        mediaMessage: {
          number: "Número del destinatario",
          body: "Nombre del archivo",
          media: "Archivo",
          token: "Token de la conexión (Bearer)",
          tokenPlaceholder: "Pegue el token generado en Conexiones",
          tokenHelper:
            "El mismo token que para texto, para la conexión que enviará el archivo.",
          numberPlaceholder: "5511999999999",
          numberHelper:
            "Solo dígitos, con código de país y DDD, sin máscara.",
          chooseFile: "Seleccionar archivo",
          noFile: "Ningún archivo seleccionado",
          fileRequired: "Seleccione un archivo para enviar.",
        },
        test: {
          endpointReadonly: "Endpoint (solo lectura)",
          textIntro:
            "Complete el token de la conexión, el número y el mensaje. La solicitud se envía como JSON al mismo endpoint documentado.",
          mediaIntro:
            "Use el mismo endpoint con multipart: número, archivo en medias y token en el encabezado.",
          noResultYet: "Aún no hay pruebas. El resultado aparecerá aquí.",
          resultOk: "Éxito — HTTP {{status}}",
          resultErr: "Fallo en la solicitud",
          resultErrStatus: "Fallo — HTTP {{status}}",
        },
        toasts: {
          unauthorized:
            "Esta empresa no tiene permiso para acceder a esta página. Redirigiendo…",
          success: "¡Mensaje enviado con éxito!",
        },
        buttons: {
          send: "Enviar prueba",
        },
      },
      notifications: {
        title: "Notificaciones",
        noTickets: "Ninguna notificación.",
      },
      quickMessages: {
        title: "Respuestas Rápidas",
        searchPlaceholder: "Buscar por atajo o texto…",
        noAttachment: "Sin adjunto",
        empty: {
          title: "No hay respuestas rápidas",
          subtitle: "Ajuste la búsqueda o cree un atajo para usar con / en el chat.",
        },
        confirmationModal: {
          deleteTitle: "Eliminación",
          deleteMessage:
            "La lista del chat se actualizará. Esta acción no se puede deshacer.",
        },
        validation: {
          shortcodeRequired: "Indique el atajo",
          shortcodeMin: "Mínimo 2 caracteres",
          shortcodeMax: "Máximo 80 caracteres",
          messageRequired: "Indique el mensaje",
          messageMax: "Mensaje demasiado largo",
          categoryMax: "Máximo 120 caracteres",
        },
        buttons: {
          add: "Agregar",
          attach: "Adjuntar Archivo",
          cancel: "Cancelar",
          edit: "Editar",
          delete: "Eliminar",
        },
        toasts: {
          success: "¡Respuesta rápida guardada!",
          deleted: "Respuesta rápida eliminada.",
          deletedMedia: "Adjunto eliminado.",
        },
        dialog: {
          title: "Mensaje Rápido",
          shortcode: "Atajo",
          shortcodeHint: "ej.: hola (uso en chat: /hola)",
          shortcodeHelper: "Se normaliza en minúsculas; evite espacios en el atajo.",
          category: "Grupo / etiqueta (opcional)",
          message: "Respuesta",
          previewLabel: "Vista previa",
          previewEmpty: "(sin texto)",
          save: "Guardar",
          cancel: "Cancelar",
          geral: "Permitir editar",
          add: "Agregar",
          edit: "Editar",
          visao: "Permitir visión",
        },
        table: {
          shortcode: "Atajo",
          category: "Grupo",
          messagePreview: "Vista previa",
          message: "Mensaje",
          actions: "Acciones",
          mediaName: "Nombre del Archivo",
          attachment: "Adjunto",
          createdAt: "Creado",
          updatedAt: "Actualizado",
          status: "Estado",
        },
      },
      messageVariablesPicker: {
        label: "Variables disponibles",
        vars: {
          contactFirstName: "Primer Nombre",
          contactName: "Nombre",
          greeting: "Saludo",
          protocolNumber: "Protocolo",
          date: "Fecha",
          hour: "Hora",
        },
      },
      contactLists: {
        title: "Listas de Contactos",
        table: {
          name: "Nombre",
          contacts: "Contactos",
          actions: "Acciones",
        },
        buttons: {
          add: "Nueva Lista",
        },
        dialog: {
          name: "Nombre",
          nameShort: "Nombre corto",
          nameLong: "Nombre largo",
          nameRequired: "El nombre es obligatorio",
          company: "Empresa",
          okEdit: "Editar",
          okAdd: "Agregar",
          add: "Agregar",
          edit: "Editar",
          cancel: "Cancelar",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "Esta acción no puede ser revertida.",
        },
        toasts: {
          deleted: "Registro eliminado",
          success: "Operación realizada con éxito",
        },
      },
      campaigns: {
        title: "Campañas",
        pageSubtitle:
          "Envíos por lista de contactos y conexión WhatsApp.",
        searchPlaceholder: "Buscar",
        report: {
          title: "Informe de",
          title2: "Campaña",
          of: "de",
          validContacts: "Contactos válidos",
          delivered: "Entregados",
          connection: "Conexión",
          contactList: "Lista de Contactos",
          schedule: "Programación",
          conclusion: "Conclusión",
        },
        config: {
          interval: "Intervalos",
          randomInterval: "Intervalo Aleatorio de Envío",
          biggerInterval: "Intervalo Mayor Después de",
          greaterInterval: "Intervalo de Envío Mayor",
          noInterval: "Sin Intervalo",
          second: "segundo",
          seconds: "segundos",
          notDefined: "No definido",
          addVariable: "Agregar Variable",
          save: "Guardar Configuración",
          shortcut: "Atajo",
          content: "Contenido",
          close: "Cerrar",
          add: "Agregar",
        },
        buttons: {
          add: "Nueva Campaña",
          contactLists: "Listas de Contactos",
        },
        loading: "Cargando campañas…",
        empty: {
          title: "No hay campañas registradas",
          subtitle:
            "Cree una campaña para enviar mensajes masivos a sus listas de contactos.",
        },
        status: {
          inactive: "Inactiva",
          programmed: "Programada",
          inProgress: "En progreso",
          canceled: "Cancelada",
          finished: "Finalizada",
        },
        table: {
          name: "Nombre",
          whatsapp: "Conexión",
          contactList: "Lista de Contactos",
          status: "Estado",
          scheduledAt: "Programación",
          completedAt: "Completada",
          confirmation: "Confirmación",
          actions: "Acciones",
          notDefined: "No definida",
          notDefined2: "No definido",
          notScheduled: "Sin programación",
          notConcluded: "No concluida",
          stopCampaign: "Detener Campaña",
          resumeCampaign: "Reanudar campaña",
          report: "Informe",
          edit: "Editar",
          delete: "Eliminar",
        },
        dialog: {
          new: "Nueva Campaña",
          update: "Editar Campaña",
          readonly: "Solo Lectura",
          form: {
            name: "Nombre",
            nameShort: "Nombre corto",
            nameLong: "Nombre largo",
            helper: "Utilice variables como {nombre}, {numero}, {email} o defina variables personalizadas.",
            nameRequired: "El nombre es obligatorio",
            message1: "Mensaje 1",
            message2: "Mensaje 2",
            message3: "Mensaje 3",
            message4: "Mensaje 4",
            message5: "Mensaje 5",
            messagePlaceholder: "Contenido del mensaje",
            whatsapp: "Conexión",
            status: "Estado",
            scheduledAt: "Programación",
            confirmation: "Confirmación",
            contactList: "Lista de Contactos",
            tagList: "Lista de Etiquetas",
            fileList: "Lista de Archivos",
          },
          buttons: {
            add: "Agregar",
            edit: "Actualizar",
            okadd: "Ok",
            cancel: "Cancelar Envíos",
            restart: "Reiniciar Envíos",
            close: "Cerrar",
            attach: "Adjuntar Archivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "Esta acción no puede ser revertida.",
        },
        toasts: {
          configSaved: "Configuración guardada",
          success: "Operación realizada con éxito",
          cancel: "Campaña cancelada",
          restart: "Campaña reiniciada",
          deleted: "Registro eliminado",
        },
      },
      subscription: {
        title: "Suscripción",
        testPeriod: "Período de Prueba",
        remainingTest: "Su período de prueba termina en",
        remainingTest2: "días!",
        chargeEmail: "Email de facturación",
        signNow: "¡Suscribirse ahora!",
      },
      announcements: {
        active: "Activo",
        inactive: "Inactivo",
        title: "Informativos",
        searchPlaceholder: "Buscar",
        high: "Alta",
        medium: "Media",
        low: "Baja",
        buttons: {
          add: "Nuevo Informativo",
          contactLists: "Listas de Informativos",
        },
        table: {
          priority: "Prioridad",
          title: "Título",
          text: "Texto",
          mediaName: "Archivo",
          status: "Estado",
          actions: "Acciones",
        },
        dialog: {
          edit: "Edición de Informativo",
          add: "Nuevo Informativo",
          update: "Editar Informativo",
          readonly: "Solo Lectura",
          form: {
            priority: "Prioridad",
            required: "Campo obligatorio",
            title: "Título",
            text: "Texto",
            mediaPath: "Archivo",
            status: "Estado",
          },
          buttons: {
            add: "Agregar",
            edit: "Actualizar",
            okadd: "Ok",
            cancel: "Cancelar",
            close: "Cerrar",
            attach: "Adjuntar Archivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "Esta acción no puede ser revertida.",
        },
        toasts: {
          success: "Operación realizada con éxito",
          deleted: "Registro eliminado",
          info: "¡Esta empresa no tiene permiso para acceder a esta página! Le estamos redirigiendo.",
        },
      },
      campaignsConfig: {
        title: "Configuración de Campañas",
      },
      queues: {
        title: "Colas & Chatbot",
        table: {
          id: "ID",
          name: "Nombre",
          color: "Color",
          greeting: "Mensaje de bienvenida",
          actions: "Acciones",
          orderQueue: "Ordenación de la cola (bot)",
        },
        buttons: {
          add: "Agregar cola",
        },
        toasts: {
          success: "Cola eliminada con éxito.",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage: "¿Está seguro? ¡Esta acción no puede ser revertida! Las atenciones de esta cola seguirán existiendo, pero no tendrán ninguna cola asignada.",
        },
      },
      queueSelect: {
        inputLabel: "Colas",
      },
      users: {
        title: "Usuarios",
        searchPlaceholder: "Buscar por nombre o correo…",
        table: {
          id: "ID",
          name: "Nombre",
          email: "Email",
          profile: "Perfil",
          queues: "Colas",
          online: "Estado",
          tickets: "Tickets",
          createdAt: "Registro",
          actions: "Acciones",
        },
        profileLabels: {
          admin: "Administrador",
          user: "Usuario",
          supervisor: "Supervisor",
        },
        online: {
          yes: "En línea",
          no: "Fuera de línea",
        },
        empty: {
          title: "No se encontraron usuarios",
          subtitle: "Ajuste la búsqueda o agregue un nuevo usuario.",
        },
        buttons: {
          add: "Agregar usuario",
          edit: "Editar",
          delete: "Eliminar",
        },
        toasts: {
          deleted: "Usuario eliminado con éxito.",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage:
            "Esta acción elimina el usuario y los vínculos con colas. No se puede eliminar si hay tickets asignados: transfiéralos antes.",
          deleteWarningTickets:
            "Este usuario tiene {{count}} ticket(s) asignado(s). La eliminación se bloqueará hasta transferir las atenciones.",
        },
      },
      todolist: {
        pageTitle: "Lista personal (guardada en este navegador)",
        pageSubtitle:
          "Las notas quedan solo en este dispositivo: no se sincronizan con el servidor ni con otros usuarios.",
        notice:
          "Estas notas se guardan solo en este navegador y no se comparten con el equipo.",
        emptyNoItems: "Aún no hay notas. Agregue una arriba.",
        emptyFilter: "Ninguna nota coincide con este filtro.",
        storageParseError:
          "No se pudieron cargar sus notas. Se eliminaron datos inválidos.",
        storageWriteError:
          "No se pudo guardar (el almacenamiento del navegador puede estar lleno o bloqueado).",
        input: "Nueva nota",
        completedAria: "Marcar como hecha",
        filter: {
          label: "Mostrar:",
          all: "Todas",
          pending: "Pendientes",
          completed: "Hechas",
        },
        buttons: {
          add: "Agregar",
          save: "Guardar",
          typeTask: "Escriba una nota para agregar",
        },
      },
      helps: {
        title: "Centro de Ayuda",
      },
      evaluation: {
        title: "Evaluación",
        pageSubtitle:
          "Notas del 1 al 3 tras cerrar, enviadas por WhatsApp.",
        flowInfo:
          "Con la evaluación activa, al cerrar el ticket el cliente recibe en WhatsApp una solicitud de nota (1 a 3). El ticket solo se cierra tras una respuesta válida.",
        scaleHint: "1 = insatisfecho · 2 = satisfecho · 3 = muy satisfecho",
        listHint:
          "Cada fila es una respuesta en WhatsApp; haga clic para abrir el ticket.",
        dashboard: {
          cardTitle: "Evaluación media",
          scaleLine: "Escala 1–3 (WhatsApp)",
          statusPrefix: "Indicador:",
          status: {
            great: "Excelente",
            good: "Bueno",
            improve: "A mejorar",
          },
        },
        avgRating: "Evaluación Promedia",
        totalRatings: "Total de Evaluaciones",
        byAttendant: "Por Atendente",
        searchPlaceholder: "Buscar por contacto o atendente...",
        noRatings: "Ninguna evaluación encontrada en el período.",
        loadMore: "Cargar más",
        dateFrom: "De",
        dateTo: "Hasta",
        table: {
          date: "Fecha",
          contact: "Contacto",
          attendant: "Atendente",
          setor: "Sector",
          rating: "Nota",
          ratingSub: "1 a 3",
        },
      },
      schedules: {
        title: "Programaciones",
        pageSubtitle: "{{count}} programación(es) cargada(s).",
        searchPlaceholder: "Buscar programaciones…",
        typeSingle: "Único",
        typeRecurring: "Recurrente",
        paused: "Pausado",
        active: "Activo",
        contactsCount: "{{count}} contacto(s)",
        nextRun: "Próxima ejecución",
        companyTimezoneShort: "Zona",
        frequencyShort: {
          daily: "Diaria",
          weekly: "Semanal",
          monthly: "Mensual",
        },
        listIntro:
          "Lista de programaciones (única o recurrente). Campañas masivas están en Campañas.",
        loading: "Cargando programaciones…",
        empty: {
          title: "Aún no hay programaciones",
          subtitle:
            "Programe envíos únicos o recurrentes a los contactos seleccionados.",
        },
        statusLabels: {
          PENDENTE: "Pendiente",
          AGENDADA: "En cola",
          ENVIADA: "Enviada",
          ERRO: "Error",
          AGUARDANDO_CONEXAO: "Esperando conexión",
        },
        preferredShort: "Preferida",
        confirmationModal: {
          deleteTitle: "¿Está seguro que desea eliminar esta Programación?",
          deleteMessage: "Esta acción no puede ser revertida.",
        },
        table: {
          contact: "Contacto",
          type: "Tipo",
          recurrence: "Frecuencia",
          contacts: "Contactos",
          nextRun: "Próxima ejecución",
          body: "Mensaje",
          sendAt: "Fecha de Programación",
          sentAt: "Fecha de Envío",
          status: "Estado",
          actions: "Acciones",
        },
        messages: {
          date: "Fecha",
          time: "Hora",
          event: "Evento",
          allDay: "Todo el Día",
          week: "Semana",
          work_week: "Programaciones",
          day: "Día",
          month: "Mes",
          previous: "Anterior",
          next: "Siguiente",
          yesterday: "Ayer",
          tomorrow: "Mañana",
          today: "Hoy",
          agenda: "Agenda",
          noEventsInRange: "No hay programaciones en el período.",
          showMore: "más",
        },
        buttons: {
          add: "Nueva Programación",
          pause: "Pausar",
          resume: "Activar",
          edit: "Editar programación",
          delete: "Eliminar programación",
        },
        toasts: {
          deleted: "Programación eliminada con éxito.",
        },
      },
      tags: {
        title: "Etiquetas",
        confirmationModal: {
          deleteTitle: "¿Está seguro que desea eliminar esta Etiqueta?",
          deleteMessage: "Esta acción no puede ser revertida.",
          deleteAllMessage: "¿Está seguro que desea eliminar todas las Etiquetas?",
          deleteAllTitle: "Eliminar Todas",
        },
        table: {
          name: "Nombre",
          color: "Color",
          tickets: "Registros Etiquetados",
          actions: "Acciones",
        },
        buttons: {
          add: "Nueva Etiqueta",
          deleteAll: "Eliminar Todas",
        },
        toasts: {
          deletedAll: "¡Todas las Etiquetas eliminadas con éxito!",
          deleted: "Etiqueta eliminada con éxito.",
        },
      },
      settings: {
        schedulesUpdated: "Horarios actualizados con éxito.",
        success: "Configuración guardada con éxito.",
        pageSubtitle:
          "Zona horaria, opciones de la empresa y áreas administrativas.",
        customPageIntro:
          "Use las pestañas de abajo para opciones, horarios (cuando estén activos) y otras áreas según su permiso.",
        title: "Configuración",
        tabs: {
          options: "Opciones",
          schedules: "Horarios",
          companies: "Empresas",
          plans: "Planes",
          helps: "Ayuda",
        },
        options: {
          pageIntro:
            "Estas opciones cambian el comportamiento de WhatsApp y los flujos para todos los tickets de esta empresa.",
          expedientCompanyWarning:
            "Modo Empresa: un mismo horario aplica a toda la empresa. En modo Cola, cada cola usa el suyo.",
          toasts: {
            success: "Operación actualizada con éxito.",
          },
          integrations: {
            asaasNotice:
              "El token de API da acceso a su cuenta Asaas. Guárdelo con seguridad y limite quién puede cambiarlo.",
          },
          fields: {
            ratings: {
              title: "Evaluaciones",
              disabled: "Deshabilitadas",
              enabled: "Habilitadas",
            },
            expedientManager: {
              title: "Gestión de Horario Laboral",
              queue: "Cola",
              company: "Empresa",
            },
            ignoreMessages: {
              title: "Mensajes de grupos de WhatsApp",
              alertNotice:
                "Recibir: los grupos quedan en la pestaña Grupos (manual, sin automatizaciones). Ignorar: no se registran mensajes de grupo.",
              helperText:
                "Recibir en la pestaña Grupos: los mensajes crean o actualizan conversas solo en esa pestaña, en modo manual (sin chatbot ni automatizaciones).\nIgnorar grupos: los mensajes de grupo no se guardan ni entran en el sistema.",
              optionReceive: "Recibir en pestaña Grupos (manual, sin automatizaciones)",
              optionIgnore: "Ignorar grupos (no entran en el sistema)",
            },
            acceptCall: {
              title: "Aceptar llamadas (WhatsApp)",
              alertNotice:
                "Aceptar: las llamadas siguen el comportamiento habitual de WhatsApp. No aceptar: el sistema rechaza y puede enviar el mensaje configurado abajo.",
              helperText:
                "Sí: las llamadas de voz/vídeo siguen el comportamiento normal de WhatsApp; el sistema no interfiere.\nNo: las llamadas entrantes se rechazan automáticamente; puede enviar un mensaje al contacto según las opciones siguientes.",
              disabled: "No aceptar",
              enabled: "Sí, aceptar",
              rejectSendTitle: "Enviar mensaje al rechazar la llamada",
              rejectSendYes: "Sí",
              rejectSendNo: "No",
              rejectMessageLabel: "Mensaje automático al rechazar la llamada",
              rejectMessagePlaceholder:
                "Ej.: Este número no recibe llamadas. Envíe un mensaje de texto y responderemos aquí.",
              rejectMessageHelper:
                "Deje vacío para usar el texto predeterminado del idioma de la empresa. Se guarda al salir del campo.",
            },
            chatbotType: {
              title: "Tipo Chatbot",
              text: "Texto",
            },
            sendGreetingAccepted: {
              title: "Enviar saludo al aceptar el ticket",
            },
            sendMsgTransfTicket: {
              title: "Enviar mensaje de transferencia de Cola/agente",
            },
            sendGreetingMessageOneQueues: {
              title: "Enviar saludo cuando haya solo 1 cola",
            },
            disabled: "Deshabilitado",
            active: "Activo",
            enabled: "Habilitado",
          },
          updating: "Actualizando...",
          tabs: {
            integrations: "INTEGRACIONES",
          },
        },
        helps: {
          toasts: {
            errorList: "No fue posible cargar la lista de registros",
            errorOperation: "No fue posible realizar la operación",
            error: "No fue posible realizar la operación. Verifique si ya existe una ayuda con el mismo nombre o si los campos fueron completados correctamente",
            success: "¡Operación realizada con éxito!",
          },
          buttons: {
            clean: "Limpiar",
            delete: "Eliminar",
            save: "Guardar",
          },
          grid: {
            title: "Título",
            description: "Descripción",
            video: "Video",
          },
          confirmModal: {
            title: "Eliminación de Registro",
            confirm: "¿Desea realmente eliminar este registro?",
          },
        },
        company: {
          toasts: {
            errorList: "No fue posible cargar la lista de registros",
            errorOperation: "No fue posible realizar la operación",
            error: "No fue posible realizar la operación. Verifique si ya existe una empresa con el mismo nombre o si los campos fueron completados correctamente",
            success: "¡Operación realizada con éxito!",
          },
          confirmModal: {
            title: "Eliminación de Registro",
            confirm: "¿Desea realmente eliminar este registro?",
          },
          form: {
            name: "Nombre",
            primaryAdmin: "Administrador principal",
            noPrimaryAdmin: "Sin administrador definido",
            email: "Email",
            emailMain: "Correo principal",
            phone: "Teléfono",
            sectionCompanyData: "Datos de la empresa",
            sectionCompanyDataHint:
              "Datos principales de identificación y contacto, incluido el administrador principal vinculado a esta empresa.",
            sectionPlanOperation: "Plan y operación",
            sectionPlanOperationHint:
              "Ajustes contractuales y operativos: plan, estado de la cuenta, zona horaria y ciclo de vencimiento.",
            editingBanner: "Editando: {{name}}",
            editingContextHint:
              "Los cambios del formulario se aplican solo a esta empresa.",
            plan: "Plan",
            status: "Estado",
            yes: "Sí",
            no: "No",
            campanhas: "Campañas",
            enabled: "Habilitadas",
            disabled: "Deshabilitadas",
            dueDate: "Fecha de vencimiento",
            recurrence: "Recurrencia",
            monthly: "Mensual",
            expire: "Vencimiento",
            createdAt: "Creada En",
            timezone: "Zona horaria de la empresa",
            timezoneHint:
              "Los agendamientos y recurrencias usan esta zona; el almacenamiento sigue en UTC.",
            timezoneFooter:
              "Elija la zona de la sede o de la operación principal.",
            timezoneHelperField:
              "Formato IANA como en la lista (ej.: America/Sao_Paulo).",
            usersSectionTitle: "Usuarios de la empresa",
            usersSectionHint:
              "Lista informativa de usuarios vinculados a esta empresa (sin gestión aquí).",
            usersEmpty: "No se encontraron usuarios en esta empresa.",
            modulesSectionTitle: "Módulos habilitados (empresa)",
            modulesSectionHint:
              "Complementa el plan: desactivar aquí oculta el módulo y bloquea el uso cuando el plan permita el recurso.",
            modules: {
              useKanban: "Kanban",
              useKanbanHelp: "Tablero kanban en la atención.",
              useCampaigns: "Campañas",
              useCampaignsHelp: "Listas, envíos e informes de campaña.",
              useFlowbuilders: "Flujos (chatbot)",
              useFlowbuildersHelp: "Flowbuilder, disparadores y flujos vinculados a WhatsApp.",
              useOpenAi: "OpenAI / Prompts",
              useOpenAiHelp: "Prompts y funciones de IA.",
              useSchedules: "Agendamientos",
              useSchedulesHelp: "Mensajes programados y recurrencia.",
              useExternalApi: "API WhatsApp (envío externo)",
              useExternalApiHelp: "Token HTTP para envío de mensajes por API.",
              useIntegrations: "Integraciones por sector",
              useIntegrationsHelp: "Webhooks, N8N, Typebot y automatizaciones.",
              useGroups: "Grupos WhatsApp",
              useGroupsHelp: "Gestión de grupos en la atención.",
            },
          },
          buttons: {
            clear: "Limpiar",
            delete: "Eliminar",
            expire: "+ Vencimiento",
            user: "Usuario",
            manageUsers: "Gestionar usuarios",
            adjustDueDate: "Ajustar vencimiento",
            save: "Guardar",
            saveTimezone: "Guardar zona horaria",
          },
        },
        schedules: {
          form: {
            weekday: "Día de la Semana",
            initialHour: "Hora Inicial",
            finalHour: "Hora Final",
            save: "Guardar",
          },
        },
        settings: {
          userCreation: {
            name: "Creación de usuario",
            options: {
              enabled: "Activado",
              disabled: "Desactivado",
            },
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Asignado a:",
          buttons: {
            return: "Regresar",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceptar",
            download: "Descargar",
            flowHistory: "Historial de flujo",
          },
        },
        lostCall: "Llamada de voz/video perdida a las",
        deletedMessage: "Este mensaje fue borrado por el contacto",
        edited: "Editado",
        saudation: "¡Saluda a tu nuevo contacto!",
      },
      messagesInput: {
        placeholderOpen: "Escribe un mensaje",
        placeholderClosed: "Reabre o acepta este ticket para enviar un mensaje.",
        signMessage: "Firmar",
        sticker: "Enviar sticker (WebP)",
        stickerOnlyWebp: "El sticker debe ser un archivo .webp",
      },
      contactDrawer: {
        header: "Datos del contacto",
        hiddenNumber: "Número oculto (privacidad WhatsApp)",
        buttons: {
          edit: "Editar contacto",
        },
        extraInfo: "Otra información",
      },
      fileModal: {
        title: {
          add: "Agregar lista de archivos",
          edit: "Editar lista de archivos",
        },
        buttons: {
          okAdd: "Guardar",
          okEdit: "Editar",
          cancel: "Cancelar",
          fileOptions: "Agregar archivo",
        },
        form: {
          name: "Nombre de la lista de archivos",
          message: "Detalles de la lista",
          fileOptions: "Lista de archivos",
          extraName: "Mensaje para enviar con archivo",
          extraValue: "Valor de la opción",
        },
        formErrors: {
          name: {
            required: "El nombre es obligatorio",
            short: "Nombre muy corto",
          },
          message: {
            required: "El mensaje es obligatorio",
          },
        },
        success: "¡Lista de archivos guardada con éxito!",
      },
      ticketOptionsMenu: {
        schedule: "Programación",
        delete: "Eliminar",
        transfer: "Transferir",
        registerAppointment: "Observaciones del Contacto",
        appointmentsModal: {
          title: "Observaciones del Contacto",
          textarea: "Observación",
          placeholder: "Ingrese aquí la información que desea registrar",
        },
        confirmationModal: {
          title: "Eliminar el ticket",
          titleFrom: "del contacto ",
          message: "¡Atención! Todos los mensajes relacionados al ticket se perderán.",
        },
        buttons: {
          delete: "Eliminar",
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
        delete: "Eliminar",
        reply: "Responder",
        confirmationModal: {
          title: "¿Borrar mensaje?",
          message: "Esta acción no puede ser revertida.",
        },
      },
      errors: {
        connectionError: "No se pudo conectar al servidor. Verifique la URL del backend y si el servidor está en línea.",
        generic: "Ocurrió un error. Por favor, intente nuevamente.",
        operationFailed: "No se pudo completar la acción. Intente nuevamente.",
      },
      backendErrors: {
        ERR_INTERNAL_SERVER_ERROR: "Ocurrió un error inesperado. Por favor, intente nuevamente más tarde",
        ERR_NO_OTHER_WHATSAPP: "Debe haber al menos un WhatsApp predeterminado.",
        ERR_NO_DEF_WAPP_FOUND: "No se encontró WhatsApp predeterminado. Verifique la página de conexiones.",
        ERR_WAPP_NOT_INITIALIZED: "Esta sesión de WhatsApp no fue inicializada. Verifique la página de conexiones.",
        ERR_WAPP_CHECK_CONTACT: "No fue posible verificar el contacto de WhatsApp. Verifique la página de conexiones",
        ERR_WAPP_INVALID_CONTACT: "Este no es un número de WhatsApp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA: "No fue posible descargar el archivo multimedia de WhatsApp. Verifique la página de conexiones.",
        ERR_INVALID_CREDENTIALS: "Error de autenticación. Por favor, intente nuevamente.",
        ERR_USER_DONT_EXISTS: "Usuario no encontrado. Verifique el email proporcionado.",
        ERR_SENDING_WAPP_MSG: "Error al enviar mensaje de WhatsApp. Verifique la página de conexiones.",
        ERR_DELETE_WAPP_MSG: "No fue posible eliminar el mensaje de WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Ya existe un ticket abierto para este contacto.",
        ERR_SESSION_EXPIRED: "Sesión expirada. Por favor inicie sesión.",
        ERR_USER_CREATION_DISABLED: "La creación de usuarios fue deshabilitada por el administrador.",
        ERR_NO_PERMISSION: "No tiene permiso para acceder a este recurso.",
        ERR_MODULE_NOT_ALLOWED:
          "Este módulo no está habilitado para su empresa (plan o configuración de la plataforma).",
        ERR_DUPLICATED_CONTACT: "Ya existe un contacto con este número.",
        ERR_NO_SETTING_FOUND: "No se encontró ninguna configuración con este ID.",
        ERR_NO_CONTACT_FOUND: "No se encontró ningún contacto con este ID.",
        ERR_NO_TICKET_FOUND: "No se encontró ningún ticket con este ID.",
        ERR_NO_USER_FOUND: "No se encontró ningún usuario con este ID.",
        ERR_NO_WAPP_FOUND: "No se encontró ningún WhatsApp con este ID.",
        ERR_CREATING_MESSAGE: "Error al crear mensaje en la base de datos.",
        ERR_CREATING_TICKET: "Error al crear ticket en la base de datos.",
        ERR_FETCH_WAPP_MSG: "Error al buscar el mensaje en WhatsApp, tal vez sea muy antiguo.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS: "Este color ya está en uso, elija otro.",
        ERR_WAPP_GREETING_REQUIRED: "El mensaje de saludo es obligatorio cuando hay más de una cola.",
        ERR_CAMPAIGN_NOT_FOUND: "Campaña no encontrada.",
        ERR_CAMPAIGN_INVALID_STATUS:
            "Esta acción no está permitida para el estado actual de la campaña.",
        ERR_CAMPAIGN_EMPTY_LIST: "Seleccione una lista de contactos o una etiqueta.",
        ERR_CAMPAIGN_NO_VALID_CONTACTS:
            "No hay contactos válidos para enviar en esta lista.",
        ERR_CAMPAIGN_TAG_REQUIRED: "Se requiere una etiqueta para la estimación.",
        ERR_CAMPAIGN_NO_FAILED_TO_RETRY:
            "No hay envíos fallidos para reintentar en esta campaña.",
        ERR_INVALID_API_TOKEN:
            "Token de API inválido o ausente. Verifique el encabezado Authorization: Bearer.",
        ERR_EXTERNAL_API_NOT_ALLOWED:
            "El plan de la empresa no permite la API externa. Actualice el plan o contacte al soporte.",
        ERR_RATE_LIMIT_EXCEEDED:
            "Límite de solicitudes por minuto superado. Espere e intente de nuevo.",
        ERR_MESSAGE_SEND_FAILED:
            "No se pudo completar el envío del mensaje.",
        ERR_INVOICE_NOT_FOUND: "Factura no encontrada.",
        ERR_FORBIDDEN_INVOICE: "Esta factura no pertenece a su empresa.",
        ERR_INVOICE_ALREADY_PAID: "Esta factura ya está pagada.",
        ERR_SUBSCRIPTION_VALIDATION: "Datos inválidos para generar PIX.",
        ERR_SUBSCRIPTION_PIX_CREATE:
            "No se pudo crear el cobro PIX. Intente de nuevo.",
        ERR_SUBSCRIPTION_WEBHOOK_CONFIG_VALIDATION: "Datos de webhook inválidos.",
        ERR_WEBHOOK_UNAUTHORIZED: "Webhook no autorizado (token inválido).",
        ERR_COMPANY_DELINQUENT:
            "Pago atrasado: esta acción está suspendida hasta regularizar en Facturación (PIX).",
        ERR_NO_COMPANY_FOUND: "Empresa no encontrada.",
        ERR_LAST_SUPER_ADMIN:
            "No puede quitarse el último superadministrador de la plataforma. Promueva a otro usuario primero.",
        ERR_EMAIL_IN_USE: "Este correo ya está en uso por otra cuenta.",
      },
    }
  }
};

export { messages };