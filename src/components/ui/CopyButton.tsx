"use client";

import { useState } from "react";
import styles from "./CopyButton.module.css";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={handleCopy}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M13.5 4L6 11.5L2.5 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="5.5"
            y="5.5"
            width="8"
            height="8"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10.5 5.5V3.5C10.5 2.67157 9.82843 2 9 2H3C2.17157 2 1.5 2.67157 1.5 3.5V9.5C1.5 10.3284 2.17157 11 3 11H5.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
      <span className="sr-only">{copied ? "Copied!" : label}</span>
    </button>
  );
}
