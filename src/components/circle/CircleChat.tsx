"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import type { CircleMessage } from "@/types";
import { format } from "date-fns";
import styles from "./CircleChat.module.css";

interface CircleChatProps {
  circleId: string;
  isActiveMember: boolean;
  currentUserId: string;
}

const LIMIT = 50;

const fetchMessages = async (
  circleId: string,
  limit: number,
  before?: string
): Promise<CircleMessage[]> => {
  const url = `/api/circles/${circleId}/chat?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load messages");
  const json = await res.json();
  return json.data as CircleMessage[];
};

const sendMessage = async (
  circleId: string,
  content: string
): Promise<CircleMessage> => {
  const res = await fetch(`/api/circles/${circleId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  const json = await res.json();
  return json.data as CircleMessage;
};

function deduplicateById(messages: CircleMessage[]): CircleMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function CircleChat({
  circleId,
  isActiveMember,
  currentUserId,
}: CircleChatProps) {
  const queryClient = useQueryClient();

  // Local state for the combined message list
  const [messages, setMessages] = useState<CircleMessage[]>([]);
  // Extra messages received via WebSocket (appended in real-time)
  const [extraMessages, setExtraMessages] = useState<CircleMessage[]>([]);
  // Whether there are potentially more messages to load
  const [hasMore, setHasMore] = useState(false);

  const [inputValue, setInputValue] = useState("");
  const [postError, setPostError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Initial fetch via React Query ──────────────────────────────────────────
  const {
    data: queryData,
    isLoading,
    isError,
    error: queryError,
  } = useQuery<CircleMessage[], Error>({
    queryKey: ["circle-chat", circleId],
    queryFn: () => fetchMessages(circleId, LIMIT),
    enabled: isActiveMember,
    staleTime: 30_000,
  });

  // Populate messages state when initial query resolves
  useEffect(() => {
    if (queryData) {
      setMessages(queryData);
      setHasMore(queryData.length === LIMIT);
    }
  }, [queryData]);

  // ── Combine query messages + real-time extras ──────────────────────────────
  const allMessages = deduplicateById([...messages, ...extraMessages]);

  // ── Auto-scroll to bottom on list update ──────────────────────────────────
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages.length]);

  // ── Real-time updates ──────────────────────────────────────────────────────
  const handleChatMessage = useCallback(
    (data: CircleMessage) => {
      setExtraMessages((prev) => {
        // Only append if not already in the base messages list
        const alreadyInBase = messages.some((m) => m.id === data.id);
        const alreadyInExtra = prev.some((m) => m.id === data.id);
        if (alreadyInBase || alreadyInExtra) return prev;
        return [...prev, data];
      });
    },
    [messages]
  );

  useRealtimeUpdates({
    circleId,
    onChatMessage: handleChatMessage,
  });

  // ── Send message mutation ──────────────────────────────────────────────────
  const mutation = useMutation<CircleMessage, Error, string>({
    mutationFn: (content: string) => sendMessage(circleId, content),
    onSuccess: () => {
      setInputValue("");
      setPostError(null);
      // Invalidate query so the next fetch picks up the new message
      queryClient.invalidateQueries({ queryKey: ["circle-chat", circleId] });
    },
    onError: (err) => {
      setPostError(err.message || "Failed to send message");
    },
  });

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || mutation.isPending) return;
    setPostError(null);
    mutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Load earlier messages ──────────────────────────────────────────────────
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [loadEarlierError, setLoadEarlierError] = useState<string | null>(null);

  const handleLoadEarlier = async () => {
    if (messages.length === 0) return;
    const oldest = messages[0];
    const scrollContainer = listRef.current;

    // Save scroll position before prepending
    const prevScrollHeight = scrollContainer?.scrollHeight ?? 0;
    const prevScrollTop = scrollContainer?.scrollTop ?? 0;

    setIsLoadingEarlier(true);
    setLoadEarlierError(null);

    try {
      const older = await fetchMessages(circleId, LIMIT, oldest.createdAt);
      setMessages((prev) => deduplicateById([...older, ...prev]));
      setHasMore(older.length === LIMIT);

      // Restore scroll position after prepend
      requestAnimationFrame(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop =
            prevScrollTop + (newScrollHeight - prevScrollHeight);
        }
      });
    } catch (err) {
      setLoadEarlierError(
        err instanceof Error ? err.message : "Failed to load earlier messages"
      );
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className={styles.container} aria-label="Circle chat">
      <h2 className={styles.heading}>Circle Chat</h2>

      {/* Loading state */}
      {isLoading && (
        <div className={styles.loading} aria-busy="true" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Loading messages…</span>
        </div>
      )}

      {/* GET error */}
      {isError && (
        <p className={styles.error} role="alert">
          {(queryError as Error)?.message ?? "Failed to load messages"}
        </p>
      )}

      {/* Message list */}
      {!isLoading && !isError && (
        <div
          ref={listRef}
          className={styles.messageList}
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          aria-relevant="additions"
        >
          {/* Load earlier button */}
          {hasMore && (
            <div className={styles.loadEarlier}>
              <button
                className={styles.loadEarlierBtn}
                onClick={handleLoadEarlier}
                disabled={isLoadingEarlier}
                aria-busy={isLoadingEarlier}
              >
                {isLoadingEarlier ? "Loading…" : "Load earlier messages"}
              </button>
              {loadEarlierError && (
                <p className={styles.error} role="alert">
                  {loadEarlierError}
                </p>
              )}
            </div>
          )}

          {allMessages.length === 0 && (
            <p className={styles.empty}>
              No messages yet. Be the first to say something!
            </p>
          )}

          {allMessages.map((msg) => (
            <article
              key={msg.id}
              className={`${styles.message} ${msg.userId === currentUserId ? styles.messageSelf : ""}`}
            >
              <header className={styles.messageHeader}>
                <span className={styles.displayName}>{msg.displayName}</span>
                <time
                  className={styles.timestamp}
                  dateTime={msg.createdAt}
                  title={format(new Date(msg.createdAt), "PPpp")}
                >
                  {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                </time>
              </header>
              <p className={styles.content}>{msg.content}</p>
            </article>
          ))}

          {/* Scroll anchor */}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      )}

      {/* Input area */}
      {isActiveMember ? (
        <div className={styles.inputArea}>
          {postError && (
            <p className={styles.error} role="alert">
              {postError}
            </p>
          )}
          <div className={styles.inputRow}>
            <textarea
              className={styles.textarea}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              aria-label="Message input"
              aria-multiline="true"
              rows={2}
              maxLength={1000}
              disabled={mutation.isPending}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={mutation.isPending || !inputValue.trim()}
              aria-busy={mutation.isPending}
              aria-label="Send message"
            >
              {mutation.isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.readOnlyNotice} role="status">
          Only active members can post messages
        </p>
      )}
    </section>
  );
}
