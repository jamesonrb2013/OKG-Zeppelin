import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("okg_ai_settings")
export class OkgAISetting {
  @PrimaryColumn({ type: "varchar", length: 32 })
  scope_id: string;

  @Column({ type: "varchar", length: 160, default: "gemini/gemini-3.8-flash" })
  model: string;

  @Column({ type: "text" })
  personality: string;

  @Column({ type: "int", default: 10 })
  daily_limit: number;

  @Column({ type: "int", default: 100 })
  monthly_limit: number;

  @Column({ type: "varchar", length: 32, nullable: true })
  trigger_role_id: string | null;

  @Column({ type: "boolean", default: true })
  enabled: boolean;

  @Column({ type: "int", default: 0 })
  daily_count: number;

  @Column({ type: "varchar", length: 10, default: "" })
  daily_period: string;

  @Column({ type: "int", default: 0 })
  monthly_count: number;

  @Column({ type: "varchar", length: 7, default: "" })
  monthly_period: string;
}
