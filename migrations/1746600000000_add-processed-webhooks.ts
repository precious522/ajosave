import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("processed_webhooks", {
    id: { type: "varchar(255)", primaryKey: true },
    provider: { type: "varchar(50)", notNull: true },
    event_type: { type: "varchar(100)" },
    payload: { type: "jsonb" },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("processed_webhooks", ["provider", "id"], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("processed_webhooks");
}
