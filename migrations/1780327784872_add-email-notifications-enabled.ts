import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add Email notification preferences to users table
  pgm.addColumn("users", {
    email_notifications_enabled: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Remove Email notification preferences
  pgm.dropColumn("users", "email_notifications_enabled");
}
