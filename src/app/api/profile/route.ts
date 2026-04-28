import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const newUrl = url.pathname.replace('/api/profile', '/api/v1/profile');
  
  return NextResponse.redirect(new URL(newUrl + url.search, url.origin), {
    status: 301,
    headers: {
      'X-API-Deprecated': 'true',
      'X-API-Deprecation-Info': 'This endpoint is deprecated. Use /api/v1/profile instead.',
    }
  });
}

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const newUrl = url.pathname.replace('/api/profile', '/api/v1/profile');
  
  return NextResponse.redirect(new URL(newUrl, url.origin), {
    status: 308, // Preserve PUT method
    headers: {
      'X-API-Deprecated': 'true',
      'X-API-Deprecation-Info': 'This endpoint is deprecated. Use /api/v1/profile instead.',
    }
  });
}
