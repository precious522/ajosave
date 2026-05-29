import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Issue #35: Add 'refunded' to contributions.status CHECK constraint.
 * - 'refund_pending' was added in migration 1745900000000
 * - 'refunded' marks contributions where the USDC refund tx has been confirmed
 * - Also adds updated_at column to contributions for tracking status changes
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Extend the status check to include 'refunded'
  pgm.alterColumn("contributions", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending','confirmed','missed','refund_pending','refunded')",
  });

  // Add updated_at to contributions if not already present
  pgm.addColumn("contributions", {
    updated_at: {
      type: "timestamp",
      notNull: false,
      default: pgm.func("NOW()"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("contributions", "updated_at");

  pgm.alterColumn("contributions", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending','confirmed','missed','refund_pending')",
  });
}
