import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { getCertificatesByUser } from "@/server/services/certificate.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { Certificate } from "@/server/services/certificate.service";

export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = (session.user as { id: string }).id;

  // Resolve the user's Stellar public key from DB
  const { rows } = await query<{ stellar_public_key: string | null }>(
    "SELECT stellar_public_key FROM users WHERE id = $1",
    [userId]
  );
  const stellarKey = rows[0]?.stellar_public_key;
  if (!stellarKey) {
    return NextResponse.json<ApiResponse<Certificate[]>>({ success: true, data: [] });
  }

  const certificates = await getCertificatesByUser(stellarKey);
  return NextResponse.json<ApiResponse<Certificate[]>>({ success: true, data: certificates });
});
