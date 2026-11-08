import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateGiveawaysTables1794140000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: "giveaways",
      columns: [
        { name: "id", type: "varchar", length: "32", isPrimary: true },
        { name: "guild_id", type: "varchar", length: "32" },
        { name: "channel_id", type: "varchar", length: "32" },
        { name: "message_id", type: "varchar", length: "32" },
        { name: "host_id", type: "varchar", length: "32" },
        { name: "title", type: "varchar", length: "180" },
        { name: "description", type: "text" },
        { name: "prize", type: "varchar", length: "500" },
        { name: "kind", type: "varchar", length: "16" },
        { name: "winner_count", type: "int" },
        { name: "required_role_id", type: "varchar", length: "32", isNullable: true },
        { name: "cash_reward", type: "bigint", isNullable: true },
        { name: "ends_at", type: "datetime" },
        { name: "status", type: "varchar", length: "16", default: "'active'" },
        { name: "winner_ids", type: "text", isNullable: true },
        { name: "payout_status", type: "varchar", length: "16", default: "'none'" },
        { name: "created_at", type: "datetime" }
      ],
      indices: [{ columnNames: ["guild_id", "status"] }, { columnNames: ["ends_at", "status"] }]
    }), true);
    await queryRunner.createTable(new Table({
      name: "giveaway_entries",
      columns: [
        { name: "giveaway_id", type: "varchar", length: "32", isPrimary: true },
        { name: "user_id", type: "varchar", length: "32", isPrimary: true },
        { name: "entered_at", type: "datetime" }
      ],
      indices: [{ columnNames: ["giveaway_id", "entered_at"] }]
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("giveaway_entries", true);
    await queryRunner.dropTable("giveaways", true);
  }
}
