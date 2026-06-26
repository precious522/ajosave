import styles from "./MemberAvatar.module.css";

interface Props {
  displayName?: string;
  userId: string;
}

function getInitials(displayName?: string, userId?: string): string {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return userId ? userId.slice(0, 2).toUpperCase() : "??";
}

function truncateAddress(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function MemberAvatar({ displayName, userId }: Props) {
  const initials = getInitials(displayName, userId);
  const tooltip = displayName
    ? `${displayName} (${truncateAddress(userId)})`
    : truncateAddress(userId);

  return (
    <span className={styles.avatar} title={tooltip} aria-label={tooltip}>
      {initials}
    </span>
  );
}
