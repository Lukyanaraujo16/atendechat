const messages = {
	en: {
		translations: {
			selectLanguage: "Select Language",
			signup: {
				title: "Sign Up",
				toasts: {
					success: "User created successfully! Please login!!!",
					fail: "Error creating user. Please check the provided information.",
				},
				form: {
					name: "Company Name",
					email: "Email",
					phone: "Phone Number (with Area Code)",
					plan: "Plan",
					password: "Password",
				},
				formErrors: {
					name: {
						required: "Company name is required",
						short: "Name is too short",
						long: "Name is too long",
					},
					password: {
						short: "Password is too short",
						long: "Password is too long",
					},
					email: {
						required: "Email is required",
						invalid: "Invalid email",
					},
				},
				buttons: {
					submit: "Register",
					login: "Already have an account? Login!",
				},
				plan: {
					attendant: "Attendant",
					whatsapp: "WhatsApp",
					queues: "Queues",
				},
			},
			login: {
				title: "Login",
				form: {
					email: "Email",
					password: "Password",
				},
				buttons: {
					submit: "Login",
					register: "Sign up now!",
				},
				whatsApp: {
					badge: "Support available",
					ariaLabel: "Open WhatsApp",
				},
			},
			resetPassword: {
				title: "Reset Password",
				toasts: {
					emailSent: "Email sent successfully!",
					emailNotFound: "Email not found!",
					passwordUpdated: "Password updated successfully!",
				},
				formErrors: {
					email: {
						required: "Email is required",
						invalid: "Invalid email",
					},
					newPassword: {
						required: "New password is required",
						matches: "Your password must have at least 8 characters, including one uppercase letter, one lowercase letter, and one number.",
					},
					confirmPassword: {
						required: "Password confirmation is required",
						matches: "Passwords do not match",
					},
				},
				form: {
					email: "Email",
					verificationCode: "Verification Code",
					newPassword: "New Password",
					confirmPassword: "Confirm New Password",
				},
				buttons: {
					submitEmail: "Send Email",
					submitPassword: "Reset Password",
					back: "Don't have an account? Sign up!",
				},
			},
			dashboard: {
				title: "Dashboard",
				subtitle: "Overview of attendances and metrics",
				header: {
					filters: "Filters",
					createReport: "Create Report (BETA)",
				},
				cards: {
					totalAttendances: "Total Attendances",
					inAttendance: "In Progress",
					resolutionRate: "Resolution Rate",
					ofTotal: "Of Total",
					statusWaiting: "Status: Waiting for Support",
					avgFirstResponse: "Avg. First Response Time",
					inMinutes: "In Minutes",
					status: "Status",
					totalMessages: "Total Messages",
					sent: "Sent",
					received: "Received",
				},
				toasts: {
					selectFilterError: "Set filter parameters",
					userChartError: "Error getting conversation information",
					dateChartError: "Error getting conversation information",
				},
				filters: {
					initialDate: "Start Date",
					finalDate: "End Date",
					filterType: {
						title: "Filter Type",
						options: {
							perDate: "Filter by Date",
							perPeriod: "Filter by Period",
						},
						helper: "Select desired filter type",
					},
				},
				periodSelect: {
					title: "Period",
					options: {
						none: "None selected",
						last3: "Last 3 days",
						last7: "Last 7 days",
						last15: "Last 15 days",
						last30: "Last 30 days",
						last60: "Last 60 days",
						last90: "Last 90 days",
					},
					helper: "Select desired period",
				},
				counters: {
					inTalk: "In conversation",
					waiting: "Waiting",
					finished: "Finished",
					newContacts: "New contacts",
					averageTalkTime: "Avg. Talk Time",
					averageWaitTime: "Avg. Wait Time",
				},
				buttons: {
					filter: "Filter",
				},
				onlineTable: {
					title: "Attendants status",
					ratingLabel: "1 - Unsatisfied, 2 - Satisfied, 3 - Very Satisfied",
					name: "Name",
					ratings: "Ratings",
					avgSupportTime: "Avg. Support Time",
					status: "Status (Current)",
				},
				charts: {
					user: {
						label: "Conversations Chart",
						title: "Total Conversations by Users",
						start: "Start",
						end: "End",
						filter: "Filter",
						tickets: "tickets",
					},
					date: {
						label: "Conversations Chart",
						title: "Total",
						start: "Start",
						end: "End",
						filter: "Filter",
						tickets: "tickets",
					},
				},
			},
			plans: {
				toasts: {
					errorList: "Could not load records list",
					errorOperation: "Could not complete operation",
					error: "Could not complete operation. Check if a plan with the same name already exists or if fields were filled correctly",
					success: "Operation completed successfully!",
				},
				confirm: {
					title: "Delete Record",
					message: "Do you really want to delete this record?",
				},
				form: {
					name: "Name",
					users: "Users",
					connections: "Connections",
					queues: "Queues",
					value: "Value",
					internalChat: "Internal Chat",
					internalChatHelp:
						"Internal messaging between users of the same company (outside WhatsApp).",
					modulesSectionTitle: "Plan modules",
					modulesSectionHint:
						"These switches define what the plan allows by default. Companies inherit these values and can override them under Platform → Companies.",
					externalApi: "External API",
					kanban: "Kanban",
					integrations: "Integrations",
					campaigns: "Campaigns",
					schedules: "Schedules",
					enabled: "Enabled",
					disabled: "Disabled",
					clear: "Cancel",
					delete: "Delete",
					save: "Save",
					yes: "Yes",
					no: "No",
					money: "$",
				},
				table: {
					companies: "Companies",
					aria: "Plans table",
				},
			},
			kanban: {
				toasts: {
					removed: "Ticket Tag Removed!",
					added: "Ticket Tag Added Successfully!",
				},
				open: "Open",
				seeTicket: "View Ticket",
				column: {
					pending: "Waiting",
					open: "In progress",
					closed: "Closed",
				},
				lastInteraction: "Last activity",
				queue: "Queue",
				attendant: "Agent",
				unread: "Unread",
				emptyColumnTitle: "Nothing here yet",
				emptyColumnHint: "Drag a card from another column or wait for new tickets.",
				noQueuesHint:
					"No queue linked to your user. Kanban needs queues to list tickets.",
				loading: "Loading board…",
				quickActions: {
					menuAria: "Ticket actions",
					transferTooltip: "Transfer conversation",
					transferConversation: "Transfer conversation",
					assign: "Assign agent",
					unassign: "Unassign agent",
					changeQueue: "Change queue",
					tags: "Tags",
					close: "Close ticket",
					selectUser: "Agent",
					selectUserOptional: "Agent (optional)",
					keepCurrentAttendant: "Keep current agent",
					selectQueue: "Queue",
					tagsPlaceholder: "Select tags",
					confirmClose:
						"Close this ticket? The conversation will end according to your existing rules (auto messages, survey, etc.).",
					confirmTransferUser:
						"Transfer this ticket to another agent?",
					cancel: "Cancel",
					save: "Save",
					confirm: "Confirm",
					noAttendantsForQueue:
						"No agents available for this queue. You can still transfer the queue only.",
				},
			},
			invoices: {
				title: "Invoices",
				pageSubtitle: "Invoices and PIX payment.",
				paid: "Paid",
				open: "Open",
				expired: "Expired",
				details: "Details",
				value: "Amount",
				dueDate: "Due Date",
				status: "Status",
				action: "Action",
				PAY: "PAY",
				PAID: "PAID",
				searchPlaceholder: "Search by ID or description…",
				empty: "No invoices found.",
				emptyHint: "System-generated invoices will appear here.",
				statusLabels: {
					paid: "Paid",
					overdue: "Overdue",
					open: "Open",
				},
			},
			finance: {
				banner: {
					message:
						"Your company has an overdue payment. Please settle it to keep the service in good standing.",
					action: "Open Billing",
				},
				page: {
					delinquentAlert:
						"There is a pending payment. PIX always uses the amount of the invoice you select in the list.",
				},
				login: {
					expiringSoon:
						"Your subscription expires in {{days}} day(s). Consider renewing under Billing.",
					delinquentWarning:
						"Warning: there is a pending payment. Open Billing to pay via PIX.",
				},
			},
			checkoutPage: {
				modalTitle: "PIX payment",
				noInvoice: "To pay with PIX, open Billing and tap Pay on the invoice you need.",
				pixFlowTitle: "Invoice payment — PIX",
				pixFlowSubtitle:
					"PIX is generated with the invoice amount. The plan below shows limits only—not what you pay.",
				steps: {
					data: "Data",
					customize: "Customize",
					review: "Review",
					plan: "Plan",
					pixReview: "Review PIX",
				},
				success: "PIX charge created. Scan the QR code or copy the code to pay.",
				closeToEnd: "Almost there!",
				BACK: "BACK",
				PAY: "PAY",
				PAY_PIX: "GENERATE PIX",
				NEXT: "NEXT",
				pix: {
					invoiceHeading: "Invoice to pay",
					amountCharged: "Amount (PIX)",
					dueDate: "Due date",
					amountFromInvoice:
						"Same as the invoice sent to payment; ignore the plan price as the charge amount.",
					totalLabel: "PIX total",
					waitingHint: "Awaiting payment. Charge expires in about {{minutes}} min.",
					expiredHint:
						"This charge may have expired. Close, return to Billing, and generate a new PIX.",
					paidToast: "Payment confirmed! New date: {{date}}",
					instructions:
						"Open your bank app, pay with PIX copy-and-paste or QR code, then wait for automatic confirmation.",
					copyPix: "Copy PIX code",
					copied: "Copied",
					missingQr: "Could not display QR code. Try again.",
					invoiceRef: "Invoice #{{id}} — {{detail}}",
					redirecting: "Redirecting…",
				},
				review: {
					title: "Subscription Summary",
					titlePix: "Confirm PIX payment",
					confirmPixHint:
						"Check the invoice amount. Continuing will create the PIX charge.",
					pixSectionTitle: "Charge (invoice)",
					planSectionTitle: "Plan reference",
					planReferenceOnly:
						"Plan limits are informational; the charge is the invoice amount above.",
					invoiceId: "Invoice",
					chargesFromInvoice: "PIX amount:",
					dueLabel: "Due",
					details: "Plan Details",
					users: "Users",
					whatsapp: "WhatsApp connections",
					charges: "Billing: monthly (reference)",
					total: "Total",
				},
				form: {
					planField: {
						label: "Selected plan (reference)",
					},
				},
				pricing: {
					users: "Users",
					connection: "Connection",
					queues: "Queues",
					SELECT: "SELECT",
					month: "month",
				},
			},
			companies: {
				title: "Register Company",
				form: {
					name: "Company Name",
					plan: "Plan",
					token: "Token",
					submit: "Register",
					success: "Company created successfully!",
				},
			},
			auth: {
				toasts: {
					success: "Login successful!",
				},
				token: "Token",
			},
			connections: {
				title: "Connections",
				guide: {
					title: "How to connect WhatsApp",
					intro: "No paid API needed. Connection is via QR Code (like WhatsApp Web).",
					step1: "Click \"Add WhatsApp\", give it a name and save.",
					step2: "In the list, click \"View QR Code\" when status is \"Waiting for QR\".",
					step3: "On your phone: WhatsApp → Menu (⋮) or Settings → Linked devices → Link a device.",
					step4: "Point your camera at the QR Code on screen. When connected, status will show green \"Connected\".",
				},
				statusLabel: {
					CONNECTED: "Connected",
					qrcode: "Waiting for QR",
					OPENING: "Connecting...",
					DISCONNECTED: "Disconnected",
					TIMEOUT: "No connection",
					PAIRING: "Pairing",
					PENDING: "Pending",
				},
				toasts: {
					deleted: "WhatsApp connection deleted successfully!",
					connected: "WhatsApp connected successfully!",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "Are you sure? This action cannot be undone.",
					disconnectTitle: "Disconnect",
					disconnectMessage: "Are you sure? You'll need to scan the QR Code again.",
				},
				buttons: {
					add: "Add WhatsApp",
					disconnect: "disconnect",
					tryAgain: "Try again",
					qrcode: "QR CODE",
					newQr: "New QR CODE",
					connecting: "Connecting",
				},
				toolTips: {
					disconnected: {
						title: "Failed to start WhatsApp session",
						content: "Make sure your phone is connected to the internet and try again, or request a new QR Code",
					},
					qrcode: {
						title: "Waiting for QR Code scan",
						content: "Click the 'QR CODE' button and scan the QR Code with your phone to start the session",
					},
					connected: {
						title: "Connection established!",
					},
					timeout: {
						title: "Connection to phone was lost",
						content: "Make sure your phone is connected to the internet and WhatsApp is open, or click the 'Disconnect' button to get a new QR Code",
					},
				},
				table: {
					name: "Name",
					status: "Status",
					lastUpdate: "Last update",
					default: "Default",
					actions: "Actions",
					session: "Session",
					emptyTitle: "No connections yet",
					emptyHint: "Add a WhatsApp to generate a QR code and start service.",
				},
			},
			whatsappModal: {
				title: {
					add: "Add WhatsApp",
					edit: "Edit WhatsApp",
				},
				formErrors: {
					name: {
						required: "Name is required",
						short: "Name is too short",
						long: "Name is too long",
					},
				},
				tabs: {
					general: "General",
					messages: "Messages",
					assessments: "Assessments",
					integrations: "Integrations",
					schedules: "Business Hours",
				},
				form: {
					name: "Name",
					default: "Default",
					sendIdQueue: "Queue",
					timeSendQueue: "Redirect to queue in X minutes",
					queueRedirection: "Queue Redirection",
					outOfHoursMessage: "Out of office message",
					queueRedirectionDesc: "Select a queue for contacts without a queue to be redirected to",
					prompt: "Prompt",
					queue: "Transfer Queue",
					timeToTransfer: "Transfer after x (minutes)",
					expiresTicket: "Close open chats after x minutes",
					expiresInactiveMessage: "Inactivity closure message",
					greetingMessage: "Greeting message",
					complationMessage: "Completion message",
					integration: "Integration",
					token: "API Token",
					tokenReadOnly: "Generated automatically. Use on the Messages API page.",
					generateToken: "Generate new token",
					copyToken: "Copy token",
					tokenCopied: "Token copied!",
					tokenCreatedTitle: "API Token created",
					tokenCreatedMessage: "Save this token in a safe place. Use it on the Messages API page to send messages through this connection.",
					autoReadMessages: "Automatically mark messages as read",
					autoReadMessagesHint:
						"When enabled, after each inbound message is stored, the system sends a read receipt to WhatsApp — fewer unread badges on the phone linked to this session.",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
					close: "Close",
				},
				success: "WhatsApp saved successfully.",
			},
			qrCodeModal: {
				title: "Connect WhatsApp via QR Code",
				steps: {
					one: "Open WhatsApp on your phone",
					two: {
						partOne: "Tap More options (⋮) on Android",
						partTwo: "or Settings",
						partThree: "on iPhone",
					},
					three: "Tap \"Linked devices\" then \"Link a device\"",
					four: "Point your phone camera at the QR Code below",
				},
				waiting: "Waiting for QR Code scan...",
				newQr: "Generate new QR Code",
				connected: "Connected! You can close this window.",
			},
			qrCode: {
				message: "Scan the QR Code to start the session",
			},
			contacts: {
				title: "Contacts and service history",
				subtitle:
					"WhatsApp customers and contacts with interaction and ticket history.",
				pageBanner:
					"Tags come from tickets already linked to each contact.",
				pageExpectations:
					"Built for conversation history — not a full CRM or sales pipeline.",
				tagsColumnHint:
					"Tags are derived from tickets associated with this contact.",
				tagFilterHelp:
					"Shows contacts that have at least one ticket with the selected tag.",
				searchHelper: "Search by name, number, email, or notes.",
				openAttendance: "Open ticket",
				scheduleMessage: "Schedule message",
				lastInteractionTooltip: "Last interaction",
				toasts: {
					deleted: "Contact deleted successfully!",
					deletedAll: "All contacts deleted successfully!",
				},
				searchPlaceholder: "Search by name, number, email, or notes…",
				confirmationModal: {
					deleteTitle: "Delete ",
					deleteAllTitle: "Delete All",
					importTitle: "Import contacts",
					deleteMessage: "Are you sure you want to delete this contact? All related tickets will be lost.",
					deleteAllMessage: "Are you sure you want to delete all contacts? All related tickets will be lost.",
					importMessage: "Do you want to import all phone contacts?",
				},
				buttons: {
					import: "Import Contacts",
					add: "Add Contact",
					export: "Export Contacts",
					delete: "Delete All Contacts",
					edit: "Edit contact",
					deleteRow: "Delete contact",
				},
				table: {
					contact: "Contact",
					name: "Name",
					number: "Number",
					whatsapp: "WhatsApp",
					email: "Email",
					tags: "Tags",
					lastInteraction: "Last interaction",
					createdAt: "Created",
					actions: "Actions",
				},
				filters: {
					sectionLabel: "Filters",
					tag: "Tag",
					allTags: "All",
					dateFrom: "Updated from",
					dateTo: "Updated until",
				},
				empty: {
					title: "No contacts to show",
					subtitle:
						"Adjust search or filters, import a list, or add a contact to get started.",
				},
				loading: "Loading contacts…",
			},
			contactImportModal: {
				title: "Contact Spreadsheet",
				labels: {
					import: "Import contacts",
					result: "results",
					added: "Added",
					savedContact: "Contact saved",
					errors: "Errors",
				},
				buttons: {
					download: "Download template spreadsheet",
					import: "Import contacts",
				},
			},
			queueIntegrationModal: {
				title: {
					add: "Add project",
					edit: "Edit project",
				},
				intro:
					"Each record here can be linked to a queue (Queues) or to the WhatsApp connection. Behavior depends on the selected type.",
				groups: {
					internal: "Internal automations",
					external: "External integrations (HTTP POST)",
					legacy: "Legacy",
				},
				types: {
					flowbuilder: "Flowbuilder",
					typebot: "Typebot",
					n8n: "N8N",
					webhook: "Webhook",
					dialogflow: "Dialogflow (legacy)",
				},
				descriptions: {
					flowbuilder: "Internal automation with custom logic and personalized flows",
					typebot: "Integrated conversational chatbot",
					webhookN8n: "Send data to external systems (HTTP POST)",
				},
				alerts: {
					externalPost:
						"This integration sends data to an external system (POST) but does not receive responses automatically or change the ticket based on the HTTP response. It does not reply to the customer by itself on WhatsApp. For full in-chat automation, use Flowbuilder or Typebot.",
					internalHint:
						"This option participates in the conversation according to your flow or bot configuration.",
				},
				form: {
					id: "ID",
					type: "Type",
					name: "Name",
					projectName: "Project Name",
					language: "Language",
					jsonContent: "JsonContent",
					legacyDialogflow: "Dialogflow (legacy)",
					legacyDialogflowHint:
						"Dialogflow integrations can no longer be configured here. Change the type or edit the name only.",
					urlN8N: "URL",
					urlWebhookHelper:
						"POST outbound — the server response is not applied back to the ticket automatically.",
					typebotSlug: "Typebot - Slug",
					typebotExpires: "Time in minutes to expire a conversation",
					typebotKeywordFinish: "Keyword to finish ticket",
					typebotKeywordRestart: "Keyword to restart flow",
					typebotRestartMessage: "Message when restarting conversation",
					typebotUnknownMessage: "Invalid option message",
					typebotDelayMessage: "Interval (ms) between messages",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
					test: "Test Bot",
				},
				messages: {
					testSuccess: "Integration tested successfully!",
					addSuccess: "Integration added successfully.",
					editSuccess: "Integration edited successfully.",
				},
			},
			sideMenu: {
				name: "Initial Side Menu",
				note: "If enabled, the side menu will start closed",
				options: {
					enabled: "Open",
					disabled: "Closed",
				},
			},
			promptModal: {
				form: {
					name: "Name",
					prompt: "Prompt",
					model: "Model",
					max_tokens: "Maximum Tokens in response",
					temperature: "Temperature",
					apikey: "API Key",
					max_messages: "Maximum messages in History",
				},
				formErrors: {
					name: {
						short: "Name is too short",
						long: "Name is too long",
						required: "Name is required",
					},
					prompt: {
						short: "Prompt is too short",
						required: "Describe the training for Artificial Intelligence",
					},
					modal: {
						required: "Enter the desired model for the Prompt",
					},
					maxTokens: {
						required: "Enter the maximum number of tokens in the response",
					},
					temperature: {
						required: "Enter the temperature",
					},
					apikey: {
						required: "Enter the API Key",
					},
					queueId: {
						required: "Enter the queue",
					},
					maxMessages: {
						required: "Enter the maximum number of messages in history",
					},
				},
				success: "Prompt saved successfully!",
				setor: "Enter the sector",
				title: {
					add: "Add Prompt",
					edit: "Edit Prompt",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
				},
			},
			prompts: {
				title: "Prompts",
				openAiHelp:
					"Where OpenAI runs: on the WhatsApp connection (linked prompt), on the queue/sector (when that sector’s prompt is active), and in automated flows (the \"openai\" node in Flow Builder). " +
					"When it replies: on incoming text messages (or audio where supported) on the ticket, as long as bot and queue rules allow. " +
					"The reply uses recent message history for that ticket and the instructions from this record — context depends on what was already exchanged in the conversation.",
				table: {
					name: "Name",
					queue: "Sector/Queue",
					max_tokens: "Maximum Response Tokens",
					actions: "Actions",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "Are you sure? This action cannot be undone!",
				},
				buttons: {
					add: "Add Prompt",
				},
			},
			contactModal: {
				title: {
					add: "Add Contact",
					edit: "Edit Contact",
				},
				expectations:
					"Service history — not a CRM or sales pipeline.",
				summary: {
					title: "Activity and history",
					tickets: "Total tickets",
					lastInteraction: "Last interaction",
					lastMessage: "Last message",
				},
				tags: {
					added: "Tag added",
					removed: "Tag removed",
					helpFromTickets:
						"Tags are based on tickets linked to this contact. Adding or removing a tag requires an existing conversation (open or closed).",
				},
				campaigns: {
					title: "Campaigns (lists)",
					hint:
						"Lists where this number already appears. To add it to another list, use the campaign lists page.",
					empty: "This number is not in any list yet.",
					manageLists: "Manage campaign lists",
				},
				form: {
					mainInfo: "Contact Information",
					extraInfo: "Additional Information",
					name: "Name",
					number: "WhatsApp Number",
					email: "Email",
					emailPlaceholder: "name@company.com",
					notes: "Notes",
					tags: "Tags",
					addTag: "Add tag",
					extraName: "Field Name",
					extraValue: "Value",
					whatsapp: "Source Connection: ",
				},
				formErrors: {
					name: {
						required: "Name is required",
						short: "Name is too short",
						long: "Name is too long",
					},
					phone: {
						required: "Number is required",
						short: "Number is too short",
						long: "Number is too long",
					},
					email: {
						invalid: "Invalid email",
					},
				},
				buttons: {
					addExtraInfo: "Add Information",
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
					openAttendance: "Open ticket",
				},
				success: "Contact saved successfully.",
			},
			queueModal: {
				title: {
					add: "Add Queue",
					edit: "Edit Queue",
				},
				preview: "Preview",
				previewPlaceholder: "Queue name",
				form: {
					name: "Name",
					nameShort: "Short name",
					nameLong: "Long name",
					nameRequired: "Name is required",
					color: "Color",
					colorShort: "Short color",
					colorLong: "Long color",
					greetingMessage: "Greeting message",
					complationMessage: "Completion message",
					outOfHoursMessage: "Out of office message",
					ratingMessage: "Rating message",
					token: "Token",
					orderQueue: "Queue order (Bot)",
					integrationId: "Integration",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
				},
				toasts: {
					success: "Queue saved successfully.",
					info: "Click save to register changes",
				},
				tabs: {
					queueData: "Queue Data",
					attendanceTime: "Service Hours",
				},
			},
			userModal: {
				title: {
					add: "Add User",
					edit: "Edit User",
				},
				form: {
					name: "Name",
					email: "Email",
					password: "Password",
					profile: "Profile",
					profileSupervisor: "Supervisor",
					passwordOptionalEdit: "Leave blank to keep the current password.",
					whatsapp: "Default Connection",
					allTicket: "Queueless Ticket [Invisible]",
					allTicketEnabled: "Enabled",
					allTicketDesabled: "Disabled",
				},
				hints: {
					passwordCreate: "Use a password with at least 5 characters.",
				},
				formErrors: {
					name: {
						required: "Name is required",
						short: "Name is too short",
						long: "Name is too long",
					},
					password: {
						required: "Password is required",
						short: "Password is too short",
						long: "Password is too long",
					},
					email: {
						required: "Email is required",
						invalid: "Invalid email",
					},
				},
				labels: {
					liberations: "Releases",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
				},
				success: "User saved successfully.",
			},
			scheduleModal: {
				title: {
					add: "New Schedule",
					edit: "Edit Schedule",
				},
				subtitle:
					"Operational automation (reminders, billing, follow-up). Not a mass marketing campaign.",
				form: {
					body: "Message",
					contact: "Contact",
					contacts: "Contacts",
					sendType: "Send type",
					sendSingle: "One-time",
					sendRecurring: "Recurring",
					sendAt: "Schedule Date",
					sentAt: "Send Date",
					timeToSend: "Time",
					companyTimezone: "Times use company timezone",
					recurrence: "Frequency",
					recurrenceDaily: "Daily",
					recurrenceWeekly: "Weekly",
					recurrenceMonthly: "Monthly",
					weekdays: "Weekdays",
					dayOfMonth: "Day of month",
					preferredWhatsapp: "Preferred connection (optional)",
					preferredWhatsappHint:
						"Leave blank to send via any active company connection.",
					automaticConnection: "Automatic (any active connection)",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
				},
				confirmationModal: {
					deleteTitle: "Remove attachment?",
					deleteMessage: "The file will be removed from this schedule.",
				},
				toasts: {
					deleted: "Attachment removed.",
				},
				success: "Schedule saved successfully.",
			},
			tagModal: {
				title: {
					add: "New tag",
					edit: "Edit tag",
				},
				preview: "Preview",
				previewPlaceholder: "Tag name",
				form: {
					name: "Name",
					color: "Color (hex)",
				},
				formErrors: {
					nameRequired: "Name is required",
					nameShort: "Name is too short (min. 2 characters)",
					nameLong: "Name is too long",
				},
				buttons: {
					okAdd: "Add",
					okEdit: "Save",
					cancel: "Cancel",
				},
				success: "Tag saved successfully.",
			},
			chat: {
				toasts: {
					fillTitle: "Please fill in the conversation title.",
					fillUser: "Please select at least one user.",
				},
				list: {
					conversationMenu: "Conversation options",
				},
				popover: {
					title: "Internal messages",
					openTooltip: "Open internal messages",
				},
				page: {
					title: "Internal chat",
					subtitle: "Team messages—separate from customer WhatsApp.",
					searchPlaceholder: "Search conversations...",
					loadingMessages: "Loading messages...",
					loadingConversations: "Loading conversations...",
					messagePlaceholder: "Type your message...",
					sendMessage: "Send message",
					messageInputAria: "Message",
					emptyNoSearchTitle: "No matches",
					emptyNoSearchSub: "Try another term or clear the search.",
					emptyNoConversationsTitle: "No conversations yet",
					emptyNoConversationsSub:
						"Start a conversation to message your team.",
					emptySelectTitle: "Select a conversation",
					emptySelectSub: "Pick one from the list to view messages.",
					newConversationButton: "New conversation",
					tabsAria: "Conversations and messages",
				},
				modal: {
					title: "Conversation",
					titleField: "Title",
				},
				confirm: {
					title: "Delete Conversation",
					message: "This action cannot be undone, confirm?",
				},
				chats: "Chats",
				messages: "Messages",
				noTicketMessage: "Select a conversation to get started",
				emptyInboxTitle: "No conversation selected",
				emptyInboxSubtitle:
					"Pick a ticket from the list to view messages and reply with your team.",
				buttons: {
					close: "Close",
					save: "Save",
					new: "New",
					newChat: "New",
					edit: "Edit",
					delete: "Delete",
				},
			},
			uploads: {
				titles: {
					titleUploadMsgDragDrop: "DRAG AND DROP FILES IN THE FIELD BELOW",
					titleFileList: "File List",
				},
			},
			ticketsManager: {
				buttons: {
					newTicket: "New",
					fabNewTicket: "New ticket",
					fabBulkActions: "Bulk actions",
				},
				toasts: {
					bulkAssignSuccess:
						"{{count}} ticket(s) updated with the selected connection.",
				},
			},
			ticketsQueueSelect: {
				placeholder: "Queues",
			},
			tickets: {
				toasts: {
					deleted: "The service you were in has been deleted.",
					unauthorized: "Access not allowed",
				},
				filters: {
					user: "Filter by users",
					tags: "Filter by tags",
				},
				notification: {
					message: "Message from",
				},
				tabs: {
					open: { title: "Open" },
					closed: { title: "Resolved" },
					search: { title: "Search" },
				},
				search: {
					placeholder: "Search by contact, phone number, or message text…",
				},
				buttons: {
					showAll: "All",
				},
			},
			transferTicketModal: {
				title: "Transfer Ticket",
				fieldLabel: "Type to search users",
				fieldQueueLabel: "Transfer to queue",
				fieldQueuePlaceholder: "Select a queue",
				noOptions: "No user found with that name",
				buttons: {
					ok: "Transfer",
					cancel: "Cancel",
				},
			},
			ticketsList: {
				pendingHeader: "Waiting",
				assignedHeader: "In Progress",
				noTicketsTitle: "Nothing here!",
				noTicketsMessage: "No service found with this status or search term",
				emptyStateTitle: "No conversations here",
				emptyStateMessage:
					"No tickets match this view or your current filters and search.",
				emptyStateHint:
					"Adjust filters or search, or wait for new contacts. When tickets appear, select one to open the conversation.",
				searchInputAria: "Search tickets",
				keyboardShortcutsHint:
					"Shortcuts: / focus search · Alt+1 Open · Alt+2 Resolved · Alt+3 Filters · Alt+4 Groups · arrows in list",
				compactListOn: "Compact list",
				compactListOff: "Comfortable list",
				buttons: {
					accept: "Accept",
					closed: "Finish",
					reopen: "Reopen",
				},
			},
			ticketsListItem: {
				ariaTicketRow: "Ticket",
				tooltip: {
					chatbot: "Chatbot",
					peek: "Peek Conversation",
				},
				noQueue: "NO QUEUE",
			},
			ticketAdvanced: {
				selectTicket: "Select Ticket",
				ticketNav: "Ticket",
				attendanceNav: "Services",
			},
			newTicketModal: {
				title: "Create Ticket",
				fieldLabel: "Type to search contact",
				add: "Add",
				searchQueueError: "An unexpected error occurred while trying to fetch queues",
				selectQueue: "Select a queue",
				selectConection: "Select a connection",
				buttons: {
					ok: "Save",
					cancel: "Cancel",
				},
			},
			locationPreview: {
				button: "Preview",
			},
			mainDrawer: {
				sections: {
					dashboard: "Dashboard",
					atendimento: "Customer service",
					chatInterno: "Internal chat",
					equipe: "Team",
					automacao: "Automation",
					campanhas: "Campaigns",
					financeiro: "Financial",
					configuracoes: "Settings",
				},
				listItems: {
					dashboard: "Dashboard",
					platform: "Platform",
					connections: "Connections",
					tickets: "Tickets",
					quickMessages: "Quick replies",
					tasks: "Tasks",
					contacts: "Contacts",
					queues: "Queues & Chatbot",
					sectors: "Queues",
					tags: "Tags",
					administration: "Administration",
					users: "Users",
					settings: "Settings",
					helps: "Help",
					messagesAPI: "WhatsApp API",
					schedules: "Schedules",
					campaigns: "Campaigns",
					contactLists: "Contact lists",
					campaignSettings: "Settings",
					flows: "Flows",
					flowsChatbot: "Flows (Chatbot)",
					keywordsTrigger: "Keyword triggers",
					integrations: "Integrations",
					reports: "Reports",
					kanban: "Kanban",
					groups: "Groups",
					evaluation: "Evaluation",
					annoucements: "Announcements",
					chats: "Internal chat",
					finance: "Financial",
					files: "File list",
					prompts: "OpenAI",
					queueIntegration: "Automations by queue",
				},
				appBar: {
					refresh: "Reload page",
					notRegister: "No notifications",
					pauseAttendance: {
						title: "Pause service?",
						message: "When pausing the service, the system will automatically send a message to contacts informing that the attendant is not available at the moment. Do you want to continue?",
						cancel: "CANCEL",
						confirm: "YES, PAUSE",
					},
					greeting: {
						hello: "Hello",
						welcome: "Welcome to",
						active: "Active until",
					},
					user: {
						profile: "Profile",
						logout: "Logout",
					},
				},
				drawerFooter: {
					roleSuperAdmin: "Super Admin",
					roleAdmin: "Administrator",
					roleUser: "User",
				},
			},
			platform: {
				shell: {
					eyebrow: "Super Admin · Platform",
				},
				tabs: {
					dashboard: "Platform dashboard",
					companies: "Companies",
					plans: "Plans",
					superAdmins: "Super Admins",
					myAccount: "My account",
					branding: "Branding",
					financial: "Financial",
					backup: "Backup",
					helps: "Help content",
					announcements: "Announcements",
				},
				announcements: {
					title: "Global announcements",
					subtitle:
						"Notices and messages shown to users according to system rules. Central platform management.",
				},
				helps: {
					title: "Help content",
					subtitle:
						"Tutorials and links shown in the in-app help area for all users. Global platform content.",
				},
				plans: {
					title: "Product plans",
					subtitle:
						"Manage the plan catalog (limits and modules). Each company uses one plan; per-company overrides stay under Platform → Companies.",
					intro:
						"These plans are the platform defaults. Companies can still have module overrides individually (Super Admin → Companies).",
					formSectionTitle: "Create or edit plan",
					listSectionTitle: "Plan catalog",
					newPlan: "New plan",
					registeredListTitle: "Registered plans",
					registeredListSubtitle:
						"Select a plan to edit or create a new one. Modules are only configured when creating or editing.",
					listRowHint: "Click a row or the edit icon to open the form.",
					searchPlaceholder: "Search by plan name…",
					sortLabel: "Sort",
					sortByName: "Name (A–Z)",
					sortByValue: "Price (low → high)",
					editingBanner: "Editing: {{name}}",
					editingContextHint:
						"Changes to limits and modules apply to this plan; propagation to companies follows the existing rules when you save.",
					emptyListTitle: "No plans in the catalog",
					emptyListSubtitle: "Create the first plan or adjust your search.",
					noSearchResults: "No plans match your search.",
					listLoading: "Loading plans…",
					moduleSave: {
						title: "Plan module changes",
						summaryIntro:
							"Summary of module changes compared to the previous state of this plan:",
						lineOn: "{{module}} — enabled",
						lineOff: "{{module}} — disabled",
						choosePropagation:
							"How should this apply to companies on this plan?",
						applyNone: "Save plan only",
						applyNoOverride: "Save and queue: apply only where there is no override",
						applyAll: "Save and queue: apply to all companies",
						propagationPending:
							"Plan saved. Automatic propagation to companies will be wired in the backend next.",
						propagationSuccess:
							"Plan saved. {{count}} company/companies had module permissions updated as requested.",
						propagationNoCompaniesUpdated:
							"Plan saved. No company JSON changes were needed (or all overrides were preserved).",
					},
				},
				dashboard: {
					title: "Platform dashboard",
					subtitle:
						"KPIs and lists to monitor companies, tenant health, and priorities.",
					companiesTotal: "Total companies",
					kpiSectionTitle: "Key metrics",
					kpiTotal: "Total companies",
					kpiActive: "Active companies",
					kpiInactive: "Inactive companies",
					kpiNearDue: "Due soon",
					kpiNearDueHint: "Due within the next 30 days",
					healthSectionTitle: "Platform health",
					healthSectionSubtitle:
						"Quick read on admin coverage and inactive accounts.",
					healthPctActive: "% of active companies",
					healthNoAdmin: "Companies without an admin",
					healthBlocked: "Inactive companies",
					healthBlockedHint: "Account marked inactive (operational block)",
					recentTitle: "Recent companies",
					recentSubtitle: "Latest accounts created on the platform.",
					recentEmpty: "No companies yet.",
					problemsTitle: "Needs attention",
					problemsSubtitle: "No admin, inactive, or past due date.",
					problemsEmpty: "No companies match these conditions.",
					reasonNoAdmin: "No admin",
					reasonInactive: "Inactive",
					reasonExpired: "Past due",
					actionNewCompany: "New company",
					actionPlans: "Manage plans",
					actionBranding: "Branding",
					footerHint: "Need more detail or edits?",
					openCompanies: "Open companies",
				},
				moduleSettings: {
					planChange: {
						title: "Change company plan",
						message:
							"Changing the plan may change this company’s modules. Keep current permissions or align to the new plan’s defaults.",
						keepModules: "Keep current settings",
						applyPlanModules: "Apply plan modules",
					},
					origin: {
						inherited: "Allowed by plan (no company block)",
						disabledOverride: "Turned off for this company",
						blockedByPlan: "Not available on this plan",
						companyOnly: "Company-only (no column on plan)",
						noPlan: "Select a plan to edit these modules",
					},
				},
				companies: {
					title: "Companies",
					subtitle:
						"Manage companies, permissions, and platform settings.",
					registeredListTitle: "Registered companies",
					newCompany: "New company",
					searchPlaceholder: "Search by name or email…",
					sortByName: "Name (A–Z)",
					sortByDate: "Created date",
					sortLabel: "Sort by",
					editRow: "Edit",
					actionsColumn: "Actions",
					statusActive: "Active",
					statusInactive: "Inactive",
					listRowHint:
						"Click a row or Edit to load the form below. Use New company to create.",
					registeredListSubtitle:
						"Main list — search, sort, and pick a row to edit, or add a new account.",
					accessCompany: "Open company (support mode)",
					moreActions: "More actions",
					blockCompany: "Block company",
					unblockCompany: "Unblock company",
					renewCompany: "Renew due date",
					deleteCompanyAction: "Delete company",
					confirmBlockTitle: "Block company?",
					confirmBlockMessage:
						"“{{name}}” will not be able to access the system until unblocked. Continue?",
					confirmUnblockTitle: "Unblock company?",
					confirmUnblockMessage:
						"“{{name}}” will be able to access the system again. Continue?",
					statusUpdateSuccess: "Company status updated.",
					renewDialogTitle: "Renew due date",
					renewDialogMessage:
						"Renew “{{name}}” using recurrence {{recurrence}}. New due date: {{date}}.",
					renewInvalidRecurrence:
						"Could not calculate renewal. Set a valid recurrence on the company (MENSAL, BIMESTRAL, TRIMESTRAL, SEMESTRAL, ANUAL).",
					renewConfirm: "Renew",
					renewSuccess: "Due date renewed successfully.",
					deleteGridTitle: "Delete company",
					deleteGridMessage:
						"This permanently deletes “{{name}}” and related data. To confirm, type the exact company name below.",
					deleteGridNameLabel: "Company name to confirm",
					deleteGridHint: "The button enables only when the name matches exactly.",
					deleteGridConfirm: "Delete permanently",
					deleteGridSuccess: "Company deleted.",
				},
				support: {
					entered: "Support mode enabled.",
					exited: "You left support mode.",
					banner: "You are viewing {{name}} in support mode.",
					exitButton: "Back to Super Admin",
				},
				branding: {
					title: "Global branding",
					subtitle:
						"Name and logos shown on login and in the internal menu for all users.",
					systemName: "System name",
					loginLogo: "Login page logo",
					menuLogo: "Internal menu logo",
					uploadHint:
						"PNG, JPG, WebP, GIF or SVG up to 2 MB. Without a new file, the current logo is kept.",
					loginLogoHint:
						"Supported formats: PNG, JPG, WebP.\nRecommended: horizontal image (3:1 or 4:1 aspect ratio).\nExamples: 300x100, 400x100, 600x150.\nPrefer a transparent background.",
					menuLogoHint:
						"Supported formats: PNG, JPG, WebP.\nRecommended: compact horizontal image (2:1 or 3:1 aspect ratio).\nExamples: 200x80, 240x80.\nAvoid very tall or square images.",
					favicon: "System favicon",
					uploadHintFavicon: "PNG, ICO, SVG or JPG up to 1 MB. Without a new file, the current icon is kept.",
					faviconHint:
						"Supported formats: PNG, ICO, SVG.\nRecommended: square image (1:1 aspect ratio).\nExamples: 32x32, 64x64 or 128x128.",
					chooseFile: "Choose image",
					restoreDefault: "Use default logo",
					saved: "Branding updated successfully.",
					save: "Save",
					loginWhatsAppSection: "Login page WhatsApp button",
					loginWhatsAppSectionSubtitle:
						"Public number for the floating button on the login screen. Leave blank to hide the button.",
					loginWhatsAppNumber: "WhatsApp number",
					loginWhatsAppNumberHint:
						"International format, digits only — e.g. 5527999999999 (no spaces, dashes, or parentheses).",
					loginWhatsAppMessage: "Prefilled message (optional)",
					loginWhatsAppMessagePlaceholder: "Hi! I came from the login page.",
					loginWhatsAppMessageHint:
						"If set, the WhatsApp link includes this text as the initial message (text parameter).",
				},
				finance: {
					title: "Platform finances",
					subtitle:
						"Consolidated per company: plans, due dates, and operational status. Built for quick monitoring — not automatic billing.",
					kpiSection: "Overview",
					kpiTotal: "Total companies",
					kpiEmDia: "On track",
					kpiEmDiaHint:
						"Active accounts with no past-due date (includes “due soon” and “no due date”).",
					kpiInadimplente: "Delinquent",
					kpiSoon: "Due soon",
					kpiSoonHint: "Due in the next 30 days",
					kpiInactive: "Inactive",
					kpiRevenue: "Forecast revenue",
					kpiRevenueHint: "Estimate: sum of plan amounts for active companies.",
					tableSection: "Company portfolio",
					searchLabel: "Search",
					searchPlaceholder: "Name or email…",
					filterFinanceLabel: "Financial situation",
					filterFinanceAll: "All",
					filterFinanceOk: "On track",
					filterFinanceSoon: "Due soon",
					filterFinanceOverdue: "Delinquent",
					filterFinanceNoDue: "No due date",
					filterFinanceInactive: "Inactive (account)",
					filterCompanyLabel: "Company status",
					filterCompanyAll: "All",
					filterCompanyActive: "Active",
					filterCompanyInactive: "Inactive",
					loading: "Loading data…",
					emptyTitle: "No companies in this filter",
					emptySubtitle: "Adjust financial situation, company status, or search.",
					colCompany: "Company",
					colPlan: "Plan",
					colPlanValue: "Plan amount",
					colDue: "Due date",
					colRecurrence: "Recurrence",
					colFinance: "Financial situation",
					colCompanyStatus: "Company status",
					colActions: "Actions",
					actionEdit: "Open company",
					companyStatus: {
						active: "Active",
						inactive: "Inactive",
					},
					status: {
						inactive: "Inactive",
						overdue: "Delinquent",
						soon: "Due soon",
						ok: "On track",
						noDue: "No due date",
					},
				},
				backup: {
					title: "Backup & restore",
					subtitle:
						"Creates a ZIP with the database dump (SQL) and the public folder (uploads, branding, attachments). Requires mysqldump or pg_dump on the server. Restore replaces the DB and public files — a safety backup is created first.",
					sectionGenerate: "Create backup",
					sectionGenerateHint:
						"Duration depends on database and file size. The MySQL/PostgreSQL CLI client must be installed on the server.",
					generate: "Generate backup now",
					generateHint:
						"Each backup includes manifest.json (metadata), database.sql, and the public/ tree. Does not include .env, Redis, Bull queues, or proxy config.",
					sectionAuto: "Automatic backups",
					sectionAutoHint:
						"Scheduled on the server (node-cron). Files use the same folder as manual backups. Retention applies only to automatic copies.",
					autoEnabled: "Enable automatic backup",
					autoFrequency: "Frequency",
					freqDaily: "Daily",
					freqWeekly: "Weekly",
					autoTime: "Run time",
					autoWeekday: "Weekday",
					weekdays: {
						0: "Sunday",
						1: "Monday",
						2: "Tuesday",
						3: "Wednesday",
						4: "Thursday",
						5: "Friday",
						6: "Saturday",
					},
					autoRetention: "Max automatic backups to keep",
					autoRetentionHint: "Manual and pre-restore safety backups are not removed by this rule.",
					saveAuto: "Save schedule",
					summaryTitle: "Schedule overview",
					summaryStatus: "Status",
					statusActive: "Active",
					statusInactive: "Inactive",
					summarySchedule: "Plan",
					summaryRetentionShort: "Retention",
					retentionValue: "{{n}} automatic backups",
					nextTitle: "Next automatic backup",
					nextDisabled: "Automatic backup is turned off.",
					nextUnknown: "Could not estimate the next run from the current settings.",
					nextEstimateHint:
						"Estimate uses this browser’s clock; the real run follows the server clock.",
					nextLineToday: "Today at {{time}}",
					nextLineTomorrow: "Tomorrow at {{time}}",
					nextLineWeekday: "{{weekday}} at {{time}}",
					timezoneNote: "The scheduled time follows the server clock where the backend runs.",
					browserTz: "This browser’s timezone (reference): {{tz}}",
					formTitle: "Edit schedule",
					formSubtitle: "Save to apply. The summary updates after saving.",
					nextCardTitle: "Next automatic",
					nextCardHint: "Local estimate; the server may use a different timezone.",
					nextCardOff: "Enable scheduling to see the forecast.",
					lastTitle: "Latest backup in the list",
					sectionListHint: "Newest first.",
					autoPendingHint:
						"Scheduling is on but no automatic backups appear yet — the first run may be at the next scheduled time.",
					emptyHintAutoOn:
						"No files yet. Generate a manual backup now or wait for the automatic schedule.",
					badgeRecent: "Latest",
					sectionList: "Backups on this server",
					loading: "Loading list…",
					empty: "No backups yet",
					emptyHint: "Use “Generate backup now” to create the first one.",
					colDate: "Date",
					colFile: "File",
					colSize: "Size",
					colType: "Type",
					colStatus: "Status",
					colActions: "Actions",
					type: {
						manual: "Manual",
						automatic: "Automatic",
						pre_restore: "Pre-restore",
					},
					delete: "Delete",
					deleteTitle: "Delete backup",
					deleteBody: "This permanently removes the ZIP file from the server.",
					deleteConfirmLabel: "Confirmation",
					deleteConfirmHelper: "To delete, type: EXCLUIR",
					deleteConfirmButton: "Delete permanently",
					deletePhraseError: "Type exactly EXCLUIR to continue.",
					statusOk: "Valid",
					statusInvalid: "Invalid",
					download: "Download",
					sectionRestore: "Restore from file",
					restoreIntro:
						"Upload a ZIP produced by this app (same format). The backup DB engine must match the server (MySQL or PostgreSQL).",
					selectFile: "Choose .zip file",
					previewTitle: "Preview",
					previewDb: "Database in backup: {{name}}",
					previewDialect: "Engine: {{d}}",
					previewVersion: "App version in backup: {{v}}",
					confirmLabel: "Confirmation",
					confirmHelper: "To confirm restore, type: RESTAURAR",
					restoreButton: "Restore (current DB will be overwritten)",
					restoreConfirmError: "Type exactly RESTAURAR to continue.",
					modalTitle: "Confirm restore",
					modalBody:
						"This replaces the current database and public folder. A safety backup is created automatically first. Restart the backend after success.",
					modalConfirm: "Yes, restore",
					toasts: {
						generated: "Backup created successfully.",
						uploadValidated: "File accepted. Confirm to restore.",
						restored: "Restore completed.",
						autoSaved: "Backup schedule saved.",
						deleted: "Backup removed from the server.",
					},
					futureHint:
						"Cloud upload (S3, Drive, etc.) will come in a later phase. The manifest already stores the backup origin (manual, automatic, pre-restore).",
				},
				superAdmins: {
					title: "Super Admins",
					subtitle:
						"Users with global administrative access to the platform. Promote, edit details, and reset passwords safely.",
					promoteAction: "Promote user",
					tableTitle: "Super administrators",
					colName: "Name",
					colEmail: "Email",
					colSuper: "Super admin",
					colCompany: "Company",
					colProfile: "Profile",
					colOnline: "Status",
					colActions: "Actions",
					yes: "Yes",
					no: "No",
					edit: "Edit",
					editTitle: "Edit user",
					fieldName: "Name",
					fieldEmail: "Email",
					fieldProfile: "Profile",
					fieldSuper: "Platform super administrator",
					fieldPassword: "New password (optional)",
					passwordHint: "Leave blank to keep the current password.",
					cancel: "Cancel",
					save: "Save",
					promoteTitle: "Promote to super admin",
					promoteHint:
						"Search by name or email (at least 2 characters). The user will gain access to the Platform panel.",
					searchPlaceholder: "Search user…",
					alreadySuper: "Already a super admin",
					promote: "Promote",
					close: "Close",
					confirmDemoteSelf:
						"Are you sure you want to remove your own super admin privilege? You may lose access to the Platform panel.",
					toastSaved: "Changes saved.",
					toastPromoted: "User promoted to super admin.",
				},
				myAccount: {
					title: "My account",
					subtitle: "Update your name, email, and platform password.",
					formTitle: "Account details",
					fieldName: "Name",
					fieldEmail: "Email",
					fieldPassword: "New password (optional)",
					passwordHint: "Leave blank to keep the current password.",
					save: "Save changes",
					toastSaved: "Profile updated successfully.",
				},
			},
			queueIntegration: {
				title: "Automations by queue",
				pageSubtitle:
					"Integration records linked to queues or the WhatsApp connection. Different types behave differently — Webhook/N8N only POST data; Flowbuilder and Typebot handle the conversation in attendance.",
				pageIntro:
					"For Webhook or N8N, this sends data to an external system but does not receive responses automatically in the ticket. Create records here and link them under Queues (and optionally the connection). For automated replies to the customer on WhatsApp, use Flowbuilder or Typebot.",
				table: {
					id: "ID",
					type: "Type",
					categoryInternal: "Internal",
					categoryExternal: "External",
					categoryLegacy: "Legacy",
					name: "Name",
					projectName: "Project Name",
					language: "Language",
					lastUpdate: "Last update",
					actions: "Actions",
				},
				buttons: {
					add: "Add automation",
				},
				searchPlaceholder: "Search...",
				toasts: {
					deleted: "Automation deleted successfully.",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "Are you sure? This action cannot be undone! It will be removed from linked queues and connections",
				},
			},
			files: {
				title: "File List",
				table: {
					name: "Name",
					contacts: "Contacts",
					actions: "Action",
				},
				toasts: {
					deleted: "List deleted successfully!",
					deletedAll: "All lists deleted successfully!",
				},
				buttons: {
					add: "Add",
					deleteAll: "Delete All",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteAllTitle: "Delete All",
					deleteMessage: "Are you sure you want to delete this list?",
					deleteAllMessage: "Are you sure you want to delete all lists?",
				},
			},
			messagesAPI: {
				title: "WhatsApp sending API",
				subtitle:
					"Send messages from external systems over HTTP using the token of the selected WhatsApp connection.",
				copySuccess: "URL copied to clipboard.",
				sections: {
					overview: "Overview",
					token: "How to get the token",
					endpoint: "Endpoint and authentication",
					requestBodies: "Request formats",
					responses: "HTTP responses",
					testText: "Test text message",
					testMedia: "Test media message",
				},
				overviewP1:
					"This page documents the WhatsApp outbound message API. Each token belongs to a single connection (line / number) in your company.",
				overviewP2:
					"The token is not created here: open Connections, edit the desired connection, and generate or copy the token. That secret identifies which connection will send messages.",
				tokenSteps:
					"Open Connections, pick the connection that should send messages, edit it, and generate the token. Store it securely — anyone with the token can send messages through that connection.",
				openConnections: "Go to Connections",
				endpointUrlLabel: "Endpoint URL",
				endpointUrlHelp:
					"Use this exact URL in integrations (server, Postman, or scripts).",
				methodLabel: "HTTP method",
				authTitle: "Required header",
				authLine: "Authorization: Bearer <token>",
				authHelp:
					"Replace <token> with the value generated in Connections for the chosen connection.",
				contentTypeJson: "Content-Type: application/json (text only)",
				contentTypeMultipart:
					"Content-Type: multipart/form-data (file upload)",
				jsonBodyTitle: "JSON body (text)",
				jsonBodyExample:
					'{ "number": "5511999999999", "body": "Your message here" }',
				multipartBodyTitle: "Multipart (media)",
				multipartFields:
					"Fields: number (text), medias (file). Optional body may be used as caption depending on the backend.",
				numberFormatTitle: "Number format",
				numberFormatText:
					"Digits only, with country code and area code, no spaces or symbols. Example: 5511999999999.",
				responsesIntro: "Common responses from this API:",
				responses: {
					r200: "200 — Request processed successfully (body may include a confirmation message).",
					r401:
						"401 — Invalid or missing token (ERR_INVALID_API_TOKEN).",
					r403:
						"403 — Plan does not allow external API (ERR_EXTERNAL_API_NOT_ALLOWED).",
					r429: "429 — Rate limit exceeded (ERR_RATE_LIMIT_EXCEEDED).",
					r400:
						"400 — Validation or send error (e.g. ERR_MESSAGE_SEND_FAILED with optional message).",
				},
				textMessage: {
					number: "Recipient number",
					body: "Message text",
					token: "Connection token (Bearer)",
					tokenPlaceholder: "Paste the token from Connections",
					tokenHelper:
						"Each token maps to one WhatsApp connection. Do not share it publicly.",
					numberPlaceholder: "5511999999999",
					numberHelper:
						"Digits only, with country and area code, no mask.",
				},
				mediaMessage: {
					number: "Recipient number",
					body: "File name",
					media: "File",
					token: "Connection token (Bearer)",
					tokenPlaceholder: "Paste the token from Connections",
					tokenHelper:
						"The same token as for text, for the connection that will send the file.",
					numberPlaceholder: "5511999999999",
					numberHelper:
						"Digits only, with country and area code, no mask.",
					chooseFile: "Choose file",
					noFile: "No file selected",
					fileRequired: "Select a file to send.",
				},
				test: {
					endpointReadonly: "Endpoint (read-only)",
					textIntro:
						"Fill in the connection token, number, and message. The request is sent as JSON to the same endpoint documented above.",
					mediaIntro:
						"Use the same endpoint with multipart: number, file in medias, and token in the header.",
					noResultYet: "No test run yet. The result will appear here.",
					resultOk: "Success — HTTP {{status}}",
					resultErr: "Request failed",
					resultErrStatus: "Failed — HTTP {{status}}",
				},
				toasts: {
					unauthorized:
						"This company is not allowed to access this page. Redirecting…",
					success: "Message sent successfully!",
				},
				buttons: {
					send: "Send test",
				},
			},
			notifications: {
				title: "Notifications",
				noTickets: "No notifications.",
			},
			quickMessages: {
				title: "Quick Responses",
				searchPlaceholder: "Search by shortcut or message text…",
				noAttachment: "No attachment",
				empty: {
					title: "No quick responses found",
					subtitle: "Adjust your search or create a shortcut for use with / in the chat.",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage:
						"The chat list will refresh. This action cannot be undone.",
				},
				validation: {
					shortcodeRequired: "Enter a shortcut",
					shortcodeMin: "At least 2 characters",
					shortcodeMax: "At most 80 characters",
					messageRequired: "Enter a message",
					messageMax: "Message is too long",
					categoryMax: "At most 120 characters",
				},
				buttons: {
					add: "Add",
					attach: "Attach File",
					cancel: "Cancel",
					edit: "Edit",
					delete: "Delete",
				},
				toasts: {
					success: "Quick response saved!",
					deleted: "Quick response deleted.",
					deletedMedia: "Attachment removed.",
				},
				dialog: {
					title: "Quick Message",
					shortcode: "Shortcut",
					shortcodeHint: "e.g. hi (use in chat: /hi)",
					shortcodeHelper: "Lowercased; avoid spaces inside the shortcut.",
					category: "Group / label (optional)",
					message: "Response",
					previewLabel: "Preview",
					previewEmpty: "(nothing typed)",
					save: "Save",
					cancel: "Cancel",
					geral: "Allow edit",
					add: "Add",
					edit: "Edit",
					visao: "Allow view",
				},
				table: {
					shortcode: "Shortcut",
					category: "Group",
					messagePreview: "Message preview",
					message: "Message",
					actions: "Actions",
					mediaName: "File Name",
					attachment: "Attachment",
					createdAt: "Created",
					updatedAt: "Updated",
					status: "Status",
				},
			},
			messageVariablesPicker: {
				label: "Available Variables",
				vars: {
					contactFirstName: "First Name",
					contactName: "Name",
					greeting: "Greeting",
					protocolNumber: "Protocol",
					date: "Date",
					hour: "Hour",
				},
			},
			contactLists: {
				title: "Contact Lists",
				table: {
					name: "Name",
					contacts: "Contacts",
					actions: "Actions",
				},
				buttons: {
					add: "New List",
				},
				dialog: {
					name: "Name",
					nameShort: "Short name",
					nameLong: "Long name",
					nameRequired: "Name is required",
					company: "Company",
					okEdit: "Edit",
					okAdd: "Add",
					add: "Add",
					edit: "Edit",
					cancel: "Cancel",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "This action cannot be undone.",
				},
				toasts: {
					deleted: "Record deleted",
					success: "Operation completed successfully",
				},
			},
			contactListItems: {
				title: "Contacts",
				searchPlaceholder: "Search",
				buttons: {
					add: "New",
					lists: "Lists",
					import: "Import",
				},
				download: "Click here to download example spreadsheet.",
				dialog: {
					name: "Name",
					nameShort: "Short name",
					nameLong: "Long name",
					nameRequired: "Name is required",
					number: "Number",
					numberShort: "Short number",
					numberLong: "Long number",
					whatsapp: "WhatsApp",
					email: "Email",
					emailInvalid: "Invalid email",
					okEdit: "Edit",
					okAdd: "Add",
					add: "Add",
					edit: "Edit",
					cancel: "Cancel",
				},
				table: {
					name: "Name",
					number: "Number",
					whatsapp: "WhatsApp",
					email: "Email",
					actions: "Actions",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "This action cannot be undone.",
					importMessage: "Do you want to import contacts from this spreadsheet? ",
					importTitle: "Import",
				},
				toasts: {
					deleted: "Record deleted",
				},
			},
			campaigns: {
				title: "Campaigns",
				pageSubtitle: "Sends by contact list and WhatsApp connection.",
				searchPlaceholder: "Search",
				report: {
					title: "Report of",
					title2: "Campaign",
					of: "of",
					validContacts: "Valid contacts",
					delivered: "Delivered",
					connection: "Connection",
					contactList: "Contact List",
					schedule: "Schedule",
					conclusion: "Conclusion",
				},
				config: {
					interval: "Intervals",
					randomInterval: "Random Send Interval",
					biggerInterval: "Larger Interval After",
					greaterInterval: "Greater Send Interval",
					noInterval: "No Interval",
					second: "second",
					seconds: "seconds",
					notDefined: "Not defined",
					addVariable: "Add Variable",
					save: "Save Settings",
					shortcut: "Shortcut",
					content: "Content",
					close: "Close",
					add: "Add",
				},
				buttons: {
					add: "New Campaign",
					contactLists: "Contact Lists",
				},
				loading: "Loading campaigns…",
				empty: {
					title: "No campaigns yet",
					subtitle:
						"Create a campaign to send bulk messages to your contact lists.",
				},
				status: {
					inactive: "Inactive",
					programmed: "Scheduled",
					inProgress: "In progress",
					canceled: "Canceled",
					finished: "Finished",
				},
				table: {
					name: "Name",
					whatsapp: "Connection",
					contactList: "Contact List",
					status: "Status",
					progress: "Progress",
					progressLine: "{{pct}}% done ({{sent}}/{{total}})",
					failedLine: "Failed: {{failed}}",
					retryFailed: "Retry failed",
					scheduledAt: "Schedule",
					completedAt: "Completed",
					confirmation: "Confirmation",
					actions: "Actions",
					notDefined: "Not defined",
					notDefined2: "Not defined",
					notScheduled: "Not scheduled",
					notConcluded: "Not concluded",
					stopCampaign: "Stop Campaign",
					resumeCampaign: "Resume campaign",
					report: "Report",
					edit: "Edit",
					delete: "Delete",
				},
				dialog: {
					new: "New Campaign",
					update: "Edit Campaign",
					readonly: "View Only",
					contactStats: {
						title: "Campaign audience",
						loading: "Counting contacts…",
						tagOnlyHint:
							"The list will be built on save based on the selected tag.",
						line: "Total: {{total}} · Valid (WhatsApp): {{valid}} · Invalid: {{invalid}}",
					},
					preview: {
						title: "Preview (sample)",
						mockLine:
							"Sample: Name: João · Number: 5511999999999 · variables {nome}, {numero}, {email}",
						empty: "(no text in this message)",
					},
					confirmSend: {
						title: "Confirm send",
						messageWithCount:
							"You are about to send a campaign to {{count}} valid contacts.",
						tagOnly:
							"The list will be generated on save. Continue?",
						generic: "Save this campaign?",
						confirm: "Confirm send",
					},
					confirmRestart: {
						title: "Restart sends",
						message:
							"The campaign will resume. Already sent contacts will not be sent again. Continue?",
						confirm: "Confirm",
					},
					confirmRetryFailed: {
						title: "Retry failed sends",
						message:
							"Only failed contacts will be retried. Already delivered contacts will not be affected.",
						confirm: "Retry",
					},
					opsSummary: {
						title: "Send status",
						line: "Valid (target): {{total}} · Sent: {{sent}} · Pending: {{pending}} · Failed: {{failed}}",
					},
					form: {
						name: "Name",
						nameShort: "Short name",
						nameLong: "Long name",
						helper: "Use variables like {name}, {number}, {email} or define custom variables.",
						nameRequired: "Name is required",
						message1: "Message 1",
						message2: "Message 2",
						message3: "Message 3",
						message4: "Message 4",
						message5: "Message 5",
						messagePlaceholder: "Message content",
						whatsapp: "Connection",
						status: "Status",
						scheduledAt: "Schedule",
						confirmation: "Confirmation",
						contactList: "Contact List",
						tagList: "Tag List",
						fileList: "File List",
					},
					buttons: {
						add: "Add",
						edit: "Update",
						okadd: "Ok",
						cancel: "Cancel Sends",
						restart: "Restart Sends",
						close: "Close",
						attach: "Attach File",
					},
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "This action cannot be undone.",
				},
				toasts: {
					configSaved: "Settings saved",
					success: "Operation completed successfully",
					cancel: "Campaign canceled",
					restart: "Campaign restarted",
					retryFailed: "Failed sends queued for retry",
					deleted: "Record deleted",
				},
			},
			subscription: {
				title: "Subscription",
				testPeriod: "Trial Period",
				remainingTest: "Your trial period ends in",
				remainingTest2: "days!",
				chargeEmail: "Billing email",
				signNow: "Sign up now!",
			},
			announcements: {
				active: "Active",
				inactive: "Inactive",
				title: "Announcements",
				searchPlaceholder: "Search",
				high: "High",
				medium: "Medium",
				low: "Low",
				buttons: {
					add: "New Announcement",
					contactLists: "Announcement Lists",
				},
				table: {
					priority: "Priority",
					title: "Title",
					text: "Text",
					mediaName: "File",
					status: "Status",
					actions: "Actions",
				},
				dialog: {
					edit: "Edit Announcement",
					add: "New Announcement",
					update: "Edit Announcement",
					readonly: "View Only",
					form: {
						priority: "Priority",
						required: "Required field",
						title: "Title",
						text: "Text",
						mediaPath: "File",
						status: "Status",
					},
					buttons: {
						add: "Add",
						edit: "Update",
						okadd: "Ok",
						cancel: "Cancel",
						close: "Close",
						attach: "Attach File",
					},
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "This action cannot be undone.",
				},
				toasts: {
					success: "Operation completed successfully",
					deleted: "Record deleted",
					info: "This company doesn't have permission to access this page! We are redirecting you.",
				},
			},
			campaignsConfig: {
				title: "Campaign Settings",
			},
			queues: {
				title: "Queues & Chatbot",
				searchPlaceholder: "Search queues...",
				table: {
					id: "ID",
					name: "Queue",
					color: "Color",
					tickets: "Tickets",
					users: "Users",
					greeting: "Greeting message",
					actions: "Actions",
					orderQueue: "Order (bot)",
					createdAt: "Created",
				},
				buttons: {
					add: "Add queue",
				},
				toasts: {
					success: "Queue deleted successfully.",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage: "Are you sure? This action cannot be undone if the system allows deletion.",
					deleteWarningInUse:
						"This queue is linked to {{tickets}} ticket(s) and {{users}} user(s). If deletion fails, remove links (connections, bot options and users from the queue).",
				},
				empty: {
					title: "No queues found",
					subtitle: "Adjust your search or add a new queue.",
				},
			},
			queueSelect: {
				inputLabel: "Queues",
			},
			users: {
				title: "Users",
				searchPlaceholder: "Search by name or email…",
				table: {
					id: "ID",
					name: "Name",
					email: "Email",
					profile: "Profile",
					queues: "Queues",
					online: "Status",
					tickets: "Tickets",
					createdAt: "Registered",
					actions: "Actions",
				},
				profileLabels: {
					admin: "Administrator",
					user: "User",
					supervisor: "Supervisor",
				},
				online: {
					yes: "Online",
					no: "Offline",
				},
				empty: {
					title: "No users found",
					subtitle: "Adjust your search or add a new user.",
				},
				buttons: {
					add: "Add user",
					edit: "Edit",
					delete: "Delete",
				},
				toasts: {
					deleted: "User deleted successfully.",
				},
				confirmationModal: {
					deleteTitle: "Delete",
					deleteMessage:
						"This removes the user and queue links. Deletion is blocked if there are assigned tickets — transfer them first.",
					deleteWarningTickets:
						"This user has {{count}} assigned ticket(s). Deletion will be blocked until tickets are transferred.",
				},
			},
			todolist: {
				pageTitle: "Personal list (saved in this browser)",
				pageSubtitle:
					"Notes stay on this device only — they are not synced to the server or other users.",
				notice:
					"These notes are stored only in this browser and are not shared with your team.",
				emptyNoItems: "No notes yet. Add one above.",
				emptyFilter: "No notes match this filter.",
				storageParseError:
					"Could not load your notes. Invalid data was cleared.",
				storageWriteError:
					"Could not save (browser storage may be full or blocked).",
				input: "New note",
				completedAria: "Mark as done",
				filter: {
					label: "Show:",
					all: "All",
					pending: "Open",
					completed: "Done",
				},
				buttons: {
					add: "Add",
					save: "Save",
					typeTask: "Type a note to add",
				},
			},
			helps: {
				title: "Help Center",
			},
			evaluation: {
				title: "Evaluation",
				pageSubtitle: "Scores 1–3 after closing, sent via WhatsApp.",
				flowInfo:
					"When ratings are enabled, closing a ticket sends a WhatsApp score request (1–3). The ticket only closes after a valid reply.",
				scaleHint: "1 = unsatisfied · 2 = satisfied · 3 = very satisfied",
				listHint: "Each row is a WhatsApp response; click to open the ticket.",
				dashboard: {
					cardTitle: "Average rating",
					scaleLine: "Scale 1–3 (WhatsApp)",
					statusPrefix: "Indicator:",
					status: {
						great: "Great",
						good: "Good",
						improve: "Needs improvement",
					},
				},
				avgRating: "Average Rating",
				totalRatings: "Total Ratings",
				byAttendant: "By Attendant",
				searchPlaceholder: "Search by contact or attendant...",
				noRatings: "No ratings found in this period.",
				loadMore: "Load more",
				dateFrom: "From",
				dateTo: "To",
				table: {
					date: "Date",
					contact: "Contact",
					attendant: "Attendant",
					setor: "Sector",
					rating: "Score",
					ratingSub: "1 to 3",
				},
			},
			schedules: {
				title: "Schedules",
				pageSubtitle: "{{count}} schedule(s) loaded.",
				searchPlaceholder: "Search schedules…",
				typeSingle: "One-time",
				typeRecurring: "Recurring",
				paused: "Paused",
				active: "Active",
				contactsCount: "{{count}} contact(s)",
				nextRun: "Next run",
				companyTimezoneShort: "TZ",
				frequencyShort: {
					daily: "Daily",
					weekly: "Weekly",
					monthly: "Monthly",
				},
				listIntro:
					"List of schedules (one-time or recurring). Mass campaigns are under Campaigns.",
				loading: "Loading schedules…",
				empty: {
					title: "No schedules yet",
					subtitle:
						"Schedule one-time or recurring sends to selected contacts.",
				},
				statusLabels: {
					PENDENTE: "Pending",
					AGENDADA: "Queued",
					ENVIADA: "Sent",
					ERRO: "Error",
					AGUARDANDO_CONEXAO: "Waiting for connection",
				},
				preferredShort: "Preferred",
				confirmationModal: {
					deleteTitle: "Are you sure you want to delete this Schedule?",
					deleteMessage: "This action cannot be undone.",
				},
				table: {
					contact: "Contact",
					type: "Type",
					recurrence: "Frequency",
					contacts: "Contacts",
					nextRun: "Next run",
					body: "Message",
					sendAt: "Schedule Date",
					sentAt: "Send Date",
					status: "Status",
					actions: "Actions",
				},
				messages: {
					date: "Date",
					time: "Time",
					event: "Event",
					allDay: "All Day",
					week: "Week",
					work_week: "Schedules",
					day: "Day",
					month: "Month",
					previous: "Previous",
					next: "Next",
					yesterday: "Yesterday",
					tomorrow: "Tomorrow",
					today: "Today",
					agenda: "Agenda",
					noEventsInRange: "No schedules in this period.",
					showMore: "more",
				},
				buttons: {
					add: "New Schedule",
					pause: "Pause",
					resume: "Resume",
					edit: "Edit schedule",
					delete: "Delete schedule",
				},
				toasts: {
					deleted: "Schedule deleted successfully.",
				},
			},
			tags: {
				title: "Tags",
				searchPlaceholder: "Search tags...",
				confirmationModal: {
					deleteTitle: "Delete this tag?",
					deleteMessage: "This action cannot be undone.",
					deleteWarningInUse:
						"This tag is linked to {{count}} ticket(s). Campaigns may also reference it. If deletion fails, remove links first.",
					deleteAllMessage: "Are you sure you want to delete all Tags?",
					deleteAllTitle: "Delete All",
				},
				table: {
					name: "Tag",
					color: "Color",
					usage: "Usage",
					tickets: "Usage (tickets)",
					createdAt: "Created",
					actions: "Actions",
				},
				buttons: {
					add: "New tag",
					deleteAll: "Delete All",
				},
				toasts: {
					deletedAll: "All Tags deleted successfully!",
					deleted: "Tag deleted successfully.",
				},
				empty: {
					title: "No tags found",
					subtitle: "Create a tag or adjust your search.",
				},
			},
			settings: {
				schedulesUpdated: "Schedules updated successfully.",
				success: "Settings saved successfully.",
				pageSubtitle:
					"Options and schedules for this company (timezone, WhatsApp, business hours). Global management is under Platform.",
				customPageIntro:
					"This page applies to the current company. Super Admins: companies, plans, global help, and branding are under Platform.",
				companiesRelocated:
					"Company management has moved to Platform → Companies to keep the Super Admin experience in one place.",
				companiesRelocatedAction: "Open Platform → Companies",
				plansRelocated:
					"Plan catalog management is now under Platform → Plans to avoid duplication and keep the Super Admin panel organized.",
				plansRelocatedAction: "Open Platform → Plans",
				helpsRelocated:
					"Global help content (tutorials/links) is now managed under Platform → Help content.",
				helpsRelocatedAction: "Open Platform → Help content",
				superPlatformCard: {
					title: "Global platform management",
					body:
						"Companies, plans, help content, and announcements are managed under Platform. Use the shortcuts below.",
				},
				title: "Settings",
				tabs: {
					options: "Options",
					schedules: "Schedules",
					companies: "Companies",
					plans: "Plans",
					helps: "Help",
				},
				options: {
					pageIntro:
						"These options change WhatsApp behavior and flows for all tickets in this company.",
					expedientCompanyWarning:
						"Company mode: one business-hours rule applies to the whole company. Queue mode: each queue uses its own.",
					toasts: {
						success: "Operation updated successfully.",
					},
					integrations: {
						asaasNotice:
							"The API token grants access to your Asaas account. Store it securely and limit who can change it.",
					},
					fields: {
						ratings: {
							title: "Ratings",
							disabled: "Disabled",
							enabled: "Enabled",
						},
						expedientManager: {
							title: "Business Hours Management",
							queue: "Queue",
							company: "Company",
						},
						ignoreMessages: {
							title: "WhatsApp group messages",
							alertNotice:
								"Receive: group chats stay under the Groups tab (manual, no automations). Ignore: group messages are not recorded.",
							helperText:
								"Receive in the Groups tab: messages create or update conversations only under the Groups tab, in manual mode (no chatbot and no automations).\nIgnore groups: group messages are not saved and do not enter the system.",
							optionReceive: "Receive in Groups tab (manual, no automations)",
							optionIgnore: "Ignore groups (do not enter the system)",
						},
						acceptCall: {
							title: "Accept WhatsApp calls",
							alertNotice:
								"Accept: calls behave as usual in WhatsApp. Do not accept: the system rejects calls and may send the message configured below.",
							helperText:
								"Yes: voice/video calls behave as usual; the system does not interfere.\nNo: incoming calls are rejected automatically; you can optionally send a message to the contact below.",
							disabled: "No, do not accept",
							enabled: "Yes, accept",
							rejectSendTitle: "Send message when rejecting call",
							rejectSendYes: "Yes",
							rejectSendNo: "No",
							rejectMessageLabel: "Automatic message when rejecting call",
							rejectMessagePlaceholder:
								"E.g.: This number does not accept calls. Please send a text message and we will reply here.",
							rejectMessageHelper:
								"Leave blank to use the company default text. Saved when you leave the field.",
						},
						chatbotType: {
							title: "Chatbot Type",
							text: "Text",
						},
						sendGreetingAccepted: {
							title: "Send greeting when accepting ticket",
						},
						sendMsgTransfTicket: {
							title: "Send message on Queue/agent transfer",
						},
						sendGreetingMessageOneQueues: {
							title: "Send greeting when there's only 1 queue",
						},
						disabled: "Disabled",
						active: "Active",
						enabled: "Enabled",
					},
					updating: "Updating...",
					tabs: {
						integrations: "INTEGRATIONS",
					},
				},
				helps: {
					toasts: {
						errorList: "Could not load records list",
						errorOperation: "Could not complete operation",
						error: "Could not complete operation. Check if help with the same name exists or if fields were filled correctly",
						success: "Operation completed successfully!",
					},
					buttons: {
						clean: "Clear",
						delete: "Delete",
						save: "Save",
					},
					grid: {
						title: "Title",
						description: "Description",
						video: "Video",
					},
					confirmModal: {
						title: "Delete Record",
						confirm: "Do you really want to delete this record?",
					},
				},
				company: {
					toasts: {
						errorList: "Could not load records list",
						errorOperation: "Could not complete operation",
						error: "Could not complete operation. Check if company with same name exists or if fields were filled correctly",
						success: "Operation completed successfully!",
					},
					confirmModal: {
						title: "Delete Record",
						confirm: "Do you really want to delete this record?",
					},
					form: {
						name: "Name",
						primaryAdmin: "Primary admin",
						noPrimaryAdmin: "No admin assigned",
						email: "Email",
						emailMain: "Primary email",
						phone: "Phone",
						sectionCompanyData: "Company details",
						sectionCompanyDataHint:
							"Core identification and contact details — including the primary admin linked to this company.",
						sectionPlanOperation: "Plan & operations",
						sectionPlanOperationHint:
							"Contractual and operational settings: plan, account status, timezone, and billing / due cycle.",
						editingBanner: "Editing: {{name}}",
						editingContextHint:
							"Changes in the form below apply only to this company.",
						plan: "Plan",
						status: "Status",
						yes: "Yes",
						no: "No",
						campanhas: "Campaigns",
						enabled: "Enabled",
						disabled: "Disabled",
						dueDate: "Due date",
						recurrence: "Recurrence",
						monthly: "Monthly",
						expire: "Expiration",
						createdAt: "Created On",
						timezone: "Company timezone",
						timezoneHint:
							"Schedules and recurrences use this timezone; data is still stored in UTC.",
						timezoneFooter:
							"Choose the timezone for your main office or operation.",
						timezoneHelperField:
							"IANA format as in the list below (e.g. America/Sao_Paulo).",
						usersSectionTitle: "Company users",
						usersSectionHint:
							"Read-only list of users linked to this company (no management here).",
						usersEmpty: "No users found for this company.",
						modulesSectionTitle: "Enabled modules (company)",
						modulesSectionHint:
							"Complements the plan: turning off hides the module and blocks use when the plan allows the feature.",
						modulesSectionHintV2:
							"When you pick a plan, modules that mirror the plan are loaded automatically. You can then enable or disable per company; the label shows whether it matches the plan or is a local override.",
						modules: {
							useKanban: "Kanban",
							useKanbanHelp: "Kanban board in customer service.",
							useCampaigns: "Campaigns",
							useCampaignsHelp: "Lists, broadcasts and campaign reports.",
							useFlowbuilders: "Flows (chatbot)",
							useFlowbuildersHelp: "Flow builder, triggers and WhatsApp-linked flows.",
							useOpenAi: "OpenAI / Prompts",
							useOpenAiHelp: "Prompts and AI features.",
							useSchedules: "Schedules",
							useSchedulesHelp: "Scheduled messages and recurrence.",
							useExternalApi: "WhatsApp API (external send)",
							useExternalApiHelp: "HTTP token for sending messages via API.",
							useIntegrations: "Queue integrations",
							useIntegrationsHelp: "Webhooks, N8N, Typebot and queue automations.",
							useGroups: "WhatsApp groups",
							useGroupsHelp: "Group management in customer service.",
						},
					},
					buttons: {
						clear: "Clear",
						delete: "Delete",
						expire: "+ Expiration",
						user: "User",
						manageUsers: "Manage users",
						adjustDueDate: "Adjust due date",
						save: "Save",
						saveTimezone: "Save timezone",
					},
				},
				schedules: {
					form: {
						weekday: "Weekday",
						initialHour: "Start Time",
						finalHour: "End Time",
						save: "Save",
					},
				},
				settings: {
					userCreation: {
						name: "User creation",
						options: {
							enabled: "Enabled",
							disabled: "Disabled",
						},
					},
				},
			},
			messagesList: {
				header: {
					assignedTo: "Assigned to:",
					buttons: {
						return: "Return",
						resolve: "Resolve",
						reopen: "Reopen",
						accept: "Accept",
						download: "Download",
						flowHistory: "Flow history",
					},
				},
				lostCall: "Missed voice/video call at",
				deletedMessage: "This message was deleted by the contact",
				edited: "Edited",
				saudation: "Say hello to your new contact!",
			},
			messagesInput: {
				placeholderOpen: "Type a message",
				placeholderClosed: "Reopen or accept this ticket to send a message.",
				signMessage: "Sign",
				sticker: "Send sticker (WebP)",
				stickerOnlyWebp: "Sticker must be a .webp file",
			},
			contactDrawer: {
				header: "Contact Information",
				hiddenNumber: "Hidden number (WhatsApp privacy)",
				buttons: {
					edit: "Edit contact",
				},
				extraInfo: "Other information",
			},
			fileModal: {
				title: {
					add: "Add file list",
					edit: "Edit file list",
				},
				buttons: {
					okAdd: "Save",
					okEdit: "Edit",
					cancel: "Cancel",
					fileOptions: "Add file",
				},
				form: {
					name: "File list name",
					message: "List details",
					fileOptions: "File list",
					extraName: "Message to send with file",
					extraValue: "Option value",
				},
				formErrors: {
					name: {
						required: "Name is required",
						short: "Name is too short",
					},
					message: {
						required: "Message is required",
					},
				},
				success: "File list saved successfully!",
			},
			ticketOptionsMenu: {
				schedule: "Schedule",
				delete: "Delete",
				transfer: "Transfer",
				registerAppointment: "Contact Notes",
				appointmentsModal: {
					title: "Contact Notes",
					textarea: "Note",
					placeholder: "Enter the information you want to record here",
				},
				confirmationModal: {
					title: "Delete ticket",
					titleFrom: "from contact ",
					message: "Warning! All messages related to this ticket will be lost.",
				},
				buttons: {
					delete: "Delete",
					cancel: "Cancel",
				},
			},
			confirmationModal: {
				buttons: {
					confirm: "Ok",
					cancel: "Cancel",
				},
			},
			messageOptionsMenu: {
				delete: "Delete",
				reply: "Reply",
				confirmationModal: {
					title: "Delete message?",
					message: "This action cannot be undone.",
				},
			},
			flowBuilderSimulator: {
				openFab: "Test flow",
				title: "Flow simulation",
				subtitle: "No real WhatsApp delivery · Local preview",
				badgeSimulation: "Preview",
				currentStep: "Current step",
				noStepYet: "Walk the flow to see the current step.",
				placeholder: "Type a message…",
				send: "Send",
				restart: "Restart",
				restartFull: "Restart simulation",
				close: "Close",
				yes: "Yes",
				no: "No",
				noStart: "There is no Start block. Add a Start node to simulate.",
				noEdgeFromStart: "Connect an edge from the Start block.",
				ended: "— End of simulation —",
				noWaitHint:
					"Outside steps that wait for input, use Restart for a new test.",
				menuPlaceholder:
					"Option number or invalid text to test the red branch…",
				simulatedActionBadge: "Simulated action",
				notExecutedPreview: "Not run in preview · no external calls",
				actionHttp: "HTTP request",
				actionOpenai: "OpenAI",
				actionTypebot: "Typebot",
				actionAdmin: "Admin action ({{type}})",
				actionGeneric: "Step type “{{type}}”",
				conditionManualTitle: "Manual choice required",
				conditionManual: {
					variableOrTicket:
						"This condition uses a variable or ticket data, which the preview cannot resolve. Choose whether the result would be true or false.",
					unknownField:
						"This context or contact field is not available in the simulator. Pick yes / no as if the rule failed or passed.",
				},
				singleBlockEmpty: "Empty content block — add items in the flow editor.",
				nodeType: {
					message: "Message",
					menu: "Menu",
					condition: "Condition",
					singleBlock: "Content block",
					question: "Question",
					waitForInteraction: "Wait for interaction",
					interval: "Interval",
					img: "Image",
					audio: "Audio",
					video: "Video",
					randomizer: "Randomizer",
					start: "Start",
					httpRequest: "HTTP",
					ticket: "Ticket",
					sector: "Queue",
					tag: "Tag",
					closeTicket: "Close ticket",
					attendant: "Agent",
					notification: "Notification",
					blacklist: "Blacklist",
					flowUp: "Parent flow",
					openai: "OpenAI",
					typebot: "Typebot",
				},
			},
			flowBuilderMenu: {
				createHint:
					"After adding the node, connect the red output (invalid option) and, if you use a wait time, the orange one (no reply), to avoid conversations stuck in the bot.",
				warningsHeader: "Warnings (do not block saving)",
				warnings: {
					missing_invalid: {
						short: "No invalid branch",
						detail:
							"The red “Invalid option” output is not connected. If the customer replies outside the menu, the flow may stop without routing.",
					},
					timeout_no_edge: {
						short: "Timeout without output",
						detail:
							"You set a wait time (> 0 s) but the orange “No reply” output is not connected. The timeout will have nowhere to go.",
					},
					timeout_edge_no_time: {
						short: "Timeout wire but no time",
						detail:
							"The orange “No reply” output is connected but the time is 0. Set seconds or remove the edge to avoid an inconsistent setup.",
					},
					no_option_edges: {
						short: "Options not wired",
						detail:
							"The menu has options but none of the numbered (blue) outputs are connected. The customer cannot proceed on any valid choice.",
					},
				},
			},
			errors: {
				connectionError: "Could not connect to server. Check the backend URL and if the server is online.",
				generic: "An error occurred. Please try again.",
				operationFailed: "Could not complete the action. Please try again.",
			},
			backendErrors: {
				ERR_INTERNAL_SERVER_ERROR: "An unexpected error occurred. Please try again later",
				ERR_NO_OTHER_WHATSAPP: "There must be at least one default WhatsApp.",
				ERR_NO_DEF_WAPP_FOUND: "No default WhatsApp found. Check the connections page.",
				ERR_WAPP_NOT_INITIALIZED: "This WhatsApp session hasn't been initialized. Check the connections page.",
				ERR_WAPP_CHECK_CONTACT: "Couldn't verify WhatsApp contact. Check the connections page",
				ERR_WAPP_INVALID_CONTACT: "This is not a valid WhatsApp number.",
				ERR_WAPP_DOWNLOAD_MEDIA: "Couldn't download WhatsApp media. Check the connections page.",
				ERR_INVALID_CREDENTIALS: "Authentication error. Please try again.",
				ERR_USER_DONT_EXISTS: "User not found. Check the provided email.",
				ERR_SENDING_WAPP_MSG: "Error sending WhatsApp message. Check the connections page.",
				ERR_DELETE_WAPP_MSG: "Couldn't delete WhatsApp message.",
				ERR_OTHER_OPEN_TICKET: "There's already an open ticket for this contact.",
				ERR_SESSION_EXPIRED: "Session expired. Please log in.",
				ERR_USER_CREATION_DISABLED: "User creation has been disabled by the administrator.",
				ERR_NO_PERMISSION: "You don't have permission to access this resource.",
				ERR_MODULE_NOT_ALLOWED:
					"This module is not enabled for your company (plan or platform settings).",
				ERR_DUPLICATED_CONTACT: "A contact with this number already exists.",
				ERR_NO_SETTING_FOUND: "No settings found with this ID.",
				ERR_NO_CONTACT_FOUND: "No contact found with this ID.",
				ERR_NO_TICKET_FOUND: "No ticket found with this ID.",
				ERR_NO_USER_FOUND: "No user found with this ID.",
				ERR_NO_WAPP_FOUND: "No WhatsApp found with this ID.",
				ERR_CREATING_MESSAGE: "Error creating message in database.",
				ERR_CREATING_TICKET: "Error creating ticket in database.",
				ERR_FETCH_WAPP_MSG: "Error fetching WhatsApp message, it might be too old.",
				ERR_QUEUE_COLOR_ALREADY_EXISTS: "This color is already in use, choose another.",
				ERR_QUEUE_DUPLICATE_NAME:
					"A queue with this name already exists for this company.",
				ERR_QUEUE_DUPLICATE:
					"This queue already exists or conflicts with another record in the company.",
				ERR_WAPP_GREETING_REQUIRED: "Greeting message is required when there is more than one queue.",
				ERR_CAMPAIGN_NOT_FOUND: "Campaign not found.",
				ERR_CAMPAIGN_INVALID_STATUS:
					"This action is not allowed for the current campaign status.",
				ERR_CAMPAIGN_EMPTY_LIST: "Select a contact list or a tag.",
				ERR_CAMPAIGN_NO_VALID_CONTACTS:
					"There are no valid contacts to send in this list.",
				ERR_CAMPAIGN_TAG_REQUIRED: "A tag is required for the estimate.",
				ERR_CAMPAIGN_NO_FAILED_TO_RETRY:
					"There are no failed sends to retry for this campaign.",
				ERR_INVALID_API_TOKEN:
					"Invalid or missing API token. Check the Authorization: Bearer header.",
				ERR_EXTERNAL_API_NOT_ALLOWED:
					"Your company plan does not allow the external API. Upgrade the plan or contact support.",
				ERR_RATE_LIMIT_EXCEEDED:
					"Per-minute request limit exceeded. Wait and try again.",
				ERR_MESSAGE_SEND_FAILED:
					"The message could not be sent.",
				ERR_INVOICE_NOT_FOUND: "Invoice not found.",
				ERR_FORBIDDEN_INVOICE: "This invoice does not belong to your company.",
				ERR_INVOICE_ALREADY_PAID: "This invoice is already paid.",
				ERR_SUBSCRIPTION_VALIDATION: "Invalid data to generate PIX. Try again.",
				ERR_SUBSCRIPTION_PIX_CREATE:
					"Could not create PIX charge. Try again or contact support.",
				ERR_SUBSCRIPTION_WEBHOOK_CONFIG_VALIDATION: "Invalid webhook configuration data.",
				ERR_WEBHOOK_UNAUTHORIZED: "Webhook not authorized (invalid token).",
				ERR_COMPANY_DELINQUENT:
					"Payment overdue: this action is paused until you settle in Billing (PIX).",
				ERR_NO_COMPANY_FOUND: "Company not found.",
				ERR_CANNOT_BLOCK_OWN_COMPANY:
					"You cannot block the company you are signed into.",
				ERR_CANNOT_DELETE_OWN_COMPANY:
					"You cannot delete the company you are signed into.",
				ERR_CANNOT_DELETE_COMPANY_WITH_SUPER:
					"You cannot delete a company that has a super admin user. Reassign or remove those users first.",
				ERR_INVALID_RECURRENCE:
					"Invalid or missing recurrence. Set MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUAL, or YEARLY on the company.",
				ERR_LAST_SUPER_ADMIN:
					"You cannot remove the last platform super administrator. Promote another user first.",
				ERR_EMAIL_IN_USE: "This email is already in use by another account.",
				FAVICON_TOO_LARGE: "Favicon: maximum size is 1 MB.",
				INVALID_FAVICON_TYPE: "Favicon: use PNG, JPG, ICO or SVG.",
			},
		}
	},
};

export { messages };