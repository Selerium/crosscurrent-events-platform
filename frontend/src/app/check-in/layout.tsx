import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type TokenPayload = {
  role?: string;
  exp?: number;
};

function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8")
    ) as TokenPayload;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export default async function CheckInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) {
    redirect("/login");
  }

  const payload = decodeToken(token);
  if (!payload) {
    redirect("/login");
  }

  if (payload.role !== "ADMIN" && payload.role !== "LEADER") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
