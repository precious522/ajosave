import { clsx } from "clsx";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth = false,
     loading = false, disabled, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, fullWidth && "btn--full", className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="sr-only">Loading…</span>
            <span className="btn-spinner" aria-hidden="true"></span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
