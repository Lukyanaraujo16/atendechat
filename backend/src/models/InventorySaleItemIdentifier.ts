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
  DataType
} from "sequelize-typescript";
import Company from "./Company";
import InventorySaleItem from "./InventorySaleItem";

@Table({
  tableName: "InventorySaleItemIdentifiers",
  indexes: [
    {
      unique: true,
      name: "InventorySaleItemIdentifiers_saleItemId_position_unique",
      fields: ["saleItemId", "position"]
    },
    {
      name: "InventorySaleItemIdentifiers_companyId_identifier_idx",
      fields: ["companyId", "identifier"]
    }
  ]
})
// eslint-disable-next-line no-use-before-define
class InventorySaleItemIdentifier extends Model<InventorySaleItemIdentifier> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => InventorySaleItem)
  @Column
  saleItemId: number;

  @BelongsTo(() => InventorySaleItem)
  saleItem: InventorySaleItem;

  @Column
  position: number;

  @Column(DataType.STRING(255))
  identifier: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default InventorySaleItemIdentifier;
