import * as http from "http";
import { NextRequest } from "next/server";
import { GET as getProfile, PATCH as patchProfile } from "../../app/api/v1/profile/route";
import {
  GET as getWaitlist,
  POST as postWaitlist,
  DELETE as deleteWaitlist,
} from "../../app/api/v1/circles/[id]/waitlist/route";

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

function parseRoute(pathname: string) {
  const waitlistMatch = pathname.match(/^\/api\/v1\/circles\/([^/]+)\/waitlist\/?$/);
  if (waitlistMatch) {
    return { route: "waitlist", circleId: waitlistMatch[1] };
  }

  if (pathname === "/api/v1/profile") {
    return { route: "profile" };
  }

  return null;
}

export function createTestServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const method = req.method?.toUpperCase() ?? "GET";
      const headers = normalizeHeaders(req.headers);
      const body = ["GET", "HEAD"].includes(method) ? undefined : (req as unknown as BodyInit);
      const nextRequest = new NextRequest(url.href, { method, headers, body });

      const route = parseRoute(url.pathname);
      if (!route) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Route not found" }));
        return;
      }

      let nextResponse;
      if (route.route === "profile") {
        if (method === "GET") {
          nextResponse = await getProfile();
        } else if (method === "PATCH") {
          nextResponse = await patchProfile(nextRequest);
        } else {
          res.writeHead(405, { Allow: "GET, PATCH" });
          res.end();
          return;
        }
      } else if (route.route === "waitlist") {
        const ctx = { params: { id: route.circleId } };
        if (method === "GET") {
          nextResponse = await getWaitlist(nextRequest, ctx);
        } else if (method === "POST") {
          nextResponse = await postWaitlist(nextRequest, ctx);
        } else if (method === "DELETE") {
          nextResponse = await deleteWaitlist(nextRequest, ctx);
        } else {
          res.writeHead(405, { Allow: "GET, POST, DELETE" });
          res.end();
          return;
        }
      }

      if (!nextResponse) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "No response from route handler" }));
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
