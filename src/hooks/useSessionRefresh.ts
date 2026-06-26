"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Silently refreshes the JWT before the access token expires.
 * Drop this hook into any layout that requires authentication.
 */
export function useSessionRefresh() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session) return;

    // Force logout if refresh token has expired
    if ((session as { error?: string }).error === "RefreshTokenExpired") {
      signOut({ callbackUrl: "/auth/login" });
      return;
    }

    const expires = (session as { accessTokenExpires?: number }).accessTokenExpires;
    if (!expires) return;

    // Schedule a router refresh 30 s before the access token expires
    const msUntilRefresh = expires * 1000 - Date.now() - 30_000;
    if (msUntilRefresh <= 0) return;

    const timer = setTimeout(() => {
      // Triggering getSession() causes next-auth to call the jwt callback,
      // which issues a new access token window without a full page reload.
      import("next-auth/react").then(({ getSession }) => getSession());
    }, msUntilRefresh);

    return () => clearTimeout(timer);
  }, [session]);
}
