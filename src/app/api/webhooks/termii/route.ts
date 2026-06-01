import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/server/middleware";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import logger from "@/lib/logger";

// Termii delivery report statuses that indicate final failure
const FAILED_STATUSES = new Set(["failed", "expired", "rejected", "undelivered"]);
const DELIVERED_STATUS = "delivered";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { message_id, status, phone_number } = body as {
    message_id?: string;
    status?: string;
    phone_number?: string;
  };

  if (!message_id || !status) {
    return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
  }

  const db = await getDb();
  const normalizedStatus = status.toLowerCase();
  const deliveryStatus = normalizedStatus === DELIVERED_STATUS
    ? "delivered"
    : FAILED_STATUSES.has(normalizedStatus)
    ? "failed"
    : null;

  if (!deliveryStatus) {
    // Intermediate status (e.g. "sent", "submitted") — acknowledge but don't update
    return NextResponse.json({ success: true });
  }

  const { rows } = await db.query<{ id: string; phone: string; message: string; retry_sent: boolean }>(
    `UPDATE sms_logs
     SET status = $1, updated_at = NOW()
     WHERE message_id = $2 AND status = 'pending'
     RETURNING id, phone, message, retry_sent`,
    [deliveryStatus, message_id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ success: true }); // already processed or unknown
  }

  const log = rows[0];

  if (deliveryStatus === "failed" && !log.retry_sent) {
    // Attempt to find user email for fallback notification
    const phone = phone_number ?? log.phone;
    const { rows: users } = await db.query<{ email: string | null }>(
      `SELECT email FROM users WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    const email = users[0]?.email;

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "Ajosave: SMS delivery failed — important notification",
          html: `<p>We were unable to deliver an SMS to your phone. Here is the message:</p><p>${log.message}</p>`,
          text: `We were unable to deliver an SMS to your phone. Message: ${log.message}`,
        });
        await db.query(`UPDATE sms_logs SET retry_sent = true WHERE id = $1`, [log.id]);
        logger.info({ messageId: message_id }, "SMS failed — email fallback sent");
      } catch (err) {
        logger.error({ err, messageId: message_id }, "Email fallback failed");
      }
    }
  }

  return NextResponse.json({ success: true });
});
