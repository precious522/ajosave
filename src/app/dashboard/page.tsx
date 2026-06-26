import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getCirclesByUser } from "@/server/services/circle.service";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";
import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const userId = (session.user as { id: string }).id;
  const circles = await getCirclesByUser(userId);

  return (
    <div className={styles.page}>
      <div className="container">
        <LiveDashboard initialCircles={circles} />
      </div>
    </div>
  );
}
