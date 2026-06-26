"use client";

import { lazy, Suspense } from "react";

const CircleChat = lazy(() => import("./CircleChat").then((mod) => ({ default: mod.CircleChat })));

interface LazyCircleChatProps {
  circleId: string;
  isActiveMember: boolean;
  currentUserId: string;
}

export function LazyCircleChat({ circleId, isActiveMember, currentUserId }: LazyCircleChatProps) {
  return (
    <Suspense fallback={<div>Loading chat…</div>}>
      <CircleChat circleId={circleId} isActiveMember={isActiveMember} currentUserId={currentUserId} />
    </Suspense>
  );
}
