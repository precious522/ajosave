"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCircleSchema, type CreateCircleInput } from "@/types/schemas";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CreateCircleForm.module.css";

export function CreateCircleForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateCircleInput>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: { 
      cycleFrequency: "monthly",
      circleType: "public"
    },
  });

  const onSubmit = async (data: CreateCircleInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push(`/circles/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className={styles.title}>Create a Circle</h2>

      <Input label="Circle Name" placeholder="e.g. Lagos Girls Monthly Ajo"
        error={errors.name?.message} {...register("name")} />

      <Input label="Contribution Amount (₦)" type="number" placeholder="10000"
        error={errors.contributionNgn?.message}
        {...register("contributionNgn", { valueAsNumber: true })} />

      <Input label="Number of Members" type="number" placeholder="5" min={2} max={20}
        error={errors.maxMembers?.message}
        {...register("maxMembers", { valueAsNumber: true })} />

      <div className="input-group">
        <label className="input-label" htmlFor="cycleFrequency">Cycle Frequency</label>
        <select id="cycleFrequency" className="input" {...register("cycleFrequency")}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="circleType">Circle Type</label>
        <select id="circleType" className="input" {...register("circleType")}>
          <option value="public">Public (Anyone can join)</option>
          <option value="private">Private (Requires approval)</option>
        </select>
        <small className="input-hint">
          Private circles require you to approve each join request
        </small>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Button type="submit" fullWidth loading={loading}>Create Circle</Button>
    </form>
  );
}
