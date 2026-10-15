import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 8.3-B1 — Fundação segura Efí Pay (global da plataforma).
 * Aditiva: não altera tabelas financeiras existentes.
 * Não executar nesta etapa de implementação local sem aprovação de deploy.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("PlatformEfiConfigs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      slot: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true
      },
      efiEnvironment: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "empty"
      },
      clientIdEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      clientSecretEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      clientIdMasked: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      pixKeyEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pixKeyMasked: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      webhookSecretEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      webhookSecretConfigured: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      cobrancasClientIdEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cobrancasClientSecretEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      cobrancasClientIdMasked: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      /**
       * PKCS#12 cifrado (efic1:) — fonte durável.
       * docker-compose atual não monta volume para /app/certs.
       */
      certificateEncrypted: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      /** Chave opaca interna (não path de usuário). */
      certificateStorageKey: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      certificateFingerprint: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      certificateUploadedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastAuthTestAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastAuthTestOk: {
        type: DataTypes.BOOLEAN,
        allowNull: true
      },
      lastAuthTestMessage: {
        type: DataTypes.STRING(240),
        allowNull: true
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      activatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.addIndex("PlatformEfiConfigs", ["slot"], {
      unique: true,
      name: "platform_efi_configs_slot_unique"
    });

    await queryInterface.createTable("PlatformEfiConfigAudits", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      configId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "PlatformEfiConfigs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      slot: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      action: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      /** JSON sem secrets/certificados — apenas flags e máscaras. */
      diffSummary: {
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

    await queryInterface.addIndex("PlatformEfiConfigAudits", ["slot", "createdAt"], {
      name: "platform_efi_config_audits_slot_created_idx"
    });
    await queryInterface.addIndex("PlatformEfiConfigAudits", ["configId"], {
      name: "platform_efi_config_audits_config_id_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PlatformEfiConfigAudits");
    await queryInterface.dropTable("PlatformEfiConfigs");
  }
};
