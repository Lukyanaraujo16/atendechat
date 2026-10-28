import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table
} from "sequelize-typescript";

export type EvolutionContainerRole = "api" | "postgres" | "redis";

export type EvolutionContainerSample = {
  role: EvolutionContainerRole;
  name: string;
  state: string;
  running: boolean;
  health: string | null;
  startedAt: string | null;
  restartCount: number;
  oomKilled: boolean;
  cpuPercent: number | null;
  memBytes: number | null;
  memLimitBytes: number | null;
  image: string | null;
};

/** Amostra de infraestrutura da VPS Evolution (coletor → POST /system/evolution-metrics). */
@Table({ tableName: "EvolutionMetricSamples", updatedAt: false })
class EvolutionMetricSample extends Model<EvolutionMetricSample> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id: number;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  source: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  collectedAt: Date;

  @Column(DataType.DOUBLE)
  hostCpuPercent: number;

  @Column(DataType.INTEGER)
  hostCpuCores: number;

  // BIGINT volta como string do driver pg; o serviço converte com Number().
  @Column(DataType.BIGINT)
  hostMemTotalBytes: number;

  @Column(DataType.BIGINT)
  hostMemUsedBytes: number;

  @Column(DataType.BIGINT)
  hostMemAvailableBytes: number;

  @Column(DataType.BIGINT)
  hostDiskTotalBytes: number;

  @Column(DataType.BIGINT)
  hostDiskUsedBytes: number;

  @Column(DataType.BIGINT)
  hostDiskAvailableBytes: number;

  @Column(DataType.DOUBLE)
  hostLoad1: number;

  @Column(DataType.DOUBLE)
  hostLoad5: number;

  @Column(DataType.DOUBLE)
  hostLoad15: number;

  @Column(DataType.DATE)
  hostBootAt: Date;

  @AllowNull(true)
  @Column(DataType.DOUBLE)
  apiCpuPercent: number | null;

  @AllowNull(true)
  @Column(DataType.BIGINT)
  apiMemBytes: number | null;

  @Column(DataType.JSONB)
  containers: EvolutionContainerSample[];

  @CreatedAt
  createdAt: Date;
}

export default EvolutionMetricSample;
