import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add SMS notification preferences to users table
  pgm.addColumn("users", {
    sms_notifications_enabled: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Remove SMS notification preferences
  pgm.dropColumn("users", "sms_notifications_enabled");
}
