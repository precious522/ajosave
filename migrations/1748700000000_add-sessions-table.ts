import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    token_hash: { type: "varchar(255)", notNull: true, unique: true },
    device_name: { type: "varchar(255)" },
    device_type: { type: "varchar(50)" }, // mobile, desktop, tablet, unknown
    browser: { type: "varchar(100)" },
    os: { type: "varchar(100)" },
    ip_address: { type: "varchar(45)" }, // supports IPv6
    user_agent: { type: "text" },
    last_active_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    expires_at: { type: "timestamp", notNull: true },
  });

  pgm.createIndex("sessions", "user_id");
  pgm.createIndex("sessions", "token_hash");
  pgm.createIndex("sessions", "expires_at");
  pgm.createIndex("sessions", "last_active_at");

  // Add comment for documentation
  pgm.sql(`
    COMMENT ON TABLE sessions IS 'Tracks active user sessions for security and device management';
    COMMENT ON COLUMN sessions.token_hash IS 'SHA-256 hash of the JWT token for session identification';
    COMMENT ON COLUMN sessions.last_active_at IS 'Updated on each authenticated request';
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("sessions");
}
