"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
    >
      {children}
    </Link>
  );
}
