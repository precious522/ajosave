import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Index on circles.status — used in listOpenCircles and status filters
  pgm.createIndex("circles", "status", {
    name: "idx_circles_status",
    ifNotExists: true,
  });

  // Composite index on contributions(circle_id, created_at) — used in contribution history queries
  pgm.createIndex("contributions", ["circle_id", "created_at"], {
    name: "idx_contributions_circle_id_created_at",
    ifNotExists: true,
  });

  // Index on members.user_id — used in getCirclesByUser and membership lookups
  pgm.createIndex("members", "user_id", {
    name: "idx_members_user_id",
    ifNotExists: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("members", "user_id", { name: "idx_members_user_id", ifExists: true });
  pgm.dropIndex("contributions", ["circle_id", "created_at"], { name: "idx_contributions_circle_id_created_at", ifExists: true });
  pgm.dropIndex("circles", "status", { name: "idx_circles_status", ifExists: true });
}
