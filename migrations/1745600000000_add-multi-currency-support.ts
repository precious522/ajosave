import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add currency column to circles table
  pgm.addColumn("circles", {
    contribution_currency: {
      type: "varchar(3)",
      notNull: true,
      default: "'NGN'",
      check: "contribution_currency IN ('NGN','GBP','USD','EUR')",
    },
  });

  // Rename contribution_ngn to contribution_fiat for clarity
  pgm.renameColumn("circles", "contribution_ngn", "contribution_fiat");

  // Add user notification preferences
  pgm.addColumn("users", {
    notification_preference: {
      type: "varchar(10)",
      notNull: true,
      default: "'sms'",
      check: "notification_preference IN ('sms','email','both')",
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("users", "notification_preference");
  pgm.renameColumn("circles", "contribution_fiat", "contribution_ngn");
  pgm.dropColumn("circles", "contribution_currency");
}
