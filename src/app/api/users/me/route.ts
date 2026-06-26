import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const patchSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name cannot be empty")
    .max(50, "Display name must be 50 characters or fewer")
    .trim(),
});

export type PatchMeResponse = {
  id: string;
  displayName: string;
  stellarAddress: string | null;
};

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<PatchMeResponse>>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { displayName } = parsed.data;

  const { rows } = await query<{
    id: string;
    display_name: string;
    stellar_public_key: string | null;
  }>(
    `UPDATE users
     SET display_name = $1
     WHERE id = $2
     RETURNING id, display_name, stellar_public_key`,
    [displayName, session.user.id]
  );

  if (!rows[0]) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const row = rows[0];
  return NextResponse.json({
    success: true,
    data: {
      id: row.id,
      displayName: row.display_name,
      stellarAddress: row.stellar_public_key,
    },
  });
}
