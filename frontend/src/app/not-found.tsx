import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <Image
          src="/cc-short.png"
          alt="CrossCurrent"
          width={80}
          height={80}
          className="brand-logo-light"
          priority
        />
        <Image
          src="/cc-short-white.png"
          alt="CrossCurrent"
          width={80}
          height={80}
          className="brand-logo-dark hidden"
          priority
        />
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">
          Page not found
        </p>
        <Button asChild>
          <Link href="/">
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
