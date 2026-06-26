import { query } from "@/lib/db";

/**
 * Add min_reputation column to circles table for reputation gating
 */
export async function up(): Promise<void> {
  await query(`
    ALTER TABLE circles 
    ADD COLUMN IF NOT EXISTS min_reputation INTEGER DEFAULT 0 CHECK (min_reputation >= 0 AND min_reputation <= 100)
  `);
}

export async function down(): Promise<void> {
  await query(`ALTER TABLE circles DROP COLUMN IF EXISTS min_reputation`);
}
