import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("giveaways")
export class Giveaway {
  @PrimaryColumn({ type: "varchar", length: 32 }) id: string;
  @Column({ type: "varchar", length: 32 }) guild_id: string;
  @Column({ type: "varchar", length: 32 }) channel_id: string;
  @Column({ type: "varchar", length: 32 }) message_id: string;
  @Column({ type: "varchar", length: 32 }) host_id: string;
  @Column({ type: "varchar", length: 180 }) title: string;
  @Column({ type: "text" }) description: string;
  @Column({ type: "varchar", length: 500 }) prize: string;
  @Column({ type: "varchar", length: 16 }) kind: string;
  @Column({ type: "int" }) winner_count: number;
  @Column({ type: "varchar", length: 32, nullable: true }) required_role_id: string | null;
  @Column({ type: "bigint", nullable: true }) cash_reward: number | null;
  @Column({ type: "datetime" }) ends_at: Date;
  @Column({ type: "varchar", length: 16 }) status: string;
  @Column({ type: "text", nullable: true }) winner_ids: string | null;
  @Column({ type: "varchar", length: 16, default: "none" }) payout_status: string;
  @Column({ type: "datetime" }) created_at: Date;
}
