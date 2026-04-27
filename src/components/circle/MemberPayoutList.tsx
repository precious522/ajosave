"use client";

import { useState } from "react";
import type { Circle, Member } from "@/types";
import { Button } from "@/components/ui/Button";
import { CopyableText } from "@/components/ui/CopyableText";
import styles from "./MemberPayoutList.module.css";

interface Props {
  circle: Circle;
  initialMembers: Member[];
  isCreator: boolean;
}

export function MemberPayoutList({ circle, initialMembers, isCreator }: Props) {
  const [members, setMembers] = useState<Member[]>(
    [...initialMembers].sort((a, b) => a.position - b.position)
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
        {isCreator && circle.status === "open" && (
          <Button variant="ghost" size="sm" onClick={handleShuffle} loading={shuffling}>
            🔀 Randomize
          </Button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {members.length === 0 ? (
        <p className={styles.empty}>No members yet.</p>
      ) : (
        <ol className={styles.list} aria-label="Payout rotation order">
          {members.map((m) => {
            const isCurrent = circle.status === "active" && m.position === circle.currentCycle;
            const isPast = m.hasReceivedPayout;

            return (
              <li
                key={m.id}
                className={`${styles.item} ${isCurrent ? styles.current : ""} ${isPast ? styles.past : ""}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span className={styles.cycle} aria-label={`Cycle ${m.position}`}>
                  {m.position}
                </span>

                <span className={styles.memberId}>
                  <CopyableText
                    text={m.userId}
                    displayText={`Member ${m.userId.slice(0, 8)}…`}
                    label="Copy member ID"
                  />
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
