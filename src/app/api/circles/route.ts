import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const newUrl = url.pathname.replace('/api/circles', '/api/v1/circles');
  
  return NextResponse.redirect(new URL(newUrl + url.search, url.origin), {
    status: 301,
    headers: {
      'X-API-Deprecated': 'true',
      'X-API-Deprecation-Info': 'This endpoint is deprecated. Use /api/v1/circles instead.',
    }
  });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const newUrl = url.pathname.replace('/api/circles', '/api/v1/circles');
  
  return NextResponse.redirect(new URL(newUrl, url.origin), {
    status: 308, // Preserve POST method
    headers: {
      'X-API-Deprecated': 'true',
      'X-API-Deprecation-Info': 'This endpoint is deprecated. Use /api/v1/circles instead.',
    }
  });
}
