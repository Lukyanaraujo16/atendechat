import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação financeira SaaS — migrations aditivas.
 * Não backfill de paidAt/método/txid em faturas legadas.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const invoiceTable = await queryInterface.describeTable("Invoices");

    const addInvoiceCol = async (name: string, def: Record<string, unknown>) => {
      if (!(name in invoiceTable)) {
        await queryInterface.addColumn("Invoices", name, def as any);
      }
    };

    await addInvoiceCol("competence", {
      type: DataTypes.STRING(7),
      allowNull: true
    });
    await addInvoiceCol("cycleKey", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await addInvoiceCol("planIdSnapshot", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await addInvoiceCol("planNameSnapshot", {
      type: DataTypes.STRING,
      allowNull: true
    });
    await addInvoiceCol("recurrenceSnapshot", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await addInvoiceCol("paidAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await addInvoiceCol("cancelledAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await addInvoiceCol("paymentSource", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await addInvoiceCol("externalTxid", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await addInvoiceCol("externalChargeId", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await addInvoiceCol("gatewayProvider", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await addInvoiceCol("gatewayStatus", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await addInvoiceCol("gatewaySyncStatus", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await addInvoiceCol("gatewaySyncError", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await addInvoiceCol("legacyUnknown", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Marcar faturas existentes sem origem conhecida (sem inventar paidAt)
    await queryInterface.sequelize.query(`
      UPDATE "Invoices"
      SET "legacyUnknown" = true
      WHERE "paymentSource" IS NULL
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "invoices_company_cycle_unique"
      ON "Invoices" ("companyId", "cycleKey")
      WHERE "cycleKey" IS NOT NULL AND "status" <> 'cancelled'
    `);

    await queryInterface.createTable("SaaSPayments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      method: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      countsAsRevenue: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      recordedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      externalTxid: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      externalChargeId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      gatewayProvider: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      gatewaySyncStatus: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      gatewaySyncError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("SaaSPayments", ["companyId"]);
    await queryInterface.addIndex("SaaSPayments", ["invoiceId"]);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saas_payments_external_txid_unique"
      ON "SaaSPayments" ("externalTxid")
      WHERE "externalTxid" IS NOT NULL
    `);

    await queryInterface.createTable("SaaSPaymentAttempts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      method: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending"
      },
      externalTxid: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      externalChargeId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      gatewayProvider: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      gatewayStatus: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      payloadSummary: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("SaaSPaymentAttempts", ["invoiceId"]);
    await queryInterface.addIndex("SaaSPaymentAttempts", ["externalTxid"]);

    await queryInterface.createTable("SaaSFinancialEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      paymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "SaaSPayments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      eventType: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      idempotencyKey: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("SaaSFinancialEvents", ["companyId"]);
    await queryInterface.addIndex("SaaSFinancialEvents", ["invoiceId"]);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saas_financial_events_idempotency_unique"
      ON "SaaSFinancialEvents" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);

    await queryInterface.createTable("SaaSSubscriptionRenewals", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      paymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "SaaSPayments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      reason: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      previousDueDate: {
        type: DataTypes.STRING(16),
        allowNull: true
      },
      newDueDate: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      recurrence: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      monthsAdded: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      idempotencyKey: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("SaaSSubscriptionRenewals", ["companyId"]);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "saas_renewals_idempotency_unique"
      ON "SaaSSubscriptionRenewals" ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);

    await queryInterface.createTable("SaaSReconciliationItems", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      invoiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Invoices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      paymentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "SaaSPayments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      kind: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending"
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      retryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastError: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("SaaSReconciliationItems", ["status"]);
    await queryInterface.addIndex("SaaSReconciliationItems", ["companyId"]);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("SaaSReconciliationItems");
    await queryInterface.dropTable("SaaSSubscriptionRenewals");
    await queryInterface.dropTable("SaaSFinancialEvents");
    await queryInterface.dropTable("SaaSPaymentAttempts");
    await queryInterface.dropTable("SaaSPayments");

    const cols = [
      "competence",
      "cycleKey",
      "planIdSnapshot",
      "planNameSnapshot",
      "recurrenceSnapshot",
      "paidAt",
      "cancelledAt",
      "paymentSource",
      "externalTxid",
      "externalChargeId",
      "gatewayProvider",
      "gatewayStatus",
      "gatewaySyncStatus",
      "gatewaySyncError",
      "legacyUnknown"
    ];
    for (const col of cols) {
      try {
        await queryInterface.removeColumn("Invoices", col);
      } catch {
        /* ignore */
      }
    }
  }
};
