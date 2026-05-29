import { NextRequest, NextResponse } from "next/server";

// Minimal SVG-based OG image for circle pages
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") ?? "Savings Circle";
  const amount = searchParams.get("amount") ?? "";
  const freq = searchParams.get("freq") ?? "";

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f172a"/>
  <rect x="0" y="0" width="6" height="630" fill="#6366f1"/>
  <text x="80" y="120" font-family="system-ui,sans-serif" font-size="28" fill="#6366f1" font-weight="600">AJOSAVE</text>
  <text x="80" y="260" font-family="system-ui,sans-serif" font-size="64" fill="#f8fafc" font-weight="700">${escapeXml(name)}</text>
  <text x="80" y="340" font-family="system-ui,sans-serif" font-size="36" fill="#94a3b8">${amount ? `₦${escapeXml(amount)} ${escapeXml(freq)}` : "Rotating Savings Circle"}</text>
  <text x="80" y="540" font-family="system-ui,sans-serif" font-size="24" fill="#475569">Trustless Ajo/Esusu on Stellar · ajosave.app</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
