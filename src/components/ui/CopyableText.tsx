"use client";

import { CopyButton } from "./CopyButton";
import styles from "./CopyableText.module.css";

interface CopyableTextProps {
  text: string;
  displayText?: string;
  label?: string;
  monospace?: boolean;
}

export function CopyableText({
  text,
  displayText,
  label = "Copy",
  monospace = true,
}: CopyableTextProps) {
  return (
    <span className={styles.container}>
      <span className={monospace ? styles.monospace : undefined}>
        {displayText || text}
      </span>
      <CopyButton text={text} label={label} />
    </span>
  );
}
