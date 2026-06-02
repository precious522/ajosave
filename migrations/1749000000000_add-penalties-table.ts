import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("penalties", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    circle_id: { type: "uuid", notNull: true, references: "circles(id)", onDelete: "CASCADE" },
    member_id: { type: "uuid", notNull: true, references: "members(id)", onDelete: "CASCADE" },
    cycle_number: { type: "integer", notNull: true },
    amount_usdc: { type: "numeric(20,7)", notNull: true },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });
  pgm.createIndex("penalties", ["circle_id"]);
  pgm.createIndex("penalties", ["member_id"]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("penalties");
}
