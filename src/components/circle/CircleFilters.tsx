"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import styles from "./CircleFilters.module.css";
import { Input } from "@/components/ui/Input";
import { SupportedCurrency } from "@/lib/currency";

export function CircleFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [frequency, setFrequency] = useState(searchParams.get("frequency") || "");
  const [minAmount, setMinAmount] = useState(searchParams.get("minAmount") || "");
  const [maxAmount, setMaxAmount] = useState(searchParams.get("maxAmount") || "");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  const updateFilters = useCallback(
    (newFilters: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`/circles?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get("search") || "")) {
        updateFilters({ search });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchParams, updateFilters]);

  return (
    <div className={styles.filters}>
      <div className={`${styles.filterGroup} ${styles.searchWrapper}`}>
        <label className={styles.label} htmlFor="filter-search">Search</label>
        <input
          id="filter-search"
          type="text"
          placeholder="Search by circle name..."
          className={`${styles.input} ${styles.searchInput}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label} htmlFor="filter-frequency">Frequency</label>
        <select
          id="filter-frequency"
          className={styles.select}
          value={frequency}
          onChange={(e) => {
            setFrequency(e.target.value);
            updateFilters({ frequency: e.target.value });
          }}
        >
          <option value="">All Frequencies</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label} htmlFor="filter-status">Status</label>
        <select
          id="filter-status"
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateFilters({ status: e.target.value });
          }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label} htmlFor="filter-currency">Contribution</label>
        <div className={styles.rangeInputs}>
          <select
            id="filter-currency"
            className={styles.select}
            style={{ width: "80px", padding: "0 var(--space-2)" }}
            value={currency}
            aria-label="Filter by currency"
            onChange={(e) => {
              setCurrency(e.target.value);
              updateFilters({ currency: e.target.value });
            }}
          >
            <option value="">Any</option>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
          <input
            id="filter-min-amount"
            type="number"
            placeholder="Min"
            aria-label="Minimum contribution amount"
            className={styles.input}
            style={{ width: "80px" }}
            value={minAmount}
            onChange={(e) => {
              setMinAmount(e.target.value);
              updateFilters({ minAmount: e.target.value });
            }}
          />
          <span style={{ color: "var(--color-text-muted)" }} aria-hidden="true">-</span>
          <input
            id="filter-max-amount"
            type="number"
            placeholder="Max"
            aria-label="Maximum contribution amount"
            className={styles.input}
            style={{ width: "80px" }}
            value={maxAmount}
            onChange={(e) => {
              setMaxAmount(e.target.value);
              updateFilters({ maxAmount: e.target.value });
            }}
          />
        </div>
      </div>
    </div>
  );
}
