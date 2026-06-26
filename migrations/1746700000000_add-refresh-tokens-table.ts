import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create refresh_tokens table to track issued tokens and enable revocation
  pgm.createTable("refresh_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    token_hash: {
      type: "varchar(255)",
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: "timestamp",
      notNull: true,
    },
    revoked_at: {
      type: "timestamp",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // Indexes for efficient queries
  pgm.createIndex("refresh_tokens", "user_id");
  pgm.createIndex("refresh_tokens", "expires_at");
  pgm.createIndex("refresh_tokens", "revoked_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("refresh_tokens");
}
