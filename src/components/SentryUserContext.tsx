"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";

/**
 * Sets anonymized Sentry user context from the active session.
 * Only the hashed/opaque user id is sent — no PII.
 */
export function SentryUserContext() {
  const { data: session } = useSession();

  useEffect(() => {
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  return null;
}
