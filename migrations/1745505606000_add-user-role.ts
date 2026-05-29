import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("users", {
    role: {
      type: "varchar(20)",
      notNull: true,
      default: "user",
      check: "role IN ('user', 'admin')",
    },
  });
  pgm.createIndex("users", "role");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("users", "role");
  pgm.dropColumn("users", "role");
}
