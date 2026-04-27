import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import styles from "./Navbar.module.css";

export async function Navbar() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  return (
    <header className={styles.header}>
      <nav className={`container ${styles.nav}`} aria-label="Main navigation">
        <Link href="/" className={styles.logo} aria-label="Ajosave home">
          <span className={styles.logoMark}>A</span>
          <span className={styles.logoText}>Ajosave</span>
        </Link>
        <ul className={styles.links} role="list">
          <li><Link href="/circles" className={styles.link}>Browse Circles</Link></li>
          <li><Link href="/dashboard" className={styles.link}>Dashboard</Link></li>
          {isAdmin && <li><Link href="/admin" className={styles.link}>Admin</Link></li>}
          <li><Link href="/auth/login" className="btn btn--primary btn--sm">Sign In</Link></li>
        </ul>
      </nav>
    </header>
  );
}
