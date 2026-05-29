import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("circles", {
    deleted_at: { type: "timestamp", default: null },
  });
  pgm.createIndex("circles", "deleted_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("circles", "deleted_at");
  pgm.dropColumn("circles", "deleted_at");
}
