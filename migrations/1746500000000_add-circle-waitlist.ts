import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("circle_waitlist", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    circle_id: { type: "uuid", notNull: true, references: "circles(id)", onDelete: "CASCADE" },
    user_id: { type: "uuid", notNull: true, references: "users(id)", onDelete: "CASCADE" },
    joined_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.addConstraint("circle_waitlist", "unique_circle_user", {
    unique: ["circle_id", "user_id"],
  });
  pgm.createIndex("circle_waitlist", "circle_id");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("circle_waitlist");
}
