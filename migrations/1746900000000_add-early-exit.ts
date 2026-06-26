import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("early_exit_requests", {
    id: { type: "uuid", primaryKey: true },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    member_id: {
      type: "uuid",
      notNull: true,
      references: "members(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    penalty_percent: { type: "numeric(5,2)", notNull: true },
    penalty_usdc: { type: "numeric(20,7)", notNull: true },
    refund_usdc: { type: "numeric(20,7)", notNull: true },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "pending",
      check: "status IN ('pending','approved','rejected')",
    },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    processed_at: { type: "timestamp" },
  });
  pgm.createIndex("early_exit_requests", "circle_id");
  pgm.createIndex("early_exit_requests", "member_id");
  pgm.createIndex("early_exit_requests", "status");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("early_exit_requests");
}
