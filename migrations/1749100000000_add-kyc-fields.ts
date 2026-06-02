/**
 * Migration: KYC fields on users and KYC threshold on circles (Issue #129)
 *
 * - users.kyc_status      — enum-like varchar: 'none' | 'pending' | 'approved' | 'rejected'
 * - users.kyc_verified_at — timestamp set when status transitions to 'approved'
 * - circles.kyc_threshold — optional NGN amount; if set, joining requires kyc_status = 'approved'
 */
import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns("users", {
    kyc_status: {
      type: "varchar(20)",
      notNull: true,
      default: "none",
      check: "kyc_status IN ('none','pending','approved','rejected')",
    },
    kyc_verified_at: { type: "timestamp" },
  });

  pgm.addColumns("circles", {
    kyc_threshold: {
      type: "numeric(20,2)",
      comment: "NGN contribution amount above which KYC is required to join. NULL = no requirement.",
    },
  });

  pgm.createIndex("users", "kyc_status");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("users", "kyc_status", { ifExists: true });
  pgm.dropColumns("circles", ["kyc_threshold"]);
  pgm.dropColumns("users", ["kyc_status", "kyc_verified_at"]);
}
