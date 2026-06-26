import { clsx } from "clsx";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = inputId ? `${inputId}-error` : undefined;
    const hintId = inputId ? `${inputId}-hint` : undefined;
    const describedBy = [error && errorId, hint && !error && hintId].filter(Boolean).join(" ") || undefined;
    return (
      <div className="input-group">
        {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
        <input
          ref={ref} id={inputId}
          className={clsx("input", error && "input--error", className)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {hint && !error && <span id={hintId} className="input-error-msg" style={{ color: "var(--color-text-muted)" }}>{hint}</span>}
        {error && <span id={errorId} className="input-error-msg" role="alert">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
