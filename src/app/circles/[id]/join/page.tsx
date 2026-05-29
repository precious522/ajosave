import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { verifyInviteToken } from "@/lib/tokens";
import { JoinCircleForm } from "@/components/circle/JoinCircleForm";
import styles from "./page.module.css";

interface Props {
  params: { id: string };
  searchParams: { token?: string };
}

export default async function JoinCirclePage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const callbackUrl = `/circles/${params.id}/join${searchParams.token ? `?token=${searchParams.token}` : ""}`;
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const [circle, members] = await Promise.all([
    getCircleById(params.id),
    getMembersByCircle(params.id),
  ]);

  if (!circle) notFound();

  // If already a member, redirect to detail page
  const userId = (session.user as { id: string }).id;
  if (members.some((m) => m.userId === userId)) {
    redirect(`/circles/${params.id}`);
  }

  let inviteValid = false;
  let inviteError: string | null = null;

  if (searchParams.token) {
    const decoded = await verifyInviteToken(searchParams.token);
    if (decoded && decoded.circleId === params.id) {
      inviteValid = true;
    } else {
      inviteError = "This invite link is invalid or has expired.";
    }
  }

  // If the circle is private and there's no valid invite token, show error
  if (circle.circleType === "private" && !inviteValid) {
    inviteError = inviteError || "This is a private circle. You need a valid invite link to join.";
  }

  return (
    <div className={styles.page}>
      <div className="container container--sm">
        <h1 className={styles.title}>Join {circle.name}</h1>
        
        {inviteError && (
          <div className={styles.errorCard}>
            <p>{inviteError}</p>
          </div>
        )}

        {(!inviteError || inviteValid) && (
          <JoinCircleForm 
            circle={circle} 
            token={searchParams.token} 
            inviteValid={inviteValid}
          />
        )}
      </div>
    </div>
  );
}
