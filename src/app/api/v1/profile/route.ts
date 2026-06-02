import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const updateSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  email: z.string().email().optional().or(z.literal("")),
  stellarPublicKey: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key")
    .optional()
    .or(z.literal("")),
});

export type ProfileData = {
  id: string;
  phone: string;
  displayName: string;
  email: string | null;
  stellarPublicKey: string | null;
  reputationScore: number;
  contributionStats: {
    total: number;
    confirmed: number;
    missed: number;
  };
};

export async function GET(): Promise<NextResponse<ApiResponse<ProfileData>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await query<{
    id: string;
    phone: string;
    display_name: string;
    email: string | null;
    stellar_public_key: string | null;
    reputation_score: number;
    total: string;
    confirmed: string;
    missed: string;
  }>(
    `SELECT
       u.id, u.phone, u.display_name, u.email, u.stellar_public_key, u.reputation_score,
       COUNT(c.id)                                          AS total,
       COUNT(c.id) FILTER (WHERE c.status = 'confirmed')   AS confirmed,
       COUNT(c.id) FILTER (WHERE c.status = 'missed')      AS missed
     FROM users u
     LEFT JOIN members m ON m.user_id = u.id
     LEFT JOIN contributions c ON c.member_id = m.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [session.user.id]
  );

  if (!rows[0]) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    success: true,
    data: {
      id: row.id,
      phone: decrypt(row.phone),
      displayName: row.display_name,
      email: row.email ? decrypt(row.email) : null,
      stellarPublicKey: row.stellar_public_key,
      reputationScore: row.reputation_score,
      contributionStats: {
        total: Number(row.total),
        confirmed: Number(row.confirmed),
        missed: Number(row.missed),
      },
    },
  });
}

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ updated: true }>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { displayName, email, stellarPublicKey } = parsed.data;

  await query(
    `UPDATE users
     SET display_name        = COALESCE($1, display_name),
         email               = COALESCE($2, email),
         stellar_public_key  = COALESCE($3, stellar_public_key)
     WHERE id = $4`,
    [
      displayName ?? null,
      email !== undefined ? (email === "" ? null : encrypt(email)) : null,
      stellarPublicKey !== undefined ? (stellarPublicKey === "" ? null : stellarPublicKey) : null,
      session.user.id,
    ]
  );

  return NextResponse.json({ success: true, data: { updated: true } });
}
