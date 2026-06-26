"use client";

import { useState } from "react";
import type { Circle, Member } from "@/types";
import { Button } from "@/components/ui/Button";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import styles from "./MemberPayoutList.module.css";

interface Props {
  circle: Circle;
  initialMembers: Member[];
  isCreator: boolean;
  currentUserId?: string;
}

export function MemberPayoutList({ circle, initialMembers, isCreator, currentUserId }: Props) {
  const [members, setMembers] = useState<Member[]>(
    [...initialMembers].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  );
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShuffle = async () => {
    setShuffling(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/shuffle`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMembers(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shuffle failed");
    } finally {
      setShuffling(false);
    }
  };

  return (
    <div className="card">
      <div className={styles.header}>
        <h2 className={styles.title}>
          Payout Order <span className={styles.count}>({members.length})</span>
        </h2>
        {isCreator && circle.status === "open" && circle.payoutMethod !== "randomized" && (
          <Button variant="ghost" size="sm" onClick={handleShuffle} loading={shuffling}>
            🔀 Randomize
          </Button>
        )}
      </div>

      {circle.payoutMethod === "randomized" && circle.randomizationSeed && (
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", wordBreak: "break-all" }}>
          🔒 Order locked · Seed: <code>{circle.randomizationSeed}</code>
        </p>
      )}
      {circle.payoutMethod === "randomized" && !circle.randomizationSeed && (
        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
          🎲 Order will be randomized and locked when the circle fills.
        </p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {members.length === 0 ? (
        <p className={styles.empty}>No members yet.</p>
      ) : (
        <ol className={styles.list} aria-label="Payout rotation order">
          {members.map((m) => {
            const isCurrent = circle.status === "active" && m.position === circle.currentCycle;
            const isPast = m.hasReceivedPayout;
            const isMe = !!currentUserId && m.userId === currentUserId;

            return (
              <li
                key={m.id}
                className={[
                  styles.item,
                  isCurrent ? styles.current : "",
                  isPast ? styles.past : "",
                  isMe ? styles.me : "",
                ].join(" ")}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className={styles.cycle} aria-label={`Cycle ${m.position}`}>
                  {m.position}
                </span>

                <MemberAvatar displayName={m.displayName} userId={m.userId} />

                <span className={styles.memberName}>
                  {m.displayName ?? `Member ${m.userId.slice(0, 8)}…`}
                  {isMe && <span className={styles.youBadge}>you</span>}
                </span>

                <span className={styles.statusTag}>
                  {isPast && <span className={`${styles.tag} ${styles.tagDone}`}>Paid out ✓</span>}
                  {isCurrent && <span className={`${styles.tag} ${styles.tagActive}`}>Receiving now</span>}
                  {!isPast && !isCurrent && circle.status === "active" && (
                    <span className={`${styles.tag} ${styles.tagPending}`}>Cycle {m.position}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
