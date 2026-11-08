import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("giveaway_entries")
export class GiveawayEntry {
  @PrimaryColumn({ type: "varchar", length: 32 }) giveaway_id: string;
  @PrimaryColumn({ type: "varchar", length: 32 }) user_id: string;
  @Column({ type: "datetime" }) entered_at: Date;
}
