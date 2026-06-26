import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("circle_notification_preferences", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    user_id: {
      type: "varchar(255)",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    circle_id: {
      type: "uuid",
      notNull: true,
      references: "circles(id)",
      onDelete: "CASCADE",
    },
    push_enabled: { type: "boolean", notNull: true, default: true },
    sms_enabled: { type: "boolean", notNull: true, default: true },
    email_enabled: { type: "boolean", notNull: true, default: true },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
    updated_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("circle_notification_preferences", "user_id");
  pgm.createIndex("circle_notification_preferences", "circle_id");
  pgm.addConstraint("circle_notification_preferences", "unique_user_circle", "UNIQUE (user_id, circle_id)");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("circle_notification_preferences");
}
