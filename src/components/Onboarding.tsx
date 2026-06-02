"use client";

import { useEffect, useState } from "react";
import styles from "./Onboarding.module.css";

const STORAGE_KEY = "ajosave:onboarding";

export function Onboarding({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<number>(0);
  const [inProgress, setInProgress] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || { seen: false, step: 0 };
    } catch { return { seen: false, step: 0 }; }
  });

  useEffect(() => {
    setStep(inProgress.step || 0);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inProgress, step }));
  }, [step]);

  const finish = (seen = true) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: seen, step }));
    onClose?.();
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <h2>Welcome to Ajosave</h2>
        <div className={styles.content}>
          {step === 0 && (
            <div>
              <h3>What is Ajo?</h3>
              <p>Rotating savings circles powered by Stellar and USDC — pool funds, take turns receiving the pot.</p>
            </div>
          )}
          {step === 1 && (
            <div>
              <h3>Connect Wallet</h3>
              <p>Connect your Stellar wallet (Freighter) to send/receive USDC on-chain.</p>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3>Make Your First Contribution</h3>
              <p>Create or join a circle and contribute USDC to start saving together.</p>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <button className="btn btn--ghost" onClick={() => { finish(false); }}>Skip</button>
          <div>
            {step > 0 && <button className="btn btn--ghost" onClick={() => setStep(s => Math.max(0, s - 1))}>Back</button>}
            {step < 2 && <button className="btn btn--primary" onClick={() => setStep(s => s + 1)}>Next</button>}
            {step === 2 && <button className="btn btn--primary" onClick={() => finish(true)}>Done</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
