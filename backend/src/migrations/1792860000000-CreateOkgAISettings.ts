import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateOkgAISettings1792860000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "okg_ai_settings",
        columns: [
          { name: "scope_id", type: "varchar", length: "32", isPrimary: true },
          { name: "model", type: "varchar", length: "160", default: "'gemini/gemini-3.8-flash'" },
          { name: "personality", type: "text" },
          { name: "daily_limit", type: "int", default: 10 },
          { name: "monthly_limit", type: "int", default: 100 },
          { name: "trigger_role_id", type: "varchar", length: "32", isNullable: true },
          { name: "enabled", type: "boolean", default: true },
          { name: "daily_count", type: "int", default: 0 },
          { name: "daily_period", type: "varchar", length: "10", default: "''" },
          { name: "monthly_count", type: "int", default: 0 },
          { name: "monthly_period", type: "varchar", length: "7", default: "''" },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("okg_ai_settings");
  }
}
