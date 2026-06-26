import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("sms_logs", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    message_id: { type: "varchar(255)", unique: true },
    phone: { type: "varchar(20)", notNull: true },
    message: { type: "text", notNull: true },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "'pending'",
      check: "status IN ('pending', 'delivered', 'failed', 'expired')",
    },
    retry_sent: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("sms_logs", "status");
  pgm.createIndex("sms_logs", "created_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("sms_logs");
}
