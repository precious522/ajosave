import { SignJWT, jwtVerify } from "jose";
import { serverConfig } from "@/server/config";

const SECRET = new TextEncoder().encode(serverConfig.authSecret);

export async function createInviteToken(circleId: string): Promise<string> {
  return await new SignJWT({ circleId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifyInviteToken(token: string): Promise<{ circleId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as { circleId: string };
  } catch (err) {
    console.error("[verifyInviteToken] Invalid or expired token:", err);
    return null;
  }
}
