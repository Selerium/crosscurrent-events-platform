import { type LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", children, ...props }: LabelProps) {
  return (
    <label
      className={["mb-1.5 block text-sm font-medium text-foreground", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </label>
  );
}
