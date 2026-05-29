import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Issue #22: Confirm members table is fully persisted to PostgreSQL.
 * - Adds refund_pending contribution status (required by circle cancellation / issue #15)
 * - Adds authorization_url column to contributions (used by Paystack payment flow)
 * - Ensures indexes on members(circle_id) and members(user_id) exist
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add refund_pending to contributions status (needed for circle cancellation)
  pgm.alterColumn("contributions", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending','confirmed','missed','refund_pending')",
  });

  // Add authorization_url column if not already present (used by Paystack flow)
  pgm.addColumn("contributions", {
    authorization_url: { type: "text" },
  });

  // Ensure composite index on members for fast circle membership lookups
  pgm.createIndex("members", ["circle_id", "user_id"], {
    name: "idx_members_circle_user",
    unique: false,
    ifNotExists: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("members", ["circle_id", "user_id"], {
    name: "idx_members_circle_user",
    ifExists: true,
  });

  pgm.dropColumn("contributions", "authorization_url");

  pgm.alterColumn("contributions", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending','confirmed','missed')",
  });
}
