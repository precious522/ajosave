import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { query } from "@/lib/db";
import { serverConfig } from "@/server/config";

function verifySignature(payload: string, signature: string): boolean {
  const expected = createHmac("sha512", serverConfig.paystack.secretKey)
    .update(payload)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference: string = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Idempotency: skip if this reference was already processed
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM contributions WHERE tx_hash = $1 AND status = 'confirmed' LIMIT 1`,
    [reference]
  );
  if (rows.length > 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Confirm the pending contribution matching this reference
  await query(
    `UPDATE contributions
     SET status = 'confirmed', tx_hash = $1
     WHERE tx_hash = $1 AND status = 'pending'`,
    [reference]
  );

  return NextResponse.json({ received: true });
}
