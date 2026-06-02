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

  // Replay attack prevention: check if event already processed
  const { rows: existingEvent } = await query(
    "SELECT id FROM processed_webhooks WHERE id = $1 AND provider = 'paystack'",
    [eventId]
  );

  if (existingEvent.length > 0) {
    logger.info({ eventId }, "Paystack webhook already processed");
    return NextResponse.json({ received: true, duplicate: true });
  }

  logger.info({ eventId, event: event.event }, "Paystack webhook verified");

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

      // Fetch the contribution for this reference
      const { rows: contribRows } = await q<{
        id: string;
        amount_usdc: string;
        amount_paid_usdc: string;
        is_partial: boolean;
      }>(
        `SELECT id, amount_usdc, amount_paid_usdc, is_partial
         FROM contributions WHERE paystack_reference = $1 AND status = 'pending' LIMIT 1`,
        [reference]
      );

      if (contribRows.length === 0) {
        logger.info({ reference }, "Paystack reference not found or already confirmed");
      } else {
        const contrib = contribRows[0];
        // Amount paid in this transaction (from Paystack event, in kobo → convert to USDC proportionally)
        // We use the metadata.payUsdc or topUpUsdc if present, otherwise treat as full payment
        const meta = event.data?.metadata ?? {};
        const creditUsdc = parseFloat(meta.payUsdc ?? meta.topUpUsdc ?? contrib.amount_usdc);
        const newPaidUsdc = parseFloat(contrib.amount_paid_usdc) + creditUsdc;
        const fullUsdc = parseFloat(contrib.amount_usdc);
        const isFullyPaid = newPaidUsdc >= fullUsdc - 0.0000001; // float tolerance

        await q(
          `UPDATE contributions
           SET amount_paid_usdc = $1,
               status           = $2,
               tx_hash          = $3,
               updated_at       = NOW()
           WHERE id = $4`,
          [
            Math.min(newPaidUsdc, fullUsdc).toFixed(7),
            isFullyPaid ? "confirmed" : "pending",
            reference,
            contrib.id,
          ]
        );

        logger.info({ reference, isFullyPaid, newPaidUsdc, fullUsdc }, "Contribution payment credited");
      }
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ err, eventId }, "Error processing Paystack webhook");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
