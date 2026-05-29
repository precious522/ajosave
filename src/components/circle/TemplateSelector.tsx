"use client";

import styles from "./TemplateSelector.module.css";
import { CircleTemplate } from "@/data/circleTemplates";

interface TemplateSelectorProps {
  templates: CircleTemplate[];
  activeTemplateId: string | null;
  onSelect: (template: CircleTemplate | null) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GBP: "£",
  USD: "$",
  EUR: "€",
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    default:
      return frequency;
  }
}

export function TemplateSelector({
  templates,
  activeTemplateId,
  onSelect,
}: TemplateSelectorProps) {
  const isBlankActive = activeTemplateId === null;

  return (
    <div className={styles.container}>
      <div className={styles.scrollRow} role="group" aria-label="Circle templates">
        {/* Blank card */}
        <button
          type="button"
          className={`${styles.card} ${isBlankActive ? styles.cardActive : ""}`}
          aria-pressed={isBlankActive}
          onClick={() => onSelect(null)}
        >
          <span className={styles.cardName}>Blank</span>
          <span className={styles.cardMeta}>Start from scratch</span>
        </button>

        {/* Template cards */}
        {templates.map((template) => {
          const isActive = template.id === activeTemplateId;
          const symbol = getCurrencySymbol(template.values.contributionCurrency);
          return (
            <button
              key={template.id}
              type="button"
              className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
              aria-pressed={isActive}
              onClick={() => onSelect(template)}
            >
              <span className={styles.cardName}>{template.name}</span>
              <span className={styles.cardAmount}>
                {symbol}
                {template.values.contributionAmount.toLocaleString()}
              </span>
              <span className={styles.cardMeta}>
                {template.values.maxMembers} members ·{" "}
                {formatFrequency(template.values.cycleFrequency)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
