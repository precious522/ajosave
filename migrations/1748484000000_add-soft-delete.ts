import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("users", {
    deleted_at: { type: "timestamp", default: null },
  });
  pgm.addColumn("circles", {
    deleted_at: { type: "timestamp", default: null },
  });

  pgm.createIndex("users", "deleted_at");
  pgm.createIndex("circles", "deleted_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("circles", "deleted_at");
  pgm.dropIndex("users", "deleted_at");
  pgm.dropColumn("circles", "deleted_at");
  pgm.dropColumn("users", "deleted_at");
}
