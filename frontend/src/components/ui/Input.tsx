import { type InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", id, ...props }, ref) {
    return (
      <input
        ref={ref}
        id={id}
        className={[
          "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground",
          "placeholder:text-muted",
          "focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  },
);
