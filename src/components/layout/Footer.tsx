import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.section}>
            <h3 className={styles.heading}>Ajosave</h3>
            <p className={styles.description}>
              Trustless rotating savings circles on the Stellar blockchain.
              Traditional Ajo, now with smart contracts.
            </p>
          </div>

          <div className={styles.section}>
            <h4 className={styles.title}>Product</h4>
            <ul className={styles.links}>
              <li><Link href="/circles" className={styles.link}>Browse Circles</Link></li>
              <li><Link href="/circles/create" className={styles.link}>Create Circle</Link></li>
              <li><Link href="/dashboard" className={styles.link}>Dashboard</Link></li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.title}>Resources</h4>
            <ul className={styles.links}>
              <li><Link href="/faq" className={styles.link}>FAQ</Link></li>
              <li><Link href="/help" className={styles.link}>Help Center</Link></li>
              <li>
                <a 
                  href="https://github.com/JosephOnuh/ajosave" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.link}
                >
                  GitHub
                </a>
              </li>
              <li>
                <a 
                  href="https://stellar.org" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.link}
                >
                  About Stellar
                </a>
              </li>
            </ul>
          </div>

          <div className={styles.section}>
            <h4 className={styles.title}>Legal</h4>
            <ul className={styles.links}>
              <li>
                <a 
                  href="https://github.com/JosephOnuh/ajosave/blob/main/LICENSE" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.link}
                >
                  License
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/JosephOnuh/ajosave/blob/main/SECURITY.md" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.link}
                >
                  Security
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com/JosephOnuh/ajosave/blob/main/CODE_OF_CONDUCT.md" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.link}
                >
                  Code of Conduct
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Ajosave. Open source under MIT License.
          </p>
          <p className={styles.built}>
            Built on <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className={styles.stellarLink}>Stellar</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
