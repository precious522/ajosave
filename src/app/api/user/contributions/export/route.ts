import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { withErrorHandler } from "@/server/middleware";

interface ExportRow {
  date: string;
  circleName: string;
  amountUsdc: string;
  status: string;
}

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const { rows } = await query<ExportRow>(
    `SELECT
       c.created_at       AS date,
       ci.name            AS "circleName",
       c.amount_usdc      AS "amountUsdc",
       c.status
     FROM contributions c
     JOIN members m  ON m.id = c.member_id
     JOIN circles ci ON ci.id = c.circle_id
     WHERE m.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );

  const header = "Date,Circle Name,Amount (USDC),Status\n";
  const csvRows = rows.map((r) => {
    const date = new Date(r.date).toISOString().split("T")[0];
    const name = `"${r.circleName.replace(/"/g, '""')}"`;
    return `${date},${name},${parseFloat(r.amountUsdc).toFixed(2)},${r.status}`;
  });
  const csv = header + csvRows.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contributions-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});
