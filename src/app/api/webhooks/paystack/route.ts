import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { query, transaction } from "@/lib/db";
import { serverConfig } from "@/server/config";
import logger from "@/lib/logger";

function verifySignature(payload: string, signature: string): boolean {
  if (!signature || !serverConfig.paystack.secretKey) return false;

  const expected = createHmac("sha512", serverConfig.paystack.secretKey)
    .update(payload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature)) {
    logger.warn({ signature }, "Invalid Paystack webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventId = event.id?.toString() || event.data?.id?.toString();

  if (!eventId) {
    logger.error({ event }, "Paystack webhook missing event ID");
    return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
  }

  // Replay attack prevention: check if the webhook was processed in the last 24 hours
  const { rows: existingEvent } = await query(
    `SELECT id FROM processed_webhooks
     WHERE id = $1
       AND provider = 'paystack'
       AND created_at >= NOW() - INTERVAL '24 HOURS'`,
    [eventId]
  );

  if (existingEvent.length > 0) {
    logger.info({ eventId }, "Paystack webhook already processed within deduplication window");
    return NextResponse.json({ received: true, duplicate: true });
  }

  logger.info({ eventId, event: event.event }, "Paystack webhook verified");

  if (event.event === "charge.failed") {
    const reference: string = event.data?.reference;
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }
    await query(
      `UPDATE contributions SET status = 'failed'
       WHERE paystack_reference = $1 AND status = 'pending'`,
      [reference]
    );
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success") {
    // Record non-charge.success events too to prevent replays
    await query(
      "INSERT INTO processed_webhooks (id, provider, event_type, payload) VALUES ($1, 'paystack', $2, $3)",
      [eventId, event.event, event]
    );
    return NextResponse.json({ received: true });
  }

  const reference: string = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    await transaction(async (q) => {
      // Record the webhook as processed within the transaction
      await q(
        "INSERT INTO processed_webhooks (id, provider, event_type, payload) VALUES ($1, 'paystack', $2, $3)",
        [eventId, event.event, event]
      );

      // Confirm the pending contribution matching this paystack_reference
      const { rowCount } = await q(
        `UPDATE contributions
         SET status = 'confirmed', updated_at = NOW()
         WHERE paystack_reference = $1 AND status = 'pending'`,
        [reference]
      );

      if (rowCount === 0) {
        logger.info({ reference }, "Paystack reference not found or already confirmed");
      } else {
        logger.info({ reference }, "Contribution confirmed via Paystack webhook");
      }
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      logger.info({ eventId }, "Duplicate Paystack webhook event detected during insert");
      return NextResponse.json({ received: true, duplicate: true });
    }
    logger.error({ err, eventId }, "Error processing Paystack webhook");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
