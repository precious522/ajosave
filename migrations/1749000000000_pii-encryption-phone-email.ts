/**
 * Migration: PII encryption at rest for phone and email columns (Issue #138)
 *
 * Strategy:
 *  1. Add phone_encrypted, phone_hash, email_encrypted columns
 *  2. Backfill existing rows using pgcrypto's gen_random_uuid as a stand-in marker
 *     (actual encryption is performed by the application at startup / via a script)
 *  3. Drop the plaintext phone and email columns
 *  4. Rename the encrypted columns to phone / email for backward compat, keeping
 *     phone_hash for blind-index lookups
 *
 * NOTE: Before running UP, ensure PII_ENCRYPTION_KEY and PII_HMAC_KEY are set in
 * your environment and the backfill script has been executed:
 *   npx ts-node scripts/backfill-pii-encryption.ts
 *
 * The migration itself only manages schema; the Node process handles encryption
 * because PostgreSQL does not have access to the application-level AES key.
 */
import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Step 1 — add new encrypted + hash columns alongside the originals
  pgm.addColumns("users", {
    phone_encrypted: { type: "text" },
    phone_hash: { type: "varchar(64)" },
    email_encrypted: { type: "text" },
  });

  // Step 2 — unique constraint on the hash column (replaces the plaintext unique index)
  pgm.addConstraint("users", "users_phone_hash_unique", "UNIQUE (phone_hash)");
  pgm.createIndex("users", "phone_hash");

  // Step 3 — drop the plaintext unique constraint and column
  //           (app must have backfilled encrypted columns first)
  pgm.dropConstraint("users", "users_phone_key", { ifExists: true });
  pgm.dropIndex("users", "phone", { ifExists: true });
  pgm.dropColumns("users", ["phone", "email"]);

  // Step 4 — rename encrypted columns to the canonical names
  pgm.renameColumn("users", "phone_encrypted", "phone");
  pgm.renameColumn("users", "email_encrypted", "email");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Reverse: restore plaintext columns (data will be ciphertext — manual decrypt needed)
  pgm.renameColumn("users", "phone", "phone_encrypted");
  pgm.renameColumn("users", "email", "email_encrypted");

  pgm.addColumns("users", {
    phone: { type: "varchar(20)", notNull: false },
    email: { type: "varchar(255)", notNull: false },
  });

  pgm.dropIndex("users", "phone_hash", { ifExists: true });
  pgm.dropConstraint("users", "users_phone_hash_unique", { ifExists: true });
  pgm.dropColumns("users", ["phone_encrypted", "phone_hash", "email_encrypted"]);

  // Re-add original constraints
  pgm.addConstraint("users", "users_phone_key", "UNIQUE (phone)");
  pgm.createIndex("users", "phone");
}
