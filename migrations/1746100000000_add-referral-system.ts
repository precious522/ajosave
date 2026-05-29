import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Issue #123: Add referral system.
 * - Adds referral_code (unique, 8-char) to users table
 * - Adds referred_by column to users (FK to users.id)
 * - Creates referrals table to track referral events and rewards
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add referral_code to users — generated at signup or lazily on first access
  pgm.addColumn("users", {
    referral_code: { type: "varchar(16)", unique: true },
    referred_by: { type: "varchar(255)", references: "users(id)", onDelete: "SET NULL" },
  });

  pgm.createIndex("users", ["referral_code"], {
    name: "idx_users_referral_code",
    unique: true,
    ifNotExists: true,
  });

  // Referrals table: one row per successful referral (referred user completes first contribution)
  pgm.createTable("referrals", {
    id: { type: "uuid", primaryKey: true },
    referrer_id: { type: "varchar(255)", notNull: true, references: "users(id)", onDelete: "CASCADE" },
    referred_id: { type: "varchar(255)", notNull: true, references: "users(id)", onDelete: "CASCADE" },
    rewarded: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("referrals", ["referrer_id"], { name: "idx_referrals_referrer", ifNotExists: true });
  pgm.createIndex("referrals", ["referred_id"], { name: "idx_referrals_referred", unique: true, ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("referrals");
  pgm.dropIndex("users", ["referral_code"], { name: "idx_users_referral_code", ifExists: true });
  pgm.dropColumn("users", "referred_by");
  pgm.dropColumn("users", "referral_code");
}
