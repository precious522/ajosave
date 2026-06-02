/**
 * Backfill script — PII Encryption (Issue #138)
 *
 * Run this BEFORE the migration 1749000000000_pii-encryption-phone-email.
 * It reads plaintext phone/email from the users table, encrypts them, and writes
 * the results into phone_encrypted / phone_hash / email_encrypted columns
 * (which the migration has already added in step 1).
 *
 * Usage:
 *   npx ts-node scripts/backfill-pii-encryption.ts
 *
 * Required env vars: DATABASE_URL, PII_ENCRYPTION_KEY, PII_HMAC_KEY
 */
import { Pool } from "pg";
import { encrypt, hmacIndex } from "../src/lib/encryption";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query<{
      id: string;
      phone: string;
      email: string | null;
    }>("SELECT id, phone, email FROM users WHERE phone_hash IS NULL");

    console.log(`Backfilling ${rows.length} user(s)…`);

    for (const row of rows) {
      await pool.query(
        `UPDATE users
         SET phone_encrypted = $1,
             phone_hash      = $2,
             email_encrypted = $3
         WHERE id = $4`,
        [
          encrypt(row.phone),
          hmacIndex(row.phone),
          row.email ? encrypt(row.email) : null,
          row.id,
        ]
      );
    }

    console.log("Backfill complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
