import * as http from "http";
import { NextRequest } from "next/server";
import { GET as getProfile, PATCH as patchProfile } from "../../app/api/v1/profile/route";
import {
  GET as getWaitlist,
  POST as postWaitlist,
  DELETE as deleteWaitlist,
} from "../../app/api/v1/circles/[id]/waitlist/route";
import { GET as getCircles, POST as postCircles } from "../../app/api/v1/circles/route";
import { GET as getCircle } from "../../app/api/v1/circles/[id]/route";
import { POST as joinCircle } from "../../app/api/v1/circles/[id]/join/route";
import { POST as leaveCircle } from "../../app/api/v1/circles/[id]/leave/route";
import { GET as getHealth } from "../../app/api/v1/health/route";
import { POST as sendOtp } from "../../app/api/v1/auth/send-otp/route";
import { POST as verifyOtp } from "../../app/api/v1/auth/verify-otp/route";
import { POST as logout } from "../../app/api/v1/auth/logout/route";

function normalizeHeaders(rawHeaders: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (!name || value == null) continue;
    if (Array.isArray(value)) {
      headers.set(name, value.join(","));
    } else if (typeof value === "string") {
      headers.set(name, value);
    }
  }
  return headers;
}

type ParsedRoute =
  | { route: "health" }
  | { route: "profile" }
  | { route: "circles" }
  | { route: "circle"; circleId: string }
  | { route: "circleJoin"; circleId: string }
  | { route: "circleLeave"; circleId: string }
  | { route: "waitlist"; circleId: string }
  | { route: "authSendOtp" }
  | { route: "authVerifyOtp" }
  | { route: "authLogout" };

function parseRoute(pathname: string): ParsedRoute | null {
  if (pathname === "/api/v1/health") return { route: "health" };
  if (pathname === "/api/v1/profile") return { route: "profile" };
  if (pathname === "/api/v1/circles") return { route: "circles" };
  if (pathname === "/api/v1/auth/send-otp") return { route: "authSendOtp" };
  if (pathname === "/api/v1/auth/verify-otp") return { route: "authVerifyOtp" };
  if (pathname === "/api/v1/auth/logout") return { route: "authLogout" };

  const circleMatch = pathname.match(/^\/api\/v1\/circles\/([^/]+)\/?$/);
  if (circleMatch) return { route: "circle", circleId: circleMatch[1] };

  const joinMatch = pathname.match(/^\/api\/v1\/circles\/([^/]+)\/join\/?$/);
  if (joinMatch) return { route: "circleJoin", circleId: joinMatch[1] };

  const leaveMatch = pathname.match(/^\/api\/v1\/circles\/([^/]+)\/leave\/?$/);
  if (leaveMatch) return { route: "circleLeave", circleId: leaveMatch[1] };

  const waitlistMatch = pathname.match(/^\/api\/v1\/circles\/([^/]+)\/waitlist\/?$/);
  if (waitlistMatch) return { route: "waitlist", circleId: waitlistMatch[1] };

  return null;
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function createTestServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const method = req.method?.toUpperCase() ?? "GET";
      const headers = normalizeHeaders(req.headers);

      let bodyInit: BodyInit | undefined;
      if (!["GET", "HEAD"].includes(method)) {
        const rawBody = await readBody(req);
        bodyInit = rawBody.length > 0 ? rawBody : undefined;
      }

      const nextRequest = new NextRequest(url.href, { method, headers, body: bodyInit });

      const route = parseRoute(url.pathname);
      if (!route) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Route not found" }));
        return;
      }

      let nextResponse: Response | undefined;

      switch (route.route) {
        case "health":
          if (method === "GET") nextResponse = await getHealth();
          break;

        case "profile":
          if (method === "GET") nextResponse = await getProfile();
          else if (method === "PATCH") nextResponse = await patchProfile(nextRequest);
          break;

        case "circles":
          if (method === "GET") nextResponse = await getCircles(nextRequest);
          else if (method === "POST") nextResponse = await postCircles(nextRequest);
          break;

        case "circle": {
          const ctx = { params: { id: route.circleId } };
          if (method === "GET") nextResponse = await getCircle(nextRequest, ctx);
          break;
        }

        case "circleJoin": {
          const ctx = { params: { id: route.circleId } };
          if (method === "POST") nextResponse = await joinCircle(nextRequest, ctx);
          break;
        }

        case "circleLeave": {
          const ctx = { params: { id: route.circleId } };
          if (method === "POST") nextResponse = await leaveCircle(nextRequest, ctx);
          break;
        }

        case "waitlist": {
          const ctx = { params: { id: route.circleId } };
          if (method === "GET") nextResponse = await getWaitlist(nextRequest, ctx);
          else if (method === "POST") nextResponse = await postWaitlist(nextRequest, ctx);
          else if (method === "DELETE") nextResponse = await deleteWaitlist(nextRequest, ctx);
          break;
        }

        case "authSendOtp":
          if (method === "POST") nextResponse = await sendOtp(nextRequest);
          break;

        case "authVerifyOtp":
          if (method === "POST") nextResponse = await verifyOtp(nextRequest);
          break;

        case "authLogout":
          if (method === "POST") nextResponse = await logout(nextRequest);
          break;
      }

      if (!nextResponse) {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Method not allowed" }));
        return;
      }

      nextResponse.headers.forEach((value, name) => {
        res.setHeader(name, value);
      });
      res.statusCode = nextResponse.status;
      const payload = await nextResponse.text();
      res.end(payload);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: String(error) }));
    }
  });
}
