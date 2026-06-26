"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import styles from "./page.module.css";

const COUNTRY_CODES = [
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+1",   label: "🇺🇸 +1" },
  { code: "+44",  label: "🇬🇧 +44" },
  { code: "+233", label: "🇬🇭 +233" },
  { code: "+254", label: "🇰🇪 +254" },
  { code: "+27",  label: "🇿🇦 +27" },
];

const RESEND_COOLDOWN = 60;

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+234");
  const [localNumber, setLocalNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fullPhone = `${countryCode}${localNumber.replace(/^0/, "")}`;

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStep("otp");
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setOtp("");
    await sendOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const result = await signIn("credentials", { phone: fullPhone, otp, redirect: false });
      if (result?.error) throw new Error("Invalid or expired OTP. Please try again.");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={`container container--sm ${styles.inner}`}>
        <div className="card">
          <h1 className={styles.title}>
            {step === "phone" ? "Sign in to Ajosave" : "Enter your OTP"}
          </h1>
          <p className={styles.subtitle}>
            {step === "phone"
              ? "Enter your phone number to receive a one-time code."
              : `We sent a 6-digit code to ${fullPhone}.`}
          </p>

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className={styles.form} noValidate>
              <div className={styles.phoneRow}>
                <div className="input-group">
                  <label className="input-label" htmlFor="country-code">Country</label>
                  <select
                    id="country-code"
                    className={`input ${styles.countrySelect}`}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Phone Number"
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="8012345678"
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value)}
                  required
                />
              </div>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button type="submit" fullWidth loading={loading}>Send Code</Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className={styles.form} noValidate>
              <Input
                label="6-Digit Code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
              {error && <p className={styles.error} role="alert">{error}</p>}
              <Button type="submit" fullWidth loading={loading} disabled={otp.length !== 6}>
                Verify &amp; Sign In
              </Button>
              <div className={styles.resendRow}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  aria-disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => { setStep("phone"); setError(null); }}
                >
                  Change number
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
