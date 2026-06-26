import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Help Center - Ajosave",
  description: "Learn how to set up your Stellar wallet and use Ajosave",
};

export default function HelpPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Help Center</h1>
        <p className={styles.subtitle}>
          Step-by-step guides to get you started with Ajosave
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Setting Up Your Stellar Wallet</h2>
          <p className={styles.text}>
            Ajosave uses the Stellar blockchain for all transactions. To receive payouts, {"you'll"} 
            need a Stellar wallet. We recommend <strong>Freighter</strong> for desktop or 
            <strong>LOBSTR</strong> for mobile.
          </p>

          <div className={styles.guide}>
            <h3>1. Create Your Wallet</h3>
            <p>
              Download your preferred wallet and follow the instructions to create a new account. 
              <strong>Crucial:</strong> Save your &quot;Recovery Phrase&quot; (12 or 24 words) in a safe, 
              offline place. If you lose this, you lose access to your funds forever.
            </p>

            <h3>2. Add a USDC Trustline</h3>
            <p>
              Stellar requires you to explicitly &quot;trust&quot; an asset before you can receive it. 
              In your wallet app, look for &quot;Add Asset&quot; or &quot;Trustlines&quot; and search for 
              <strong>USDC</strong> (issued by circle.com).
            </p>

            <h3>3. Save Your Address to Profile</h3>
            <p>
              Copy your Stellar Public Key (starts with &quot;G&quot;) and paste it into your 
              <a href="/profile" className={styles.link}>Ajosave Profile</a>. This ensures your 
              payouts are always sent to the right place.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Joining and Contributing</h2>
          <div className={styles.guide}>
            <h3>How to Join</h3>
            <p>
              Browse public circles on the dashboard. Check the contribution amount and 
              frequency to make sure it fits your budget. Once you join, {"you'll"} see the circle 
              in your &quot;My Circles&quot; list.
            </p>

            <h3>Making Contributions</h3>
            <p>
              When a new cycle starts, {"you'll"} receive an SMS reminder. Go to the circle details 
              page and click &quot;Contribute Now&quot;. {"You'll"} be redirected to Paystack to pay with 
              your preferred Naira method (card, bank transfer, or USSD).
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Troubleshooting</h2>
          <div className={styles.faq}>
            <h4>{"I didn't receive my payout"}</h4>
            <p>
              Check your Stellar wallet to ensure you have a USDC trustline. If you {"don't"}, 
              the transaction will fail. Once you add the trustline, our system will 
              automatically retry the payout within 24 hours.
            </p>

            <h4>{"My contribution isn't showing as confirmed"}</h4>
            <p>
              Paystack payments usually confirm within seconds, but sometimes take up to 
              10 minutes. If it {"hasn't"} confirmed after 30 minutes, please contact support with 
              your transaction reference.
            </p>
          </div>
        </section>

        <div className={styles.support}>
          <h3>Need more help?</h3>
          <p>
            Email us at <a href="mailto:support@ajosave.app">support@ajosave.app</a> or 
            join our <a href="https://t.me/ajosave" target="_blank" rel="noopener noreferrer">Telegram community</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
