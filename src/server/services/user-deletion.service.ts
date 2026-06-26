import { transaction } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logAuditAction } from "./audit.service";
import { serverConfig } from "@/server/config";

/**
 * Anonymizes all PII for a user while preserving financial records for audit.
 *
 * GDPR/NDPR compliance:
 * - Deletes: phone, email, display_name, stellar_public_key
 * - Preserves: contributions, payouts, circle membership (anonymized)
 * - Audit log entry created for the deletion
 */
export async function deleteUserData(userId: string): Promise<{ email: string | null }> {
  const anonymizedName = `deleted-user-${userId.slice(0, 8)}`;

  const { email } = await transaction(async (q) => {
    // Fetch email before wiping it (needed for confirmation email)
    const { rows } = await q<{ email: string | null }>(
      "SELECT email FROM users WHERE id = $1",
      [userId]
    );
    if (!rows[0]) throw new Error("User not found");
    const { email } = rows[0];

    // Anonymize PII — preserve id, role, reputation_score, created_at for audit
    await q(
      `UPDATE users
       SET phone              = $1,
           display_name       = $2,
           email              = NULL,
           stellar_public_key = NULL,
           deleted_at         = NOW()
       WHERE id = $3`,
      [`deleted-${userId}`, anonymizedName, userId]
    );

    // Soft-delete active sessions by invalidating refresh tokens
    await q("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

    return { email };
  });

  // Audit log (outside transaction — non-critical)
  await logAuditAction(userId, "DELETE_USER", "USER", userId, {
    details: { reason: "GDPR/NDPR user-initiated deletion" },
  }).catch(() => {});

  return { email };
}

export async function sendDeletionConfirmationEmail(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Ajosave account has been deleted",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>Account Deletion Confirmed</h2>
        <p>Your personal data has been deleted from Ajosave in accordance with GDPR/NDPR.</p>
        <p>Financial transaction records are retained in anonymized form as required by law.</p>
        <p>If you did not request this, contact us immediately at <a href="mailto:security@ajosave.app">security@ajosave.app</a>.</p>
        <p>— The Ajosave Team</p>
      </div>
    `,
    text: "Your Ajosave account has been deleted. Financial records are retained in anonymized form as required by law. Contact security@ajosave.app if you did not request this.",
  });
}
