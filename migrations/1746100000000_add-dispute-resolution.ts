import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("disputes", {
    id: { type: "uuid", primaryKey: true },
    contribution_id: {
      type: "uuid",
      references: "contributions(id)",
      onDelete: "CASCADE",
    },
    member_id: {
      type: "uuid",
      notNull: true,
      references: "members(id)",
      onDelete: "CASCADE",
    },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    paystack_reference: { type: "varchar(255)" },
    type: {
      type: "varchar(30)",
      notNull: true,
      default: "other",
      check: "type IN ('missed_payout','wrong_amount','other')",
    },
    reason: { type: "text", notNull: true },
    evidence: { type: "text" },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "open",
      check: "status IN ('open','investigating','resolved','rejected')",
    },
    resolution_notes: { type: "text" },
    resolved_by: { type: "varchar(255)" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    resolved_at: { type: "timestamp" },
  });
  pgm.createIndex("disputes", "circle_id");
  pgm.createIndex("disputes", "member_id");
  pgm.createIndex("disputes", "status");
  pgm.createIndex("disputes", "contribution_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("disputes");
}
