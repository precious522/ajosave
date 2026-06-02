"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCircleSchema, type CreateCircleInput } from "@/types/schemas";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./CreateCircleForm.module.css";
import { TemplateSelector } from "./TemplateSelector";
import { CIRCLE_TEMPLATES, type CircleTemplate } from "@/data/circleTemplates";

const FORM_DEFAULTS: Partial<CreateCircleInput> = {
  cycleFrequency: "monthly",
  circleType: "public",
  contributionCurrency: "NGN",
  yieldStrategy: "none",
  penaltyPercent: 10,
};

function useUsdcPreview(amount: number | undefined, currency: string) {
  const [usdc, setUsdc] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!rates[currency]) {
      fetch(`/api/fx/rate?currency=${currency}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setRates((prev) => ({ ...prev, [currency]: json.data.rate }));
            setFetchedAt(json.data.fetchedAt);
          }
        })
        .catch(() => {});
    }
  }, [currency, rates]);

  useEffect(() => {
    const rate = rates[currency];
    if (rate && amount && amount > 0) {
      setUsdc(amount / rate);
    } else {
      setUsdc(null);
    }
  }, [amount, currency, rates]);

  return { usdc, fetchedAt };
}

export function CreateCircleForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<CreateCircleInput>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: FORM_DEFAULTS,
    mode: "onBlur",
  });

  const handleTemplateSelect = (template: CircleTemplate | null) => {
    if (template !== null) {
      reset(template.values);
      setActiveTemplateId(template.id);
    } else {
      reset(FORM_DEFAULTS);
      setActiveTemplateId(null);
    }
  };

  const contributionAmount = useWatch({ control, name: "contributionAmount" });
  const contributionCurrency = useWatch({ control, name: "contributionCurrency" });
  const { usdc, fetchedAt } = useUsdcPreview(contributionAmount, contributionCurrency);

  const onSubmit = async (data: CreateCircleInput) => {
    setError(null);
    try {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      // Analytics: circle created (no PII)
      try { (await import('@vercel/analytics')).event('circle_created', { circleId: json.data.id }); } catch {}
      router.push(`/circles/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className={styles.title}>Create a Circle</h2>

      <TemplateSelector
        templates={CIRCLE_TEMPLATES}
        activeTemplateId={activeTemplateId}
        onSelect={handleTemplateSelect}
      />

      <Input label="Circle Name" placeholder="e.g. Lagos Girls Monthly Ajo"
        error={errors.name?.message} {...register("name")} />

      <div className={styles.row}>
        <div className={styles.flex2}>
          <Input label="Contribution Amount" type="number" placeholder="10000"
            error={errors.contributionAmount?.message}
            {...register("contributionAmount", { valueAsNumber: true })} />
        </div>
        <div className={styles.flex1}>
          <div className="input-group">
            <label className="input-label" htmlFor="contributionCurrency">Currency</label>
            <select id="contributionCurrency" className="input" {...register("contributionCurrency")}>
              <option value="NGN">NGN (₦)</option>
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>
      </div>

      {usdc !== null && (
        <p className={styles.usdcPreview}>
          ≈ <strong>{usdc.toFixed(2)} USDC</strong>
          {fetchedAt && (
            <span className={styles.rateSource}>
              {" "}· Rate from open.er-api.com · {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      )}

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
        {errors.cycleFrequency && <p className={styles.fieldError}>{errors.cycleFrequency.message}</p>}
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
        {errors.circleType && <p className={styles.fieldError}>{errors.circleType.message}</p>}
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="payoutMethod">Payout Order</label>
        <select id="payoutMethod" className="input" {...register("payoutMethod")}>
          <option value="fixed">Fixed (first-come-first-served)</option>
          <option value="randomized">Randomized (locked when circle fills)</option>
        </select>
        <small className="input-hint">Randomized order is locked and visible to all members once the circle is full.</small>
        {errors.payoutMethod && <p className={styles.fieldError}>{errors.payoutMethod.message}</p>}
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <Button type="submit" fullWidth loading={isSubmitting} disabled={isSubmitting}>Create Circle</Button>
    </form>
  );
}
