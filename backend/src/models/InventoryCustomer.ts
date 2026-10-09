import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import Contact from "./Contact";
import InventorySale from "./InventorySale";
import InventoryReceivable from "./InventoryReceivable";

export type InventoryCustomerType = "individual" | "company";

@Table({
  tableName: "InventoryCustomers",
  indexes: [
    {
      unique: true,
      name: "InventoryCustomers_id_companyId_unique",
      fields: ["id", "companyId"]
    },
    {
      name: "InventoryCustomers_company_name_idx",
      fields: ["companyId", "name"]
    },
    {
      name: "InventoryCustomers_company_phone_idx",
      fields: ["companyId", "phone"]
    },
    {
      name: "InventoryCustomers_company_isActive_idx",
      fields: ["companyId", "isActive"]
    }
  ]
})
class InventoryCustomer extends Model<InventoryCustomer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @AllowNull
  @ForeignKey(() => Contact)
  @Column
  contactId: number | null;

  @BelongsTo(() => Contact)
  contact: Contact;

  @Default("individual")
  @Column(DataType.STRING(16))
  type: InventoryCustomerType;

  @Column(DataType.STRING(255))
  name: string;

  @AllowNull
  @Column(DataType.STRING(255))
  tradeName: string | null;

  @AllowNull
  @Column(DataType.STRING(32))
  document: string | null;

  @AllowNull
  @Column(DataType.STRING(32))
  phone: string | null;

  @AllowNull
  @Column(DataType.STRING(255))
  email: string | null;

  @AllowNull
  @Column(DataType.STRING(16))
  postalCode: string | null;

  @AllowNull
  @Column(DataType.STRING(255))
  street: string | null;

  @AllowNull
  @Column(DataType.STRING(32))
  addressNumber: string | null;

  @AllowNull
  @Column(DataType.STRING(120))
  addressComplement: string | null;

  @AllowNull
  @Column(DataType.STRING(120))
  district: string | null;

  @AllowNull
  @Column(DataType.STRING(120))
  city: string | null;

  @AllowNull
  @Column(DataType.STRING(8))
  state: string | null;

  @AllowNull
  @Column(DataType.TEXT)
  notes: string | null;

  @Default(0)
  @Column(DataType.DECIMAL(12, 2))
  creditLimit: string | number;

  @Default(true)
  @Column
  isActive: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => InventorySale)
  sales: InventorySale[];

  @HasMany(() => InventoryReceivable)
  receivables: InventoryReceivable[];
}

export default InventoryCustomer;
