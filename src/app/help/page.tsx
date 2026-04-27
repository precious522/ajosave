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
          
          <div className={styles.guide}>
            <p className={styles.intro}>
              To receive payouts from Ajosave, you need a Stellar wallet. We recommend using one of 
              these trusted wallet providers:
            </p>

            <div className={styles.walletOptions}>
              <div className={styles.walletCard}>
                <h3 className={styles.walletName}>Lobstr (Recommended)</h3>
                <p className={styles.walletDesc}>
                  User-friendly mobile wallet with built-in USDC support. Perfect for beginners.
                </p>
                <ul className={styles.steps}>
                  <li>Download Lobstr from <a href="https://lobstr.co" target="_blank" rel="noopener noreferrer" className={styles.link}>lobstr.co</a></li>
                  <li>Create a new wallet and securely save your recovery phrase</li>
                  <li>Enable USDC as a trusted asset in the app</li>
                  <li>Copy your public key (starts with 'G') and add it to your Ajosave profile</li>
                </ul>
              </div>

              <div className={styles.walletCard}>
                <h3 className={styles.walletName}>Freighter</h3>
                <p className={styles.walletDesc}>
                  Browser extension wallet for desktop users. Works like MetaMask for Stellar.
                </p>
                <ul className={styles.steps}>
                  <li>Install Freighter extension from <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className={styles.link}>freighter.app</a></li>
                  <li>Create a new wallet and back up your recovery phrase</li>
                  <li>Add USDC trustline (Asset Code: USDC, Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)</li>
                  <li>Copy your public key from the extension</li>
                </ul>
              </div>

              <div className={styles.walletCard}>
                <h3 className={styles.walletName}>Solar Wallet</h3>
                <p className={styles.walletDesc}>
                  Full-featured wallet with advanced options for experienced users.
                </p>
                <ul className={styles.steps}>
                  <li>Download Solar from <a href="https://solarwallet.io" target="_blank" rel="noopener noreferrer" className={styles.link}>solarwallet.io</a></li>
                  <li>Create a new account and save your secret key securely</li>
                  <li>Add USDC asset to your account</li>
                  <li>Use your public key for Ajosave payouts</li>
                </ul>
              </div>
            </div>

            <div className={styles.warning}>
              <strong>⚠️ Important Security Tips:</strong>
              <ul>
                <li>Never share your secret key or recovery phrase with anyone</li>
                <li>Write down your recovery phrase on paper and store it safely</li>
                <li>Only share your public key (starts with 'G') — this is safe to share</li>
                <li>Ajosave will never ask for your secret key</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How to Make a Contribution</h2>
          
          <div className={styles.guide}>
            <ol className={styles.stepsList}>
              <li className={styles.stepItem}>
                <strong>Check your dashboard</strong> — You'll see when your next contribution is due
              </li>
              <li className={styles.stepItem}>
                <strong>Click "Contribute"</strong> on the circle card
              </li>
              <li className={styles.stepItem}>
                <strong>Pay via Paystack</strong> — Enter your card details or use bank transfer
              </li>
              <li className={styles.stepItem}>
                <strong>Wait for confirmation</strong> — Your payment is converted to USDC and locked in the smart contract
              </li>
              <li className={styles.stepItem}>
                <strong>Get SMS confirmation</strong> — You'll receive a text confirming your contribution
              </li>
            </ol>

            <div className={styles.tip}>
              <strong>💡 Pro Tip:</strong> Set a reminder on your phone for contribution day to avoid missing payments 
              and damaging your reputation score.
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Understanding Circle Types</h2>
          
          <div className={styles.guide}>
            <div className={styles.comparisonTable}>
              <div className={styles.tableRow}>
                <div className={styles.tableHeader}>Feature</div>
                <div className={styles.tableHeader}>Public Circle</div>
                <div className={styles.tableHeader}>Private Circle</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell}><strong>Who can join</strong></div>
                <div className={styles.tableCell}>Anyone</div>
                <div className={styles.tableCell}>Approved members only</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell}><strong>Approval needed</strong></div>
                <div className={styles.tableCell}>No</div>
                <div className={styles.tableCell}>Yes (creator approves)</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell}><strong>Best for</strong></div>
                <div className={styles.tableCell}>Open community savings</div>
                <div className={styles.tableCell}>Friends, family, trusted groups</div>
              </div>
              <div className={styles.tableRow}>
                <div className={styles.tableCell}><strong>Start time</strong></div>
                <div className={styles.tableCell}>When full</div>
                <div className={styles.tableCell}>When creator approves enough members</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Troubleshooting</h2>
          
          <div className={styles.guide}>
            <div className={styles.faqItem}>
              <h3 className={styles.question}>My payment failed. What should I do?</h3>
              <p className={styles.answer}>
                Check that your card has sufficient funds and is enabled for online payments. If the 
                problem persists, try a different payment method or contact your bank. You can retry 
                the contribution from your dashboard.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.question}>I didn't receive my payout. Where is it?</h3>
              <p className={styles.answer}>
                Check your Stellar wallet — payouts are sent as USDC. Make sure you've added the USDC 
                trustline to your wallet. If you still don't see it after 10 minutes, check the 
                transaction hash on <a href="https://stellar.expert" target="_blank" rel="noopener noreferrer" className={styles.link}>stellar.expert</a> 
                or contact support.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.question}>I forgot my Stellar wallet password. Can you help?</h3>
              <p className={styles.answer}>
                Ajosave doesn't have access to your wallet. Contact your wallet provider (Lobstr, Freighter, etc.) 
                for recovery options. If you saved your recovery phrase, you can restore your wallet on a new device.
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.question}>How do I convert USDC back to Naira?</h3>
              <p className={styles.answer}>
                You can use Nigerian crypto exchanges like Busha, Quidax, or Luno to sell your USDC for Naira. 
                Send your USDC from your Stellar wallet to the exchange, sell it, and withdraw to your bank account.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Still Need Help?</h2>
          
          <div className={styles.contactBox}>
            <p>Can't find what you're looking for? We're here to help!</p>
            <ul className={styles.contactList}>
              <li>📧 Email: <a href="mailto:support@ajosave.app" className={styles.link}>support@ajosave.app</a></li>
              <li>💬 Check our <a href="/faq" className={styles.link}>FAQ page</a> for more answers</li>
              <li>📱 Follow us on Twitter <a href="https://twitter.com/ajosave" target="_blank" rel="noopener noreferrer" className={styles.link}>@ajosave</a> for updates</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
