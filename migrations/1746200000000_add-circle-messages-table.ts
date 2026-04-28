import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("circle_messages", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    content: {
      type: "text",
      notNull: true,
      check: "char_length(content) >= 1 AND char_length(content) <= 1000",
    },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("circle_messages", ["circle_id", "created_at"], {
    name: "idx_circle_messages_circle_created",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("circle_messages");
}
