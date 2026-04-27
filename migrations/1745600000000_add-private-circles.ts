import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add circle_type column to circles table
  pgm.addColumn("circles", {
    circle_type: {
      type: "varchar(20)",
      notNull: true,
      default: "public",
      check: "circle_type IN ('public', 'private')",
    },
  });

  // Add index for circle_type
  pgm.createIndex("circles", "circle_type", {
    name: "idx_circles_type",
  });

  // Update members table to support rejected status
  pgm.alterColumn("members", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending', 'active', 'rejected', 'defaulted', 'completed')",
  });

  // Make position nullable for pending members
  pgm.alterColumn("members", "position", {
    type: "integer",
    notNull: false,
    check: "position > 0",
  });

  // Add reviewed_at column to track when creator approved/rejected
  pgm.addColumn("members", {
    reviewed_at: {
      type: "timestamp",
      notNull: false,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Remove reviewed_at column
  pgm.dropColumn("members", "reviewed_at");

  // Revert position to not null
  pgm.alterColumn("members", "position", {
    type: "integer",
    notNull: true,
    check: "position > 0",
  });

  // Revert members status check
  pgm.alterColumn("members", "status", {
    type: "varchar(20)",
    notNull: true,
    default: "pending",
    check: "status IN ('pending', 'active', 'defaulted', 'completed')",
  });

  // Drop circle_type index
  pgm.dropIndex("circles", "circle_type", {
    name: "idx_circles_type",
  });

  // Remove circle_type column
  pgm.dropColumn("circles", "circle_type");
}
