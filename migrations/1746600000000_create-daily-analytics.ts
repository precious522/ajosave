import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("daily_analytics", {
    date: { type: "date", primaryKey: true },
    total_saved: { type: "numeric(20,7)", notNull: true, default: 0 },
    active_circles: { type: "integer", notNull: true, default: 0 },
    completion_rate: { type: "numeric(5,2)", notNull: true, default: 0.00 },
    default_rate: { type: "numeric(5,2)", notNull: true, default: 0.00 },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("daily_analytics");
}
