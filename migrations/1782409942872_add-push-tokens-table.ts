import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("push_tokens", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    token: { type: "varchar(512)", notNull: true },
    platform: {
      type: "varchar(20)",
      notNull: true,
      check: "platform IN ('ios','android','web')",
    },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("push_tokens", "user_id");
  pgm.addConstraint("push_tokens", "unique_token_per_platform", "UNIQUE (user_id, token, platform)");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("push_tokens");
}
