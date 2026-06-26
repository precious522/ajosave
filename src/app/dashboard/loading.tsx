import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import styles from "./page.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.page}>
      <div className="container">
        <DashboardSkeleton count={3} />
      </div>
    </div>
  );
}
