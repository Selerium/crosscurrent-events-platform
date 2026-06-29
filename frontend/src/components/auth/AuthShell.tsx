import { type ReactNode } from "react";
import Image from "next/image";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-5 flex justify-center">
              <Image
                src="/cc-long.png"
                alt="CrossCurrent"
                width={220}
                height={109}
                className="brand-logo-light h-12 w-auto"
                priority
              />
              <Image
                src="/cc-long-white.png"
                alt="CrossCurrent"
                width={220}
                height={109}
                className="brand-logo-dark hidden h-12 w-auto"
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </main>
    </div>
  );
}
