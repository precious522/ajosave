import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXTAUTH_URL,
  "http://localhost:3000",
  "https://ajosave.app",
  "https://www.ajosave.app",
]
  .filter(Boolean)
  .map((origin) => origin!.trim().replace(/\/$/, ""));

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle API versioning redirects
  if (request.nextUrl.pathname.startsWith("/api/") && !request.nextUrl.pathname.startsWith("/api/v1/")) {
    // Skip auth routes as they need special handling
    if (!request.nextUrl.pathname.startsWith("/api/auth/")) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = newUrl.pathname.replace('/api/', '/api/v1/');
      
      const response = NextResponse.redirect(newUrl, {
        status: request.method === 'GET' ? 301 : 308,
      });
      
      response.headers.set('X-API-Deprecated', 'true');
      response.headers.set('X-API-Deprecation-Info', `This endpoint is deprecated. Use ${newUrl.pathname} instead.`);
      
      return response;
    }
  }

  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });

      if (isAllowed) {
        response.headers.set("Access-Control-Allow-Origin", origin!);
        response.headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        );
        response.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With, X-CSRF-Token"
        );
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Access-Control-Max-Age", "86400");
      }

      return response;
    }

    const response = NextResponse.next();

    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin!);
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-CSRF-Token"
      );
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
