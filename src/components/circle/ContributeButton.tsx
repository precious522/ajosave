"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ContributeButton({ circleId }: { circleId: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleContribute = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/contribute`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast("Redirecting to payment…", "info");
      window.location.href = json.data.authorizationUrl;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to initiate payment", "error");
      setLoading(false);
    }
  };

  return (
    <Button variant="accent" onClick={handleContribute} loading={loading}>
      Contribute Now
    </Button>
  );
}
