import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") redirect("/");

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>Admin Dashboard</h1>
        </div>
        <AdminDashboard />
      </div>
    </div>
  );
}
