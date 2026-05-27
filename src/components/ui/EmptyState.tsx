import Link from "next/link";
import styles from "./EmptyState.module.css";

interface Cta {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  title: string;
  description: string;
  ctas?: Cta[];
  /** "circles" shows the rotating-circle SVG; "search" shows a magnifier */
  illustration?: "circles" | "search";
}

export function EmptyState({
  title,
  description,
  ctas = [],
  illustration = "circles",
}: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <div className={styles.illustration} aria-hidden="true">
        {illustration === "circles" ? <CirclesIllustration /> : <SearchIllustration />}
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {ctas.length > 0 && (
        <div className={styles.ctas}>
          {ctas.map((cta) => (
            <Link
              key={cta.href}
              href={cta.href}
              className={`btn btn--${cta.variant ?? "primary"}`}
            >
              {cta.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CirclesIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Empty savings circle illustration"
    >
      <circle cx="48" cy="48" r="44" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="6 4" />
      <circle cx="48" cy="20" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-brand-primary)" strokeWidth="2" />
      <circle cx="72" cy="34" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="72" cy="62" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="48" cy="76" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="24" cy="62" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="24" cy="34" r="6" fill="var(--color-bg-elevated)" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="48" cy="48" r="10" fill="var(--color-brand-primary)" opacity="0.15" />
      <text x="48" y="53" textAnchor="middle" fontSize="14" fill="var(--color-brand-primary)">₦</text>
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="No results found illustration"
    >
      <circle cx="42" cy="42" r="28" stroke="var(--color-border)" strokeWidth="2.5" />
      <circle cx="42" cy="42" r="18" fill="var(--color-brand-primary)" opacity="0.08" />
      <line x1="62" y1="62" x2="80" y2="80" stroke="var(--color-border)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="42" x2="50" y2="42" stroke="var(--color-border)" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="34" x2="42" y2="50" stroke="var(--color-border)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
