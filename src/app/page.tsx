"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import styles from "./page.module.css";

export default function HomePage() {
  const t = useTranslations();

  const FEATURES = [
    { icon: "🔐", title: "Trustless Contracts", desc: "Soroban smart contracts enforce contributions and automate payouts — no one can cheat or disappear with the pot." },
    { icon: "💵", title: "Stable in USDC", desc: "Contributions are held in USDC so the pot value never changes between the first and last payout." },
    { icon: "⚡", title: "Near-Zero Fees", desc: "Stellar's high-speed network means almost nothing is lost to transaction fees." },
    { icon: "📊", title: "On-Chain Reputation", desc: "Every on-time contribution builds your reputation score — unlocking access to larger circles." },
    { icon: "🌍", title: "Local Currency Ramps", desc: "Contribute in your local currency (NGN, GBP, EUR, USD). Receive payouts directly to your wallet." },
    { icon: "🔄", title: "Automatic Rotation", desc: "The contract handles the rotation order and payout schedule — no coordinator needed." },
  ];

  const STEPS = [
    { title: "Create or join a circle", desc: "Set the contribution amount, number of members, and cycle frequency — or browse open circles to join." },
    { title: "Contribute each cycle", desc: "Pay your contribution in your local currency via Paystack. It's converted to USDC and locked in the smart contract." },
    { title: "Receive your payout", desc: "When it's your turn in the rotation, the full pot is automatically sent to your Stellar wallet." },
    { title: "Build your reputation", desc: "Every completed circle adds to your on-chain reputation score, unlocking bigger circles." },
  ];

  return (
    <>
      <section className={styles.hero}>
        <div className={`container container--content ${styles.heroInner}`}>
          <div className={styles.badge}>{t("home.poweredBy")}</div>
          <h1 className={styles.headline}>
            {t("home.heroTitle")}
            <br />
            <span className={styles.highlight}>trustless &amp; on-chain</span>
          </h1>
          <p className={styles.subheadline}>
            {t("home.heroSubtitle")}
          </p>
          <div className={styles.cta}>
            <Link href="/circles/create" className="btn btn--accent btn--lg">{t("home.startCircle")}</Link>
            <Link href="/circles" className="btn btn--secondary btn--lg">{t("home.browseCircles")}</Link>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className="container">
          <h2 className={styles.sectionTitle}>{t("home.whyAjosave")}</h2>
          <div className={styles.grid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={`card ${styles.featureCard}`}>
                <span className={styles.icon} aria-hidden>{f.icon}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.steps}>
        <div className="container container--content">
          <h2 className={styles.sectionTitle}>{t("home.howItWorks")}</h2>
          <ol className={styles.stepList}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
