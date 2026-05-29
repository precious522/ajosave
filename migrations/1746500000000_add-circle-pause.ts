import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add paused_at column
  pgm.addColumn("circles", {
    paused_at: { type: "timestamp", default: null },
  });

  // Update status check constraint
  // We drop the existing one and add 'paused' to the list
  pgm.sql(`
    ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_status_check;
    ALTER TABLE circles ADD CONSTRAINT circles_status_check 
    CHECK (status IN ('open', 'active', 'completed', 'cancelled', 'paused'));
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Revert status check constraint
  pgm.sql(`
    ALTER TABLE circles DROP CONSTRAINT IF EXISTS circles_status_check;
    ALTER TABLE circles ADD CONSTRAINT circles_status_check 
    CHECK (status IN ('open', 'active', 'completed', 'cancelled'));
  `);
  
  // Remove paused_at column
  pgm.dropColumn("circles", "paused_at");
}
